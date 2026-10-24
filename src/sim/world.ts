import { MAX_VIEW_HEIGHT, NATIVE_WIDTH } from '../data/display';
import { ELITE, ENEMIES, ENEMY_BULLET_RADIUS, KNOCKBACK_PX, SCALING, type EnemyDef } from '../data/enemies';
import { LEVELS, scrapForLevel } from '../data/levels';
import { PERK_RULES, perkDef, type PerkId } from '../data/perks';
import { PLAYER } from '../data/player';
import { CAPS, DT, GRID_CELL, SEPARATION } from '../data/sim';
import { SPAWN, SPAWN_BANDS } from '../data/spawns';
import { SpatialGrid } from './grid';
import { computeStats, drawOffer, emptyStacks, type Offer, type PerkStacks, type PlayerStats } from './perks';
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
  elite: boolean;
  flash: number; // seconds of white hit-flash left
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rangeLeft: number;
  damage: number;
  pierceLeft: number;
  bounces: number;
  hit: number[]; // enemy ids already hit (for pierce)
}

export interface Pickup {
  x: number;
  y: number;
  value: number;
  age: number;
  flying: boolean;
  cache: boolean; // Elite Scrap cache
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
  damagePicks: number;
  stats: PlayerStats;
  level: number;
  scrap: number; // scrap toward the next level
  pendingLevels: number;
  offer: Offer[];
  enemies: Enemy[];
  bullets: Bullet[];
  enemyBullets: Bullet[];
  pickups: Pickup[];
  spawnAcc: number;
  regenAcc: number;
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
// Spawns and "off-screen" use the tallest view, so nothing pops in on tall phones; the sim stays deterministic.
const HALF_H = MAX_VIEW_HEIGHT / 2;

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
    damagePicks: 0,
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
    regenAcc: 0,
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

export function bandAt(t: number) {
  let b = SPAWN_BANDS[0];
  for (const x of SPAWN_BANDS) if (t >= x.fromSec) b = x;
  return b;
}

function weighted<K extends string>(w: World, weights: Record<K, number>, exclude: K[] = []): K {
  const keys = (Object.keys(weights) as K[]).filter((k) => !exclude.includes(k) && weights[k] > 0);
  const total = keys.reduce((a, k) => a + weights[k], 0);
  let r = w.rng() * total;
  for (const k of keys) {
    r -= weights[k];
    if (r < 0) return k;
  }
  return keys[keys.length - 1];
}

export function riflemenAlive(w: World): number {
  let n = 0;
  for (const e of w.enemies) if (e.def.ranged) n++;
  return n;
}

function pickType(w: World, pressure: boolean): { def: EnemyDef; elite: boolean } {
  if (pressure) {
    const heavy = w.time >= SPAWN.pressureHeavyFromSec && w.rng() < SPAWN.pressureHeavyShare;
    return { def: heavy ? ENEMIES.heavy : ENEMIES.grunt, elite: false };
  }
  const weights = bandAt(w.time).weights;
  type Kind = keyof typeof weights;
  const noRifle = riflemenAlive(w) >= SPAWN.maxRiflemen;
  const kind = weighted<Kind>(w, weights, noRifle ? ['rifleman'] : []);
  if (kind !== 'elite') return { def: ENEMIES[kind], elite: false };
  const base = weighted<Kind>(w, weights, noRifle ? ['elite', 'rifleman'] : ['elite']);
  return { def: ENEMIES[base as Exclude<Kind, 'elite'>], elite: true };
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

export function rifleInterval(t: number): number {
  return Math.max(SCALING.rifleIntervalMin, 2 - SCALING.rifleIntervalPerMinute * (t / 60));
}

export function contactDamage(e: Enemy, t: number): number {
  return e.def.contactDamage * (e.elite ? ELITE.contact : 1) * (1 + SCALING.contactPerMinute * (t / 60));
}

function spawnEnemy(w: World, angle: number, pressure: boolean): void {
  const first = spawnOne(w, angle, pressure);
  if (first && !first.elite && first.def.groupMin) {
    // Runners arrive in groups from the same edge (design.md 13.2).
    const extra = first.def.groupMin - 1 + Math.floor(w.rng() * (first.def.groupMax! - first.def.groupMin + 1));
    for (let i = 0; i < extra; i++) spawnOne(w, angle + (w.rng() - 0.5) * 0.3, pressure, first.def);
  }
}

function farthest(w: World, ok: (e: Enemy, offscreen: boolean) => boolean): number {
  let slot = -1;
  let fd = -1;
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (e.elite) continue;
    const dx = e.x - w.player.x;
    const dy = e.y - w.player.y;
    const off = Math.abs(dx) > NATIVE_WIDTH / 2 || Math.abs(dy) > HALF_H;
    if (!ok(e, off)) continue;
    const d = dx * dx + dy * dy;
    if (d > fd) {
      fd = d;
      slot = i;
    }
  }
  return slot;
}

/** From 3:00, every second pressure wave (3:00, 5:00, 7:00, 9:00) is a full ring (design.md 12.3). */
export function isRingWave(t: number): boolean {
  const n = Math.floor(t / SPAWN.pressureEverySec);
  return t >= SPAWN.ringFromSec && n % SPAWN.ringEveryNthWave === 1;
}

function spawnOne(w: World, angle: number, pressure: boolean, force?: EnemyDef): Enemy | undefined {
  const cap = CAPS.enemies + (pressure ? SPAWN.pressureOverCap : 0);
  let slot = -1;
  if (w.enemies.length >= cap) {
    // At the cap, replace the farthest off-screen non-Elite Grunt, else the farthest off-screen
    // non-Elite of any type, else the farthest non-Elite, so spawning never stops (design.md 12.2).
    slot = farthest(w, (e, off) => off && e.def.id === 'grunt');
    if (slot === -1) slot = farthest(w, (_e, off) => off);
    if (slot === -1) slot = farthest(w, () => true);
    if (slot === -1) return undefined;
  }
  const { def, elite } = force ? { def: force, elite: false } : pickType(w, pressure);
  const p = edgePoint(w, angle);
  const maxHp = def.hp * (elite ? ELITE.hp : 1) * (1 + SCALING.hpPerMinute * (w.time / 60));
  const e: Enemy = {
    id: w.nextEnemyId++,
    def,
    x: p.x,
    y: p.y,
    hp: maxHp,
    maxHp,
    fireTimer: rifleInterval(w.time),
    facing: 1,
    elite,
    flash: 0,
  };
  if (slot >= 0) w.enemies[slot] = e;
  else w.enemies.push(e);
  return e;
}

function updateSpawns(w: World, input: Input): void {
  const pressure = inPressureWave(w.time);
  // Anti-flee: pressure arrives ahead of the player's movement, random when standing still.
  if (Math.hypot(input.mx, input.my) > 0.01) w.pressureAngle = Math.atan2(input.my, input.mx);
  else if (w.tick % Math.round(SPAWN.pressureEverySec / DT) === 0) w.pressureAngle = w.rng() * Math.PI * 2;
  const ring = pressure && isRingWave(w.time);
  w.spawnAcc += spawnRate(w.time) * (pressure ? SPAWN.pressureMultiplier : 1) * DT;
  while (w.spawnAcc >= 1) {
    w.spawnAcc -= 1;
    const arc = (SPAWN.pressureArcDeg * Math.PI) / 180;
    const angle = pressure && !ring ? w.pressureAngle + (w.rng() - 0.5) * arc : w.rng() * Math.PI * 2;
    spawnEnemy(w, angle, pressure);
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
      vx: Math.cos(a) * w.stats.bulletSpeed,
      vy: Math.sin(a) * w.stats.bulletSpeed,
      rangeLeft: w.stats.bulletRange,
      damage: w.stats.damage,
      pierceLeft: w.stats.pierce,
      bounces: w.stats.ricochet,
      hit: [],
    });
  }
}

/** Ricochet: turn the bullet toward the nearest living enemy it has not hit within range. */
function retarget(w: World, bl: Bullet, from: Enemy, speed: number): boolean {
  let best: Enemy | undefined;
  let bd = PERK_RULES.ricochetRange ** 2;
  for (const e of w.enemies) {
    if (e.hp <= 0 || bl.hit.includes(e.id)) continue;
    const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  if (!best) return false;
  const d = Math.sqrt(bd) || 1;
  bl.vx = ((best.x - from.x) / d) * speed;
  bl.vy = ((best.y - from.y) / d) * speed;
  bl.rangeLeft = Math.max(bl.rangeLeft, PERK_RULES.ricochetRange + 10);
  return true;
}

function damagePlayer(w: World, dmg: number): void {
  const p = w.player;
  if (p.invuln > 0) return;
  p.hp -= Math.max(1, dmg - w.stats.armor);
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
  const scrap = e.def.scrap * (e.elite ? ELITE.scrap : 1);
  w.scrapDropped += scrap;
  if (w.pickups.length < CAPS.pickups) w.pickups.push({ x: e.x, y: e.y, value: scrap, age: 0, flying: false, cache: e.elite });
  else addScrap(w, scrap); // past the cap, drops fly straight to the player (design.md 15.3)
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
  if (w.stats.regenPerTick > 0) {
    w.regenAcc += DT;
    if (w.regenAcc >= PERK_RULES.regenIntervalSec) {
      w.regenAcc -= PERK_RULES.regenIntervalSec;
      p.hp = Math.min(w.stats.maxHp, p.hp + w.stats.regenPerTick);
    }
  }

  updateSpawns(w, input);

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
      const sp = e.def.speed * (e.elite ? ELITE.speed : 1);
      e.x += (dx / d) * sp * DT;
      e.y += (dy / d) * sp * DT;
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
    if (e.flash > 0) e.flash -= DT;
    if (r) {
      e.fireTimer -= DT;
      if (e.fireTimer <= 0) {
        e.fireTimer += rifleInterval(w.time);
        const shots = e.elite ? ELITE.rifleSpreadShots : 1;
        const base = Math.atan2(dy, dx);
        const spread = (ELITE.rifleSpreadDeg * Math.PI) / 180;
        for (let k = 0; k < shots && d <= r.bulletRange && w.enemyBullets.length < CAPS.enemyBullets; k++) {
          const a = base + (k - (shots - 1) / 2) * spread;
          w.enemyBullets.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * r.bulletSpeed,
            vy: Math.sin(a) * r.bulletSpeed,
            rangeLeft: r.bulletRange,
            damage: r.damage,
            pierceLeft: 0,
            bounces: 0,
            hit: [],
          });
        }
      }
    }
    if (d < e.def.radius + PLAYER.hitRadius) damagePlayer(w, contactDamage(e, w.time));
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
    const bv = Math.hypot(bl.vx, bl.vy);
    bl.rangeLeft -= bv * DT;
    let spent = bl.rangeLeft <= 0;
    let hitEnemy: Enemy | undefined;
    if (!spent) {
      grid.query(bl.x, bl.y, GRID_CELL / 2, (i) => {
        if (spent || hitEnemy) return;
        const e = w.enemies[i];
        if (e.hp <= 0 || bl.hit.includes(e.id)) return;
        const rr = e.def.radius + PLAYER.bulletRadius;
        if ((e.x - bl.x) ** 2 + (e.y - bl.y) ** 2 > rr * rr) return;
        const crit = w.stats.crit > 0 && w.rng() < w.stats.crit;
        e.hp -= bl.damage * (crit ? PERK_RULES.critMultiplier : 1);
        bl.hit.push(e.id);
        if (e.def.knockbackImmune) e.flash = DT;
        else {
          e.x += (bl.vx / bv) * KNOCKBACK_PX;
          e.y += (bl.vy / bv) * KNOCKBACK_PX;
        }
        if (e.hp <= 0) dead.push(i);
        hitEnemy = e;
      });
    }
    if (hitEnemy) {
      if (bl.pierceLeft > 0) bl.pierceLeft--;
      else if (bl.bounces > 0 && retarget(w, bl, hitEnemy, bv)) bl.bounces--;
      else spent = true;
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
    if (d < w.stats.magnet) k.flying = true;
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
  w.offer = drawOffer(w.stacks, w.damagePicks, w.level, LEVELS.perkChoices, w.rng);
  if (w.offer.length === 0) {
    w.level += w.pendingLevels;
    w.pendingLevels = 0;
    return;
  }
  w.phase = 'levelup';
}

export function choosePerk(w: World, id: PerkId): void {
  const o = w.offer.find((x) => x.id === id);
  if (w.phase !== 'levelup' || !o) return;
  const prevMax = w.stats.maxHp;
  w.stacks[id] += o.value;
  if (perkDef(id).damageType) w.damagePicks++;
  w.stats = computeStats(w.stacks);
  if (id === 'maxhp') w.player.hp = Math.min(w.stats.maxHp, w.player.hp + (w.stats.maxHp - prevMax));
  w.level++;
  w.pendingLevels--;
  w.offer = [];
  w.phase = 'play';
  if (w.pendingLevels > 0) openLevelUp(w);
}
