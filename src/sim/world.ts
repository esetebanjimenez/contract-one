import { NATIVE_HEIGHT, NATIVE_WIDTH } from '../data/display';
import { ENEMIES, ENEMY_BULLET_RADIUS, ENEMY_HP_PER_MINUTE, type EnemyDef } from '../data/enemies';
import { LEVELS, scrapForLevel } from '../data/levels';
import type { PerkId } from '../data/perks';
import { PLAYER } from '../data/player';
import { CAPS, DT, GRID_CELL, SEPARATION } from '../data/sim';
import { SPAWN, SPAWN_TABLE } from '../data/spawns';
import { SpatialGrid } from './grid';
import { computeStats, drawOffer, emptyStacks, type PerkStacks, type PlayerStats } from './perks';
import { createRng } from './rng';

export interface Enemy {
  id: number;
  def: EnemyDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  fireTimer: number;
  facing: 1 | -1;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rangeLeft: number;
  damage: number;
  pierceLeft: number;
  hit: number[]; // enemy ids already hit (for pierce)
}

export interface Pickup {
  x: number;
  y: number;
  value: number;
  age: number;
  flying: boolean;
}

export type Phase = 'play' | 'levelup' | 'dead';

export interface Input {
  mx: number; // movement vector, magnitude <= 1
  my: number;
}

export interface World {
  rng: () => number;
  tick: number;
  time: number;
  phase: Phase;
  player: {
    x: number;
    y: number;
    hp: number;
    invuln: number;
    fireCd: number;
    aim: number;
    moving: boolean;
    hasTarget: boolean;
    facing: number;
  };
  stacks: PerkStacks;
  stats: PlayerStats;
  level: number;
  scrap: number; // scrap toward the next level
  pendingLevels: number;
  offer: PerkId[];
  enemies: Enemy[];
  bullets: Bullet[];
  enemyBullets: Bullet[];
  pickups: Pickup[];
  spawnAcc: number;
  pressureAngle: number;
  nextEnemyId: number;
  kills: number;
  scrapDropped: number;
  scrapCollected: number;
  peakEnemies: number;
  peakBullets: number;
  grid: SpatialGrid;
}

const HALF_W = NATIVE_WIDTH / 2;
const HALF_H = NATIVE_HEIGHT / 2;

export function createWorld(seed: number): World {
  const stacks = emptyStacks();
  const stats = computeStats(stacks);
  return {
    rng: createRng(seed),
    tick: 0,
    time: 0,
    phase: 'play',
    player: { x: 0, y: 0, hp: stats.maxHp, invuln: 0, fireCd: 0, aim: 0, moving: false, hasTarget: false, facing: 0 },
    stacks,
    stats,
    level: 1,
    scrap: 0,
    pendingLevels: 0,
    offer: [],
    enemies: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    spawnAcc: 0,
    pressureAngle: 0,
    nextEnemyId: 1,
    kills: 0,
    scrapDropped: 0,
    scrapCollected: 0,
    peakEnemies: 0,
    peakBullets: 0,
    grid: new SpatialGrid(GRID_CELL),
  };
}

export function spawnRate(t: number): number {
  return SPAWN.baseRate * Math.pow(2, t / SPAWN.doublingSec);
}

export function inPressureWave(t: number): boolean {
  return t >= SPAWN.pressureEverySec && t % SPAWN.pressureEverySec < SPAWN.pressureDurationSec;
}

function pickType(w: World): EnemyDef {
  const mins = w.time / 60;
  let total = 0;
  const weights: number[] = [];
  for (const e of SPAWN_TABLE) {
    const wt = w.time < e.unlockSec ? 0 : Math.min(e.maxWeight, e.startWeight + e.weightPerMinute * (mins - e.unlockSec / 60));
    weights.push(wt);
    total += wt;
  }
  let r = w.rng() * total;
  for (let i = 0; i < SPAWN_TABLE.length; i++) {
    r -= weights[i];
    if (r < 0) return ENEMIES[SPAWN_TABLE[i].type];
  }
  return ENEMIES[SPAWN_TABLE[0].type];
}

/** A point just outside the visible rectangle in direction `angle` from the player. */
function edgePoint(w: World, angle: number): { x: number; y: number } {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tx = Math.abs(dx) > 1e-6 ? HALF_W / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 1e-6 ? HALF_H / Math.abs(dy) : Infinity;
  const d = Math.min(tx, ty) + SPAWN.offscreenMin + w.rng() * (SPAWN.offscreenMax - SPAWN.offscreenMin);
  return { x: w.player.x + dx * d, y: w.player.y + dy * d };
}

function spawnEnemy(w: World, angle: number): void {
  const def = pickType(w);
  const p = edgePoint(w, angle);
  const maxHp = def.hp * (1 + ENEMY_HP_PER_MINUTE * (w.time / 60));
  if (w.enemies.length >= CAPS.enemies) {
    // Recycle the farthest enemy instead of growing past the cap.
    let far = 0;
    let fd = -1;
    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i];
      const d = (e.x - w.player.x) ** 2 + (e.y - w.player.y) ** 2;
      if (d > fd) {
        fd = d;
        far = i;
      }
    }
    const e = w.enemies[far];
    Object.assign(e, { id: w.nextEnemyId++, def, x: p.x, y: p.y, hp: maxHp, maxHp, fireTimer: def.ranged?.intervalSec ?? 0 });
    return;
  }
  w.enemies.push({ id: w.nextEnemyId++, def, x: p.x, y: p.y, hp: maxHp, maxHp, fireTimer: def.ranged?.intervalSec ?? 0, facing: 1 });
}

function updateSpawns(w: World): void {
  const pressure = inPressureWave(w.time);
  if (w.tick % Math.round(SPAWN.pressureEverySec / DT) === 0) w.pressureAngle = w.rng() * Math.PI * 2;
  w.spawnAcc += spawnRate(w.time) * (pressure ? SPAWN.pressureMultiplier : 1) * DT;
  while (w.spawnAcc >= 1) {
    w.spawnAcc -= 1;
    const arc = (SPAWN.pressureArcDeg * Math.PI) / 180;
    const angle = pressure ? w.pressureAngle + (w.rng() - 0.5) * arc : w.rng() * Math.PI * 2;
    spawnEnemy(w, angle);
  }
}

function nearestEnemy(w: World, range: number): Enemy | undefined {
  let best: Enemy | undefined;
  let bd = range * range;
  for (const e of w.enemies) {
    const d = (e.x - w.player.x) ** 2 + (e.y - w.player.y) ** 2;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

function fire(w: World): void {
  const p = w.player;
  p.fireCd -= DT;
  const target = nearestEnemy(w, PLAYER.targetRange);
  p.hasTarget = !!target;
  if (target) p.aim = Math.atan2(target.y - p.y, target.x - p.x);
  if (!target || p.fireCd > 0) {
    if (p.fireCd < 0) p.fireCd = 0;
    return;
  }
  p.fireCd += 1 / w.stats.fireRate;
  const n = w.stats.projectiles;
  const spread = (PLAYER.multishotSpreadDeg * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    if (w.bullets.length >= CAPS.playerBullets) break;
    const a = p.aim + (i - (n - 1) / 2) * spread;
    w.bullets.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(a) * PLAYER.bulletSpeed,
      vy: Math.sin(a) * PLAYER.bulletSpeed,
      rangeLeft: PLAYER.bulletRange,
      damage: w.stats.damage,
      pierceLeft: w.stats.pierce,
      hit: [],
    });
  }
}

function damagePlayer(w: World, dmg: number): void {
  const p = w.player;
  if (p.invuln > 0) return;
  p.hp -= dmg;
  p.invuln = PLAYER.invulnSec;
  if (p.hp <= 0) {
    p.hp = 0;
    w.phase = 'dead';
  }
}

function addScrap(w: World, v: number): void {
  w.scrapCollected += v;
  w.scrap += v;
  while (w.scrap >= scrapForLevel(w.level + w.pendingLevels)) {
    w.scrap -= scrapForLevel(w.level + w.pendingLevels);
    w.pendingLevels++;
  }
}

function killEnemy(w: World, i: number): void {
  const e = w.enemies[i];
  w.kills++;
  w.scrapDropped += e.def.scrap;
  if (w.pickups.length < CAPS.pickups) w.pickups.push({ x: e.x, y: e.y, value: e.def.scrap, age: 0, flying: false });
  else addScrap(w, e.def.scrap);
  w.enemies[i] = w.enemies[w.enemies.length - 1];
  w.enemies.pop();
}

export function step(w: World, input: Input): void {
  if (w.phase !== 'play') return;
  w.tick++;
  w.time = w.tick * DT;
  const p = w.player;

  // Player movement.
  const mag = Math.hypot(input.mx, input.my);
  const s = mag > 1 ? 1 / mag : 1;
  p.x += input.mx * s * w.stats.speed * DT;
  p.y += input.my * s * w.stats.speed * DT;
  p.moving = mag > 0;
  if (p.invuln > 0) p.invuln -= DT;

  updateSpawns(w);

  // Enemies: move, separate, shoot, contact.
  const grid = w.grid;
  grid.clear();
  for (let i = 0; i < w.enemies.length; i++) grid.insert(i, w.enemies[i].x, w.enemies[i].y);
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.facing = dx >= 0 ? 1 : -1;
    const r = e.def.ranged;
    if (!r || d > r.stopDistance) {
      e.x += (dx / d) * e.def.speed * DT;
      e.y += (dy / d) * e.def.speed * DT;
    }
    grid.query(e.x, e.y, e.def.radius * 2, (j) => {
      if (j <= i) return;
      const o = w.enemies[j];
      const ox = o.x - e.x;
      const oy = o.y - e.y;
      const min = e.def.radius + o.def.radius;
      const od = Math.hypot(ox, oy);
      if (od > 0 && od < min) {
        const push = ((min - od) / od) * SEPARATION * 0.5;
        e.x -= ox * push;
        e.y -= oy * push;
        o.x += ox * push;
        o.y += oy * push;
      }
    });
    if (r) {
      e.fireTimer -= DT;
      if (e.fireTimer <= 0) {
        e.fireTimer += r.intervalSec;
        if (d <= r.bulletRange && w.enemyBullets.length < CAPS.enemyBullets) {
          w.enemyBullets.push({
            x: e.x,
            y: e.y,
            vx: (dx / d) * r.bulletSpeed,
            vy: (dy / d) * r.bulletSpeed,
            rangeLeft: r.bulletRange,
            damage: r.damage,
            pierceLeft: 0,
            hit: [],
          });
        }
      }
    }
    if (d < e.def.radius + PLAYER.hitRadius) damagePlayer(w, e.def.contactDamage);
  }

  fire(w);
  if (p.hasTarget) p.facing = p.aim;
  else if (p.moving) p.facing = Math.atan2(input.my, input.mx);

  // Player bullets (grid holds enemy indices; rebuild after movement).
  grid.clear();
  for (let i = 0; i < w.enemies.length; i++) grid.insert(i, w.enemies[i].x, w.enemies[i].y);
  const dead: number[] = [];
  for (let b = w.bullets.length - 1; b >= 0; b--) {
    const bl = w.bullets[b];
    bl.x += bl.vx * DT;
    bl.y += bl.vy * DT;
    bl.rangeLeft -= PLAYER.bulletSpeed * DT;
    let spent = bl.rangeLeft <= 0;
    if (!spent) {
      grid.query(bl.x, bl.y, GRID_CELL / 2, (i) => {
        if (spent) return;
        const e = w.enemies[i];
        if (e.hp <= 0 || bl.hit.includes(e.id)) return;
        const rr = e.def.radius + PLAYER.bulletRadius;
        if ((e.x - bl.x) ** 2 + (e.y - bl.y) ** 2 > rr * rr) return;
        e.hp -= bl.damage;
        bl.hit.push(e.id);
        if (e.hp <= 0) dead.push(i);
        if (bl.pierceLeft-- <= 0) spent = true;
      });
    }
    if (spent) {
      w.bullets[b] = w.bullets[w.bullets.length - 1];
      w.bullets.pop();
    }
  }
  dead.sort((a, b) => b - a);
  for (const i of dead) killEnemy(w, i);

  // Enemy bullets.
  for (let b = w.enemyBullets.length - 1; b >= 0; b--) {
    const bl = w.enemyBullets[b];
    bl.x += bl.vx * DT;
    bl.y += bl.vy * DT;
    bl.rangeLeft -= Math.hypot(bl.vx, bl.vy) * DT;
    const rr = PLAYER.hitRadius + ENEMY_BULLET_RADIUS;
    let spent = bl.rangeLeft <= 0;
    if (!spent && (bl.x - p.x) ** 2 + (bl.y - p.y) ** 2 <= rr * rr) {
      const before = p.invuln;
      damagePlayer(w, bl.damage);
      spent = before <= 0;
    }
    if (spent) {
      w.enemyBullets[b] = w.enemyBullets[w.enemyBullets.length - 1];
      w.enemyBullets.pop();
    }
  }

  // Pickups.
  for (let i = w.pickups.length - 1; i >= 0; i--) {
    const k = w.pickups[i];
    k.age += DT;
    const dx = p.x - k.x;
    const dy = p.y - k.y;
    const d = Math.hypot(dx, dy);
    if (d < PLAYER.magnet) k.flying = true;
    if (k.flying && d > 0) {
      const m = Math.min(d, PLAYER.pickupFlySpeed * DT);
      k.x += (dx / d) * m;
      k.y += (dy / d) * m;
    }
    const collected = d <= PLAYER.collectRadius;
    if (collected) addScrap(w, k.value);
    if (collected || (k.age >= LEVELS.pickupLifetimeSec && !k.flying)) {
      w.pickups[i] = w.pickups[w.pickups.length - 1];
      w.pickups.pop();
    }
  }

  w.peakEnemies = Math.max(w.peakEnemies, w.enemies.length);
  w.peakBullets = Math.max(w.peakBullets, w.bullets.length + w.enemyBullets.length);

  if (w.phase === 'play' && w.pendingLevels > 0) openLevelUp(w);
}

function openLevelUp(w: World): void {
  w.offer = drawOffer(w.stacks, LEVELS.perkChoices, w.rng);
  if (w.offer.length === 0) {
    w.level += w.pendingLevels;
    w.pendingLevels = 0;
    return;
  }
  w.phase = 'levelup';
}

export function choosePerk(w: World, id: PerkId): void {
  if (w.phase !== 'levelup' || !w.offer.includes(id)) return;
  const prevMax = w.stats.maxHp;
  w.stacks[id]++;
  w.stats = computeStats(w.stacks);
  if (id === 'maxhp') w.player.hp = Math.min(w.stats.maxHp, w.player.hp + (w.stats.maxHp - prevMax));
  w.level++;
  w.pendingLevels--;
  w.offer = [];
  w.phase = 'play';
  if (w.pendingLevels > 0) openLevelUp(w);
}
