import { BOSS, bossHp } from '../data/boss';
import { MAX_VIEW_HEIGHT, NATIVE_WIDTH } from '../data/display';
import { PLAYER } from '../data/player';
import { CAPS, DT } from '../data/sim';
import { RUN } from '../data/run';

export type BossState = 'enter' | 'walk' | 'telegraph' | 'charge' | 'stagger';

export interface Boss {
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
  moving: boolean;
}

/** Minimal world surface the boss needs, so this file stays independent of world.ts. */
export interface BossHost {
  time: number;
  level: number;
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
  hitPlayer(dmg: number): void;
  spawnAddsRing(count: number): void;
}

const HALF_W = NATIVE_WIDTH / 2;
const HALF_H = MAX_VIEW_HEIGHT / 2;

export function createBoss(h: BossHost): Boss {
  const hp = bossHp(h.level);
  return {
    x: h.player.x,
    y: h.player.y - HALF_H - BOSS.entryOffscreenPx,
    hp,
    maxHp: hp,
    phase: 1,
    state: 'enter',
    stateT: 0,
    chargeCd: BOSS.charge.everySec,
    ringCd: BOSS.ring.everySec,
    addsCd: 0,
    dirX: 0,
    dirY: 1,
    chargeLeft: 0,
    gap: 0,
    facing: Math.PI / 2,
    flash: 0,
    damageable: false,
    moving: true,
  };
}

function enraged(h: BossHost): boolean {
  return h.time >= RUN.enrageSec;
}

function ringEvery(b: Boss, h: BossHost): number {
  if (enraged(h)) return BOSS.enrage.ringEverySec;
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
      damage: BOSS.ring.damage,
      pierceLeft: 0,
      bounces: 0,
      hit: [],
    });
  }
  b.gap = (b.gap + 3) % n; // the gap rotates every ring
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
  if (b.phase === 2) b.ringCd = BOSS.ring.everySec;
  if (b.phase === 3) {
    b.addsCd = 0;
    b.chargeCd = Math.min(b.chargeCd, BOSS.phase3.chargeEverySec);
  }
}

export function updateBoss(b: Boss, h: BossHost): void {
  const p = h.player;
  const dx = p.x - b.x;
  const dy = p.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  if (b.flash > 0) b.flash -= DT;
  const speed = BOSS.speed * (enraged(h) ? BOSS.enrage.speedMul : 1);
  b.moving = false;

  switch (b.state) {
    case 'enter': {
      b.x += (dx / d) * speed * DT;
      b.y += (dy / d) * speed * DT;
      b.facing = Math.atan2(dy, dx);
      b.moving = true;
      // Damageable (and attacking) once fully inside the tallest view.
      if (Math.abs(b.x - p.x) <= HALF_W - BOSS.radius && Math.abs(b.y - p.y) <= HALF_H - BOSS.radius) {
        b.damageable = true;
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
      b.x += (dx / d) * speed * DT;
      b.y += (dy / d) * speed * DT;
      b.facing = Math.atan2(dy, dx);
      b.moving = true;
      b.chargeCd -= DT;
      if (b.chargeCd <= 0) {
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
        b.chargeCd = b.phase === 3 ? BOSS.phase3.chargeEverySec : BOSS.charge.everySec;
      }
      break;
    }
  }

  if (b.state !== 'enter' && b.state !== 'stagger') {
    if (b.phase >= 2 || enraged(h)) {
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
  if (b.state !== 'enter' && cd < BOSS.radius + PLAYER.hitRadius) {
    h.hitPlayer(b.state === 'charge' ? BOSS.charge.damage : BOSS.contactDamage);
  }
}
