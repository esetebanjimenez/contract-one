import { BOSS, BOSSES, VIPER, WARLORD, type DpsStats } from '../data/boss';
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
  vulnT: number; // design.md 16.15: seconds left in HAMMER's post-charge vulnerable window (0 = guarded)
  chargeChain: number; // design.md 16.15: phase-3 charges still to chain after this one (0 = last)
  gap: number; // index of the rotating gap in the bullet ring
  facing: number; // radians
  flash: number;
  hitAt: number; // run time of the last damaging hit, for the fading hit flash (-1 before)
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
  // LT. VIPER's smoke break (design.md 16.16 v3): armed by taking damage, fires VIPER.break.sec later.
  breakT: number; // seconds until the break fires (-1 = idle, not armed)
  breakLeft: number; // seconds left settling after the teleport, holding fire (0 = not breaking)
  vanishLeft: number; // seconds left inside the departure cloud before the teleport, holding fire (0 = not vanishing)
  hpSeen: number; // his HP at the last gunner tick, to detect a fresh hit that arms the break
  // THE WARLORD only: his next scheduled attack is a charge (else an aimed burst).
  nextCharge: boolean;
  // THE WARLORD only: ARTILLERY CALL (design.md 16.11). throwT counts the throw pose (-1 when not throwing).
  throwT: number;
  artilleryCd: number;
}

/** LT. VIPER's mine (design.md 16.11): arms after a second, then waits for the player or its fuse. */
export interface Mine {
  x: number;
  y: number;
  age: number;
  damage: number;
}

/** LT. VIPER's smoke cloud (design.md 16.16): cover for a break, pure visual, fades over VIPER.smoke.fuseSec. */
export interface Smoke {
  x: number;
  y: number;
  age: number;
  /** Which puff the Artist drew (Esteban okayed both): 0 where he vanishes, 1 where he reappears. */
  variant: 0 | 1;
}

/** THE WARLORD's ARTILLERY CALL circle (design.md 16.11): fills inward over fillSec, then explodes once. */
export interface ArtilleryCircle {
  x: number;
  y: number;
  t: number; // seconds since it appeared (0 .. WARLORD.artillery.fillSec)
  damage: number; // already scaled by his damageScale
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

function isCharger(b: Boss): boolean {
  return BOSSES[b.target].style === 'charger';
}

/**
 * design.md 16.15: HAMMER's armor window. The charger takes `BOSS.guard.mul` of all damage while guarded,
 * and full damage during his post-charge vulnerable window (`vulnT > 0`). Every other boss takes full
 * damage always (VIPER is a positional gate, the Warlord a survival gate — neither is armored).
 */
export function bossDamageMul(b: Boss): number {
  return isCharger(b) && b.vulnT <= 0 ? BOSS.guard.mul : 1;
}

/** design.md 16.15: true while the charger is in his punishable window (for the render hit-flash / tell). */
export function bossVulnerable(b: Boss): boolean {
  return isCharger(b) && b.vulnT > 0;
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
  rng: () => number; // the run's seeded RNG (ARTILLERY CALL circle placement)
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
    tracer?: boolean;
  }[];
  /** Locked boss arena (inner wall edges), or null before the lock. */
  arena: { x0: number; y0: number; x1: number; y1: number } | null;
  mines: Mine[];
  artillery: ArtilleryCircle[];
  smokes: Smoke[];
  hitPlayer(dmg: number): void;
  spawnAddsRing(count: number, kind?: 'grunt' | 'runner' | 'heavy', angleOffset?: number, hpMul?: number): void;
  /** Spawn an explosion effect (damage is applied by the caller). Mines and artillery share the mine blast. */
  addBlast(kind: 'he' | 'frag' | 'mine', x: number, y: number): void;
}

const HALF_W = NATIVE_WIDTH / 2;
const HALF_H = MAX_VIEW_HEIGHT / 2;

// design.md 16.15: HP is the target's fixed skill-gate number (BOSSES[target].hp), the same for every build.
export function createBoss(h: BossHost, target = 0, maxHp = BOSSES[target].hp): Boss {
  const hp = Math.max(BOSS.hpMin, Math.round(maxHp));
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
    vulnT: 0,
    chargeChain: 0,
    gap: 0,
    facing: Math.PI / 2,
    flash: 0,
    hitAt: -1,
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
    breakT: -1,
    breakLeft: 0,
    vanishLeft: 0,
    hpSeen: 0,
    nextCharge: true,
    throwT: -1,
    artilleryCd: WARLORD.artillery.everySec[2],
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

/** design.md 16.15: HAMMER's slam — a full ring of bullets radiating from where his charge stops. */
function slam(b: Boss, h: BossHost): void {
  const S = BOSS.slam;
  for (let i = 0; i < S.bullets; i++) {
    if (h.enemyBullets.length >= CAPS.enemyBullets) break;
    const a = (i / S.bullets) * Math.PI * 2;
    h.enemyBullets.push({
      x: b.x,
      y: b.y,
      vx: Math.cos(a) * S.speed,
      vy: Math.sin(a) * S.speed,
      rangeLeft: S.range,
      damage: S.damage * BOSSES[b.target].damageScale,
      pierceLeft: 0,
      bounces: 0,
      hit: [],
    });
  }
}

/**
 * A charge ends (distance done or into a wall). design.md 16.15: HAMMER slams, and in phase 3 chains a
 * re-aimed charge if any are left — the punish window opens only after the last. The Warlord just recovers.
 */
function endCharge(b: Boss, h: BossHost): void {
  if (isCharger(b)) slam(b, h);
  if (isCharger(b) && b.phase === 3 && b.chargeChain > 0) {
    b.chargeChain--;
    const p = h.player;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    b.dirX = dx / d;
    b.dirY = dy / d;
    b.facing = Math.atan2(dy, dx);
    b.state = 'telegraph';
    b.stateT = BOSS.charge.telegraphSec;
    return;
  }
  b.state = 'walk';
  b.chargeCd = chargeEvery(b);
  b.vulnT = BOSS.guard.recoverSec; // he overshoots and is exposed — the punish window
}

function shoot(b: Boss, h: BossHost, angle: number, speed: number, damage: number, range: number, tracer = false): void {
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
    tracer,
  });
}

/** LT. VIPER's smoke clouds tick down and vanish (design.md 16.16); purely visual. */
function updateSmokes(h: BossHost): void {
  for (let i = h.smokes.length - 1; i >= 0; i--) {
    h.smokes[i].age += DT;
    if (h.smokes[i].age >= VIPER.smoke.fuseSec) {
      h.smokes[i] = h.smokes[h.smokes.length - 1];
      h.smokes.pop();
    }
  }
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
      h.addBlast('mine', m.x, m.y);
      h.mines[i] = h.mines[h.mines.length - 1];
      h.mines.pop();
    }
  }
}

/** ARTILLERY CALL circles fill inward and explode once (design.md 16.11). They tick whatever he is doing. */
function updateArtillery(h: BossHost): void {
  const A = WARLORD.artillery;
  const p = h.player;
  for (let i = h.artillery.length - 1; i >= 0; i--) {
    const c = h.artillery[i];
    c.t += DT;
    if (c.t < A.fillSec) continue;
    if (Math.hypot(p.x - c.x, p.y - c.y) <= A.radiusPx + PLAYER.hitRadius) h.hitPlayer(c.damage);
    h.addBlast('mine', c.x, c.y);
    h.artillery[i] = h.artillery[h.artillery.length - 1];
    h.artillery.pop();
  }
}

/**
 * Drop the volley: one circle on the player's spot, the rest 80-140 px out, inside the arena walls and
 * never overlapping another circle or a mine (design.md 16.11). A spot that can't be placed is skipped.
 */
function spawnArtillery(b: Boss, h: BossHost): void {
  const A = WARLORD.artillery;
  const p = h.player;
  const damage = A.damage * BOSSES[b.target].damageScale;
  const circles = A.circles[b.phase as 2 | 3];
  const place = (x: number, y: number): void => {
    h.artillery.push({ x, y, t: 0, damage });
  };
  const inArena = (x: number, y: number): boolean => {
    const a = h.arena;
    return !a || (x >= a.x0 + A.radiusPx && x <= a.x1 - A.radiusPx && y >= a.y0 + A.radiusPx && y <= a.y1 - A.radiusPx);
  };
  const clear = (x: number, y: number): boolean => {
    for (const c of h.artillery) if ((c.x - x) ** 2 + (c.y - y) ** 2 < (2 * A.radiusPx) ** 2) return false;
    for (const m of h.mines) if ((m.x - x) ** 2 + (m.y - y) ** 2 < (A.radiusPx + VIPER.mines.radiusPx) ** 2) return false;
    return true;
  };
  // The first circle lands on the player, clamped inside the walls.
  const a = h.arena;
  const px = a ? Math.min(a.x1 - A.radiusPx, Math.max(a.x0 + A.radiusPx, p.x)) : p.x;
  const py = a ? Math.min(a.y1 - A.radiusPx, Math.max(a.y0 + A.radiusPx, p.y)) : p.y;
  place(px, py);
  for (let n = 1; n < circles; n++) {
    for (let k = 0; k < A.placeTries; k++) {
      const ang = h.rng() * Math.PI * 2;
      const dist = A.minPx + h.rng() * (A.maxPx - A.minPx);
      const x = p.x + Math.cos(ang) * dist;
      const y = p.y + Math.sin(ang) * dist;
      if (inArena(x, y) && clear(x, y)) {
        place(x, y);
        break;
      }
    }
  }
}

/**
 * design.md 16.16: VIPER holds at his snipe distance and picks at the player. Taking damage arms a break;
 * VIPER.break.sec later he drops smoke and teleports to a far corner (no cornering).
 */
function gunnerWalk(b: Boss, h: BossHost, dx: number, dy: number, d: number, speed: number): void {
  b.facing = Math.atan2(dy, dx); // aim at the player
  // Settling after a teleport: stand at the new corner, holding fire (gated in gunnerAttacks).
  if (b.breakLeft > 0) {
    b.breakLeft -= DT;
    return;
  }
  // Swallowed by the departure cloud: stand still, then jump. Hits in the smoke count but don't re-arm a break.
  if (b.vanishLeft > 0) {
    b.hpSeen = b.hp;
    b.vanishLeft -= DT;
    if (b.vanishLeft <= 0) {
      b.vanishLeft = 0;
      teleport(b, h);
    }
    return;
  }
  // Break timer (design.md 16.16 v2): a fresh hit arms it; VIPER.break.sec later he smokes and bolts.
  if (b.hp < b.hpSeen && b.breakT < 0) b.breakT = VIPER.break.sec;
  b.hpSeen = b.hp;
  if (b.breakT >= 0) {
    b.breakT -= DT;
    if (b.breakT <= 0) {
      b.breakT = -1;
      startBreak(b, h);
      return;
    }
  }
  // Otherwise drift to keep his snipe distance (never flee into a wall).
  const off = d - VIPER.holdPx;
  if (Math.abs(off) > VIPER.holdSlackPx) {
    const s = off > 0 ? 1 : -1;
    b.x += (dx / d) * speed * DT * s;
    b.y += (dy / d) * speed * DT * s;
    b.moving = true;
  }
}

/** Drop a big smoke cloud on him; he stays swallowed by it for VIPER.break.vanishSec, then teleports (design.md 16.16). */
function startBreak(b: Boss, h: BossHost): void {
  h.smokes.push({ x: b.x, y: b.y, age: 0, variant: 0 }); // smoke where he vanishes
  b.vanishLeft = VIPER.break.vanishSec;
  if (b.vanishLeft <= 0) teleport(b, h);
}

/**
 * Teleport (hidden by the smoke) to one of the three arena corners farthest from the player, with a smoke
 * puff at the arrival too (design.md 16.16). A short settle before he snipes again.
 */
function teleport(b: Boss, h: BossHost): void {
  const p = h.player;
  const a = h.arena;
  const m = VIPER.break.marginPx;
  if (a) {
    const corners = [
      [a.x0 + m, a.y0 + m],
      [a.x1 - m, a.y0 + m],
      [a.x0 + m, a.y1 - m],
      [a.x1 - m, a.y1 - m],
    ];
    // Farthest first; the nearest corner (last) is dropped, and one of the three farthest is picked at random.
    corners.sort((c1, c2) => (c2[0] - p.x) ** 2 + (c2[1] - p.y) ** 2 - ((c1[0] - p.x) ** 2 + (c1[1] - p.y) ** 2));
    const pick = corners[Math.min(2, Math.floor(h.rng() * 3))];
    b.x = pick[0];
    b.y = pick[1];
  } else {
    const ang = h.rng() * Math.PI * 2;
    b.x = p.x + Math.cos(ang) * 600;
    b.y = p.y + Math.sin(ang) * 600;
  }
  h.smokes.push({ x: b.x, y: b.y, age: 0, variant: 1 }); // smoke where he reappears
  b.breakLeft = VIPER.break.settleSec;
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
      shoot(b, h, Math.atan2(b.aimY, b.aimX), B.speed, B.damage, B.range, true); // tracer: the sniper reveal
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
  if (b.breakLeft > 0 || b.vanishLeft > 0) return; // no aiming/firing/mines while breaking to a new vantage (design.md 16.16)
  if (b.aimT < 0 && b.burstLeft === 0) {
    b.burstCd -= DT;
    if (b.burstCd <= 0) b.aimT = 0;
  }
  tickBurst(b, h, dx, dy, d);
  if (b.phase >= 2) tickFan(b, h, dx, dy);
  // design.md 16.15: the mine trail runs from phase 1, so the player can't walk a straight line at him.
  const M = VIPER.mines;
  b.mineCd -= DT;
  if (b.mineCd <= 0) {
    b.mineCd += M.everySec;
    // design.md 16.15: a row of mines laid midway between him and the player, across the approach lane, so
    // the player walks through the minefield to reach him.
    const fx = dx / d;
    const fy = dy / d;
    const midX = b.x + dx * 0.5;
    const midY = b.y + dy * 0.5;
    for (let i = 0; i < M.count; i++) {
      const o = (i - (M.count - 1) / 2) * M.spacingPx;
      h.mines.push({
        x: midX - fy * o,
        y: midY + fx * o,
        age: 0,
        damage: M.damage * BOSSES[b.target].damageScale,
      });
    }
  }
  if (b.phase === 3) {
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
  if (isWarlord(b)) {
    b.chargeCd = WARLORD.firstAttackSec;
    // ARTILLERY CALL starts in phase 2 and quickens in phase 3; a throw never survives a phase change.
    b.throwT = -1;
    b.artilleryCd = artilleryEvery(b);
  }
}

/** ARTILLERY CALL interval for his current phase (design.md 16.11): 7 s in phase 2, 6 s in phase 3. */
function artilleryEvery(b: Boss): number {
  return WARLORD.artillery.everySec[(b.phase === 3 ? 3 : 2) as 2 | 3];
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
  if (b.vulnT > 0) b.vulnT -= DT;
  const gunner = isGunner(b);
  const warlord = isWarlord(b);
  const r = bossRadius(b);
  const speed = (gunner ? VIPER.speed : BOSS.speed) * (enraged(b, h) ? BOSS.enrage.speedMul : 1);
  b.moving = false;
  updateMines(h);
  updateArtillery(h);
  updateSmokes(h);

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
        gunnerWalk(b, h, dx, dy, d, speed);
        break;
      }
      // ARTILLERY CALL (design.md 16.11): the throw pose, then the circles. He stops and never charges
      // while throwing; its timer counts only in walk, so it pauses through a charge (telegraph + dash).
      if (warlord && b.throwT >= 0) {
        b.throwT += DT;
        b.facing = Math.atan2(dy, dx);
        if (b.throwT >= WARLORD.artillery.throwSec) {
          spawnArtillery(b, h);
          b.throwT = -1;
          b.artilleryCd = artilleryEvery(b);
          b.chargeCd += WARLORD.artillery.chargePushbackSec; // a throw pushes his next charge back
        }
        break;
      }
      if (warlord && b.phase >= 2) {
        b.artilleryCd -= DT;
        if (b.artilleryCd <= 0 && b.aimT < 0 && b.burstLeft === 0) {
          b.throwT = 0;
          b.facing = Math.atan2(dy, dx);
          break;
        }
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
        // design.md 16.15: HAMMER chains extra charges in phase 3; a single charge otherwise.
        b.chargeChain = isCharger(b) && b.phase === 3 ? BOSS.multiCharge.chainInPhase3 : 0;
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
      if (b.chargeLeft <= 0) endCharge(b, h);
      break;
    }
  }

  // Once inside, the arena walls hold him; a charge that hits a wall stops there (design.md 14.9).
  const ar = h.arena;
  if (ar && b.damageable) {
    const cx = Math.min(ar.x1 - r, Math.max(ar.x0 + r, b.x));
    const cy = Math.min(ar.y1 - r, Math.max(ar.y0 + r, b.y));
    if ((cx !== b.x || cy !== b.y) && b.state === 'charge') {
      b.x = cx;
      b.y = cy;
      b.chargeLeft = 0;
      endCharge(b, h); // design.md 16.15: a charge into a wall slams and recovers (or chains) here too
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
    // design.md 16.15: HAMMER's shield mobs — tanky Heavies closing in, so the player splits focus between
    // the charge and the high-HP enemies. Replaces his old phase-3 grunt ring.
    if (b.phase >= BOSS.shieldAdds.fromPhase) {
      b.addsCd -= DT;
      if (b.addsCd <= 0) {
        b.addsCd += BOSS.shieldAdds.everySec;
        h.spawnAddsRing(BOSS.shieldAdds.count, 'heavy', 0, BOSS.shieldAdds.hpMul);
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
