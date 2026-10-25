import { BOSS, BOSSES, VIPER, WARLORD, bossHp, type DpsStats } from '../data/boss';
import { PERK_RULES } from '../data/perks';
import { MAX_VIEW_HEIGHT, NATIVE_WIDTH } from '../data/display';
import { PLAYER } from '../data/player';
import { CAPS, DT } from '../data/sim';
import { RUN } from '../data/run';

export type BossState = 'enter' | 'walk' | 'telegraph' | 'charge' | 'stagger';

export interface Boss {
  target: number; // index into BOSSES
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3;
  state: BossState;
  stateT: number; // seconds left in telegraph / stagger
  chargeCd: number;
  ringCd: number;
  addsCd: number;
  dirX: number; // locked charge direction
  dirY: number;
  chargeLeft: number; // px of dash left
  gap: number; // index of the rotating gap in the bullet ring
  facing: number; // radians
  flash: number;
  damageable: boolean;
  arrivedAt: number; // run time he became damageable (-1 before)
  moving: boolean;
  // LT. VIPER (gunner) only.
  aimT: number; // seconds into the current aim line (-1 when not aiming)
  aimX: number; // aim direction: tracks the player, then locks
  aimY: number;
  burstLeft: number; // bullets of the current burst still to fire
  burstShotT: number; // seconds to the next burst bullet
  burstCd: number;
  fanCd: number;
  mineCd: number;
  // THE WARLORD only: his next scheduled attack is a charge (else an aimed burst).
  nextCharge: boolean;
}

/** LT. VIPER's mine (design.md 16.11): arms after a second, then waits for the player or its fuse. */
export interface Mine {
  x: number;
  y: number;
  age: number;
  damage: number;
}

export function mineArmed(m: Mine): boolean {
  return m.age >= VIPER.mines.armSec;
}

function isGunner(b: Boss): boolean {
  return BOSSES[b.target].style === 'gunner';
}

function isWarlord(b: Boss): boolean {
  return BOSSES[b.target].style === 'warlord';
}

/** His body and hit radius (design.md 16.11: the Warlord's bigger sprite gets a bigger body). */
export function bossRadius(b: Boss): number {
  return BOSSES[b.target].radius;
}

/** Minimal world surface the boss needs, so this file stays independent of world.ts. */
export interface BossHost {
  time: number;
  level: number;
  stats: DpsStats;
  player: { x: number; y: number };
  enemyBullets: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rangeLeft: number;
    damage: number;
    pierceLeft: number;
    bounces: number;
    hit: number[];
  }[];
  /** Locked boss arena (inner wall edges), or null before the lock. */
  arena: { x0: number; y0: number; x1: number; y1: number } | null;
  mines: Mine[];
  hitPlayer(dmg: number): void;
  spawnAddsRing(count: number, kind?: 'grunt' | 'runner', angleOffset?: number): void;
}

const HALF_W = NATIVE_WIDTH / 2;
const HALF_H = MAX_VIEW_HEIGHT / 2;

export function createBoss(h: BossHost, target = 0): Boss {
  const hp = bossHp(h.stats, PERK_RULES.critMultiplier, BOSSES[target].hpDpsSec);
  return {
    target,
    // Walks in from the top edge, 120 px off-screen (design.md 14.2).
    x: h.arena ? (h.arena.x0 + h.arena.x1) / 2 : h.player.x,
    y: h.arena ? h.arena.y0 - BOSS.entryOffscreenPx : h.player.y - HALF_H - BOSS.entryOffscreenPx,
    hp,
    maxHp: hp,
    phase: 1,
    state: 'enter',
    stateT: 0,
    chargeCd: BOSSES[target].style === 'warlord' ? WARLORD.firstAttackSec : BOSS.charge.everySec,
    ringCd: BOSS.ring.everySec,
    addsCd: 0,
    dirX: 0,
    dirY: 1,
    chargeLeft: 0,
    gap: 0,
    facing: Math.PI / 2,
    flash: 0,
    damageable: false,
    arrivedAt: -1,
    moving: true,
    aimT: -1,
    aimX: 0,
    aimY: 1,
    burstLeft: 0,
    burstShotT: 0,
    burstCd: VIPER.burst.firstAfterSec,
    fanCd: VIPER.fan.firstAfterSec,
    mineCd: 0,
    nextCharge: true,
  };
}

/** Seconds he has been enraged (negative before), on the fight clock. */
export function enragedFor(b: Boss, time: number): number {
  return b.arrivedAt < 0 ? -1 : time - b.arrivedAt - RUN.enrageFightSec;
}

function enraged(b: Boss, h: BossHost): boolean {
  return enragedFor(b, h.time) >= 0;
}

function ringEvery(b: Boss, h: BossHost): number {
  if (enraged(b, h)) return BOSS.enrage.ringEverySec;
  if (isWarlord(b)) return WARLORD.ringEverySec;
  return b.phase === 3 ? BOSS.phase3.ringEverySec : BOSS.ring.everySec;
}

function fireRing(b: Boss, h: BossHost): void {
  const n = BOSS.ring.bullets;
  for (let i = 0; i < n; i++) {
    if ((i - b.gap + n) % n < BOSS.ring.gapBullets) continue;
    if (h.enemyBullets.length >= CAPS.enemyBullets) break;
    const a = (i / n) * Math.PI * 2;
    h.enemyBullets.push({
      x: b.x,
      y: b.y,
      vx: Math.cos(a) * BOSS.ring.speed,
      vy: Math.sin(a) * BOSS.ring.speed,
      rangeLeft: BOSS.ring.range,
      damage: BOSS.ring.damage * BOSSES[b.target].damageScale,
      pierceLeft: 0,
      bounces: 0,
      hit: [],
    });
  }
  b.gap = (b.gap + 3) % n; // the gap rotates every ring
}

function shoot(b: Boss, h: BossHost, angle: number, speed: number, damage: number, range: number): void {
  if (h.enemyBullets.length >= CAPS.enemyBullets) return;
  h.enemyBullets.push({
    x: b.x,
    y: b.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rangeLeft: range,
    damage: damage * BOSSES[b.target].damageScale,
    pierceLeft: 0,
    bounces: 0,
    hit: [],
  });
}

/** Mines tick whatever he is doing, stagger included. */
function updateMines(h: BossHost): void {
  const M = VIPER.mines;
  const p = h.player;
  for (let i = h.mines.length - 1; i >= 0; i--) {
    const m = h.mines[i];
    m.age += DT;
    const d = Math.hypot(p.x - m.x, p.y - m.y);
    if ((mineArmed(m) && d <= M.triggerPx) || m.age >= M.fuseSec) {
      if (d <= M.radiusPx + PLAYER.hitRadius) h.hitPlayer(m.damage);
      h.mines[i] = h.mines[h.mines.length - 1];
      h.mines.pop();
    }
  }
}

/** LT. VIPER holds about 160 px off: walks in when far, backs off when the player closes in. */
function gunnerWalk(b: Boss, dx: number, dy: number, d: number, speed: number): void {
  const off = d - VIPER.holdPx;
  b.facing = Math.atan2(dy, dx);
  if (Math.abs(off) <= VIPER.holdSlackPx) return;
  const s = off > 0 ? 1 : -1;
  b.x += (dx / d) * speed * DT * s;
  b.y += (dy / d) * speed * DT * s;
  b.moving = true;
}

/** The aimed burst in flight: the line tracks, locks, then the bullets go down it. */
function tickBurst(b: Boss, h: BossHost, dx: number, dy: number, d: number): void {
  const B = VIPER.burst;
  if (b.aimT >= 0) {
    if (b.aimT < B.trackSec) {
      b.aimX = dx / d;
      b.aimY = dy / d;
    }
    b.aimT += DT;
    if (b.aimT >= B.trackSec + B.lockSec - 1e-9) {
      b.aimT = -1;
      b.burstLeft = B.bullets;
      b.burstShotT = 0;
    }
  }
  if (b.burstLeft > 0) {
    b.burstShotT -= DT;
    if (b.burstShotT <= 1e-9) {
      shoot(b, h, Math.atan2(b.aimY, b.aimX), B.speed, B.damage, B.range);
      b.burstLeft--;
      b.burstShotT += B.shotGapSec;
      // Next aim starts everySec after this one did.
      if (b.burstLeft === 0) b.burstCd = B.everySec - B.trackSec - B.lockSec - (B.bullets - 1) * B.shotGapSec;
    }
  }
}

/** The fan, every 4 s from phase 2; one that comes due mid-burst waits for it to finish. */
function tickFan(b: Boss, h: BossHost, dx: number, dy: number): void {
  const F = VIPER.fan;
  b.fanCd -= DT;
  if (b.fanCd <= 0 && b.aimT < 0 && b.burstLeft === 0) {
    b.fanCd += F.everySec;
    const base = Math.atan2(dy, dx);
    const spread = (F.spreadDeg * Math.PI) / 180;
    for (let i = 0; i < F.bullets; i++) shoot(b, h, base + (i / (F.bullets - 1) - 0.5) * spread, F.speed, F.damage, F.range);
  }
}

/** LT. VIPER's attacks by phase (design.md 16.11). */
function gunnerAttacks(b: Boss, h: BossHost, dx: number, dy: number, d: number): void {
  if (b.aimT < 0 && b.burstLeft === 0) {
    b.burstCd -= DT;
    if (b.burstCd <= 0) b.aimT = 0;
  }
  tickBurst(b, h, dx, dy, d);
  if (b.phase >= 2) tickFan(b, h, dx, dy);
  if (b.phase === 3) {
    const M = VIPER.mines;
    b.mineCd -= DT;
    if (b.mineCd <= 0) {
      b.mineCd += M.everySec;
      // A row of mines behind him, across his line to the player.
      const bx = -dx / d;
      const by = -dy / d;
      for (let i = 0; i < M.count; i++) {
        const o = (i - (M.count - 1) / 2) * M.spacingPx;
        h.mines.push({
          x: b.x + bx * M.behindPx - by * o,
          y: b.y + by * M.behindPx + bx * o,
          age: 0,
          damage: M.damage * BOSSES[b.target].damageScale,
        });
      }
    }
    b.addsCd -= DT;
    if (b.addsCd <= 0) {
      b.addsCd += VIPER.adds.everySec;
      h.spawnAddsRing(VIPER.adds.count, 'runner');
    }
  }
}

/** Called after damage: enter a new phase with a stagger that clears enemy bullets. */
export function checkPhase(b: Boss, h: BossHost): void {
  const f = b.hp / b.maxHp;
  const next = f < BOSS.phase3Below ? 3 : f < BOSS.phase2Below ? 2 : 1;
  if (next <= b.phase) return;
  b.phase = next as 2 | 3;
  b.state = 'stagger';
  b.stateT = BOSS.staggerSec;
  b.chargeLeft = 0;
  h.enemyBullets.length = 0;
  b.aimT = -1;
  b.burstLeft = 0;
  b.burstCd = VIPER.burst.firstAfterSec;
  if (b.phase === 2) {
    b.ringCd = BOSS.ring.everySec;
    b.fanCd = VIPER.fan.firstAfterSec;
  }
  if (b.phase === 3) {
    b.addsCd = 0;
    b.mineCd = 0;
    b.chargeCd = Math.min(b.chargeCd, BOSS.phase3.chargeEverySec);
  }
  if (isWarlord(b)) b.chargeCd = WARLORD.firstAttackSec;
}

/** Seconds from the end of a charge to his next attack. */
function chargeEvery(b: Boss): number {
  if (isWarlord(b)) return WARLORD.attackEverySec;
  return b.phase === 3 ? BOSS.phase3.chargeEverySec : BOSS.charge.everySec;
}

export function updateBoss(b: Boss, h: BossHost): void {
  const p = h.player;
  const dx = p.x - b.x;
  const dy = p.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  if (b.flash > 0) b.flash -= DT;
  const gunner = isGunner(b);
  const warlord = isWarlord(b);
  const r = bossRadius(b);
  const speed = (gunner ? VIPER.speed : BOSS.speed) * (enraged(b, h) ? BOSS.enrage.speedMul : 1);
  b.moving = false;
  updateMines(h);

  switch (b.state) {
    case 'enter': {
      b.x += (dx / d) * speed * DT;
      b.y += (dy / d) * speed * DT;
      b.facing = Math.atan2(dy, dx);
      b.moving = true;
      // Damageable (and attacking) once fully inside the tallest view.
      const a = h.arena;
      const inside = a
        ? b.x >= a.x0 + r && b.x <= a.x1 - r && b.y >= a.y0 + r && b.y <= a.y1 - r
        : Math.abs(b.x - p.x) <= HALF_W - r && Math.abs(b.y - p.y) <= HALF_H - r;
      if (inside) {
        b.damageable = true;
        b.arrivedAt = h.time;
        b.state = 'walk';
      }
      break;
    }
    case 'stagger':
      b.flash = DT;
      b.stateT -= DT;
      if (b.stateT <= 0) b.state = 'walk';
      break;
    case 'walk': {
      if (gunner) {
        gunnerWalk(b, dx, dy, d, speed);
        break;
      }
      b.x += (dx / d) * speed * DT;
      b.y += (dy / d) * speed * DT;
      b.facing = Math.atan2(dy, dx);
      b.moving = true;
      b.chargeCd -= DT;
      if (warlord && b.chargeCd <= 0 && (b.aimT >= 0 || b.burstLeft > 0)) break; // the burst finishes first
      if (warlord && b.chargeCd <= 0 && !b.nextCharge) {
        // His turn for the aimed burst: he keeps walking while the line tracks.
        b.nextCharge = true;
        b.chargeCd = WARLORD.attackEverySec;
        b.aimT = 0;
        break;
      }
      if (b.chargeCd <= 0) {
        b.nextCharge = false;
        b.state = 'telegraph';
        b.stateT = BOSS.charge.telegraphSec;
        b.dirX = dx / d;
        b.dirY = dy / d;
        b.facing = Math.atan2(dy, dx);
      }
      break;
    }
    case 'telegraph':
      b.stateT -= DT;
      if (b.stateT <= 0) {
        b.state = 'charge';
        b.chargeLeft = BOSS.charge.distance;
        if (warlord && b.phase === 3) {
          for (let i = 0; i < WARLORD.chargeMines; i++)
            h.mines.push({ x: b.x, y: b.y, age: 0, damage: VIPER.mines.damage * BOSSES[b.target].damageScale });
        }
      }
      break;
    case 'charge': {
      const m = Math.min(b.chargeLeft, BOSS.charge.speed * DT);
      b.x += b.dirX * m;
      b.y += b.dirY * m;
      b.chargeLeft -= m;
      b.moving = true;
      if (b.chargeLeft <= 0) {
        b.state = 'walk';
        b.chargeCd = chargeEvery(b);
      }
      break;
    }
  }

  // Once inside, the arena walls hold him; a charge that hits a wall stops there (design.md 14.9).
  const ar = h.arena;
  if (ar && b.damageable) {
    const cx = Math.min(ar.x1 - r, Math.max(ar.x0 + r, b.x));
    const cy = Math.min(ar.y1 - r, Math.max(ar.y0 + r, b.y));
    if ((cx !== b.x || cy !== b.y) && b.state === 'charge') {
      b.state = 'walk';
      b.chargeLeft = 0;
      b.chargeCd = chargeEvery(b);
    }
    b.x = cx;
    b.y = cy;
  }

  if (gunner && b.state === 'walk') {
    gunnerAttacks(b, h, dx, dy, d);
    // Enraged, he adds the 14.3 ring at the enrage rate.
    if (enraged(b, h)) {
      b.ringCd -= DT;
      if (b.ringCd <= 0) {
        b.ringCd += BOSS.enrage.ringEverySec;
        fireRing(b, h);
      }
    }
  } else if (warlord && b.state !== 'enter' && b.state !== 'stagger') {
    if (b.state === 'walk') {
      tickBurst(b, h, dx, dy, d);
      if (b.phase >= 2) tickFan(b, h, dx, dy);
    }
    if (b.phase >= 2 || enraged(b, h)) {
      b.ringCd -= DT;
      if (b.ringCd <= 0) {
        b.ringCd += ringEvery(b, h);
        fireRing(b, h);
      }
    }
    if (b.phase === 3) {
      b.addsCd -= DT;
      if (b.addsCd <= 0) {
        b.addsCd += WARLORD.adds.everySec;
        h.spawnAddsRing(WARLORD.adds.grunts, 'grunt');
        h.spawnAddsRing(WARLORD.adds.runners, 'runner', Math.PI / WARLORD.adds.runners);
      }
    }
  } else if (!gunner && b.state !== 'enter' && b.state !== 'stagger') {
    if (b.phase >= 2 || enraged(b, h)) {
      b.ringCd -= DT;
      if (b.ringCd <= 0) {
        b.ringCd += ringEvery(b, h);
        fireRing(b, h);
      }
    }
    if (b.phase === 3) {
      b.addsCd -= DT;
      if (b.addsCd <= 0) {
        b.addsCd += BOSS.phase3.addsEverySec;
        h.spawnAddsRing(BOSS.phase3.adds);
      }
    }
  }

  const cd = Math.hypot(p.x - b.x, p.y - b.y);
  if (b.state !== 'enter' && cd < r + PLAYER.hitRadius) {
    if (gunner) h.hitPlayer(VIPER.contactDamage);
    else if (warlord && b.state !== 'charge') h.hitPlayer(WARLORD.contactDamage);
    else h.hitPlayer((b.state === 'charge' ? BOSS.charge.damage : BOSS.contactDamage) * BOSSES[b.target].damageScale);
  }
}
