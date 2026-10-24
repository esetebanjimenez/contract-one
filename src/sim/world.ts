import { BOSS, BOSSES, LIEUTENANT_DOWN } from '../data/boss';
import { MAX_VIEW_HEIGHT, NATIVE_HEIGHT, NATIVE_WIDTH } from '../data/display';
import { ELITE, ENEMIES, ENEMY_BULLET_RADIUS, GRUNT_WEAPONS, KNOCKBACK_PX, SCALING, type EnemyDef } from '../data/enemies';

const GRUNT_SWING_SEC = (GRUNT_WEAPONS.windupMs + GRUNT_WEAPONS.strikeMs) / 1000;
import { LEVELS, scrapForLevel } from '../data/levels';
import { DAMAGE_NUMBERS } from '../data/damage-numbers';
import { BOSS_KEY, addDamageNumber, pruneDamageNumbers, type DamageNumber } from './damage-numbers';
import { DRONE, EXPLOSIVE, GRENADE, PERK_RULES, addStack, overflow, perkDef, type PerkId } from '../data/perks';
import { PLAYER } from '../data/player';
import { CAPS, DT, GRID_CELL, SEPARATION } from '../data/sim';
import { RUN } from '../data/run';
import { SPAWN, SPAWN_BANDS } from '../data/spawns';
import { checkPhase, createBoss, updateBoss, type Boss, type BossHost } from './boss';
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
  fireTimer: number; // seconds left of the current move or aim phase
  aiming: boolean; // Riflemen: stopped with the muzzle glint, about to fire
  firedAt?: number; // run time of the last shot (1-frame white muzzle flash)
  facing: 1 | -1;
  elite: boolean;
  flash: number; // seconds of white hit-flash left
  fleeing?: boolean; // boss clear-out: runs off, harmless, can't be hit
  noScrap?: boolean; // phase 3 adds
  swingAt?: number; // run time a Grunt's touch swing started (looks only; damage is unaffected)
}

/** The locked boss arena: camera position and the inner wall edges, in world px. */
export interface Arena {
  camX: number;
  camY: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  lockedAt: number;
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
  explodes?: boolean; // can roll HE ROUNDS: gun and drone bullets (design.md 16.9)
}

/** DRONE BUDDY body: orbits the merc, faces and shoots its own nearest target. */
export interface Drone {
  x: number;
  y: number;
  aim: number;
  cd: number;
}

/** FRAG OUT grenade in flight from the merc to its landing point. */
export interface Grenade {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  x: number;
  y: number;
  t: number;
  damage: number;
}

/** Explosion effect for the renderer (damage is applied when it is created). */
export interface Blast {
  kind: 'he' | 'frag';
  x: number;
  y: number;
  at: number; // run time
}

export interface Pickup {
  x: number;
  y: number;
  value: number;
  age: number;
  flying: boolean;
  cache: boolean; // Elite Scrap cache
  pop: number; // seconds left of the cyan merge pop
}

export type Phase = 'play' | 'levelup' | 'dead';

export interface Input {
  mx: number; // movement vector, magnitude <= 1
  my: number;
}

/** One target fight, for the results screen and the sim (design.md 16.11). */
export interface Fight {
  target: number; // index into BOSSES
  level: number; // player level when he spawned
  hp: number; // his HP at spawn
  arrivedAt: number; // run time he became damageable (-1 before)
  killedAt: number; // run time of the kill (-1 if alive)
  damage: number; // damage dealt to him
}

export interface World {
  rng: () => number;
  tick: number;
  time: number; // run time
  contractTicks: number; // ticks of contract time, which pauses during every fight (design.md 16.11)
  contractTime: number; // drives the TARGET IN timer, spawn rate, bands and per-minute scaling
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
  boss: Boss | null;
  arena: Arena | null;
  viewH: number; // visible world height, set by the client (bots use the 16:9 minimum)
  bossDamage: number; // damage dealt to all targets
  target: number; // index into BOSSES of the current or next fight
  targetsDown: number;
  fights: Fight[];
  downAt: number; // run time of the last lieutenant kill (-1 before); the arena releases tapeFadeSec later
  won: boolean; // the Warlord is dead; the UI plays the outro and shows results
  wonAt: number; // run time of the kill
  bossArrivedAt: number; // run time the current target became damageable (-1 before)
  nextClumpAt: number; // run time of the next Scrap clumping pass
  drones: Drone[];
  grenades: Grenade[];
  blasts: Blast[];
  damageNumbers: DamageNumber[]; // design.md 16.10, effects only
  nextVolleyAt: number; // run time of the next FRAG OUT volley
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
    contractTicks: 0,
    contractTime: 0,
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
    boss: null,
    arena: null,
    viewH: NATIVE_HEIGHT,
    bossDamage: 0,
    target: 0,
    targetsDown: 0,
    fights: [],
    downAt: -1,
    won: false,
    wonAt: 0,
    bossArrivedAt: -1,
    nextClumpAt: CLUMP.everySec,
    drones: [],
    grenades: [],
    blasts: [],
    damageNumbers: [],
    nextVolleyAt: 0,
  };
}

/** Enemies/s at contract time t: doubling every 2:30 to 5:00, then every 5:00 up to 10/s (design.md 16.11). */
export function spawnRate(t: number): number {
  const early = SPAWN.baseRate * Math.pow(2, Math.min(t, SPAWN.lateFromSec) / SPAWN.doublingSec);
  if (t <= SPAWN.lateFromSec) return early;
  return Math.min(SPAWN.maxRate, early * Math.pow(2, (t - SPAWN.lateFromSec) / SPAWN.lateDoublingSec));
}

/** True in the 0:30 before a fight (contract time): the TARGET INBOUND stretch. */
export function inbound(t: number): boolean {
  return BOSSES.some((b) => t >= b.atSec - RUN.inboundLeadSec && t < b.atSec);
}

export function inPressureWave(t: number): boolean {
  // No waves or rings in the 0:30 before each fight, so the arrival isn't buried (design.md 14.1, 16.11),
  // and none on the fight's own minute, so the waves come back gently after a lieutenant kill.
  if (inbound(t) || BOSSES.some((b) => t >= b.atSec && t < b.atSec + SPAWN.pressureDurationSec)) return false;
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
    const heavy = w.contractTime >= SPAWN.pressureHeavyFromSec && w.rng() < SPAWN.pressureHeavyShare;
    return { def: heavy ? ENEMIES.heavy : ENEMIES.grunt, elite: false };
  }
  const weights = bandAt(w.contractTime).weights;
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

/** Minimum move time between a Rifleman's stops (design.md 16.4). */
export function rifleMoveSec(t: number): number {
  return Math.max(SCALING.rifleMoveMin, 2 - SCALING.rifleMovePerMinute * (Math.max(0, t) / 60));
}

/** Whole body inside the current view (the locked arena view once it exists). */
export function fullyOnScreen(w: World, e: Enemy): boolean {
  const x0 = w.arena ? w.arena.camX : w.player.x - HALF_W;
  const y0 = w.arena ? w.arena.camY : w.player.y - w.viewH / 2;
  const r = e.def.radius;
  return e.x - r >= x0 && e.x + r <= x0 + NATIVE_WIDTH && e.y - r >= y0 && e.y + r <= y0 + w.viewH;
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

/** The pressure waves at 2:00, 4:00, 7:00, 8:00, 11:00 and 12:00 are full rings (design.md 12.3, 16.8, 16.11). */
export function isRingWave(t: number): boolean {
  const start = Math.floor(t / SPAWN.pressureEverySec) * SPAWN.pressureEverySec;
  return SPAWN.ringWavesSec.includes(start);
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
  const maxHp = def.hp * (elite ? ELITE.hp : 1) * (1 + SCALING.hpPerMinute * (w.contractTime / 60));
  const e: Enemy = {
    id: w.nextEnemyId++,
    def,
    x: p.x,
    y: p.y,
    hp: maxHp,
    maxHp,
    fireTimer: rifleMoveSec(w.contractTime),
    aiming: false,
    facing: 1,
    elite,
    flash: 0,
  };
  if (slot >= 0) w.enemies[slot] = e;
  else w.enemies.push(e);
  return e;
}

function updateSpawns(w: World, input: Input): void {
  // No normal spawns once the arena locks; only the phase 3 adds (design.md 14.9).
  if (w.won || w.arena) return;
  const t = w.contractTime;
  const pressure = inPressureWave(t);
  // Anti-flee: pressure arrives ahead of the player's movement, random when standing still.
  if (Math.hypot(input.mx, input.my) > 0.01) w.pressureAngle = Math.atan2(input.my, input.mx);
  else if (w.contractTicks % Math.round(SPAWN.pressureEverySec / DT) === 0) w.pressureAngle = w.rng() * Math.PI * 2;
  const ring = pressure && isRingWave(t);
  w.spawnAcc += spawnRate(t) * (pressure ? SPAWN.pressureMultiplier : 1) * DT;
  while (w.spawnAcc >= 1) {
    w.spawnAcc -= 1;
    const arc = (SPAWN.pressureArcDeg * Math.PI) / 180;
    const angle = pressure && !ring ? w.pressureAngle + (w.rng() - 0.5) * arc : w.rng() * Math.PI * 2;
    spawnEnemy(w, angle, pressure);
  }
}

function nearestEnemy(w: World, range: number, from: { x: number; y: number } = w.player): { x: number; y: number } | undefined {
  let best: { x: number; y: number } | undefined;
  let bd = range * range;
  const b = w.boss;
  if (b && b.damageable && b.hp > 0) {
    // Measured to his edge, so the big body gets targeted when he is close.
    const d = Math.max(0, Math.hypot(b.x - from.x, b.y - from.y) - BOSS.radius) ** 2;
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  for (const e of w.enemies) {
    if (e.fleeing) continue;
    const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
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
  shoot(w, p.x, p.y, p.aim, w.stats.damage, w.stats.bulletRange, CAPS.playerBullets);
}

/**
 * One trigger pull from any shooter (design.md 16.9): extra bullets in the gun's spread, each with the
 * gun's speed, pierce, bounces and HE roll. Stops at `limit` bullets on screen.
 */
function shoot(w: World, x: number, y: number, aim: number, damage: number, range: number, limit: number): void {
  const n = w.stats.projectiles;
  const spread = (PLAYER.multishotSpreadDeg * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    if (w.bullets.length >= limit) break;
    const a = aim + (i - (n - 1) / 2) * spread;
    w.bullets.push({
      x,
      y,
      vx: Math.cos(a) * w.stats.bulletSpeed,
      vy: Math.sin(a) * w.stats.bulletSpeed,
      rangeLeft: range,
      damage,
      pierceLeft: w.stats.pierce,
      bounces: w.stats.ricochet,
      hit: [],
      explodes: true,
    });
  }
}

const MAX_BLASTS = 128; // effect sprites only; damage always applies
const BLAST_LIFE_SEC = 0.7; // covers the longest effect (frag, 0.66 s)

function addBlast(w: World, kind: Blast['kind'], x: number, y: number): void {
  if (w.blasts.length < MAX_BLASTS) w.blasts.push({ kind, x, y, at: w.time });
}

/** Damage the Warlord (capped at his HP); handles the kill and phase changes. */
function damageBoss(w: World, dmg: number, crit: boolean): void {
  const wb = w.boss;
  if (!wb || !wb.damageable || wb.hp <= 0 || w.won) return;
  const d = Math.min(wb.hp, dmg);
  addDamageNumber(w, BOSS_KEY, wb.x, wb.y - BOSS.radius - DAMAGE_NUMBERS.abovePx, d, crit);
  wb.hp -= d;
  w.bossDamage += d;
  const fl = w.fights[w.fights.length - 1];
  if (fl) fl.damage += d;
  if (wb.state !== 'stagger') wb.flash = DT;
  if (wb.hp > 0) checkPhase(wb, bossHost(w));
  else {
    if (fl) fl.killedAt = w.time;
    w.targetsDown++;
    if (BOSSES[wb.target].final) winContract(w);
    else lieutenantDown(w, wb);
  }
}

/**
 * Damage every living enemy (and the Warlord) touching the circle; newly dead indices go to `dead`.
 * One number per blast (design.md 16.10): on the Warlord if he's caught, else the enemy nearest the centre.
 */
function areaDamage(w: World, x: number, y: number, r: number, dmg: number, crit: boolean, dead: number[]): void {
  let shown: Enemy | undefined;
  let shownD2 = Infinity;
  w.grid.query(x, y, r + 16, (i) => {
    const e = w.enemies[i];
    if (!e || e.hp <= 0 || e.fleeing) return;
    const rr = r + e.def.radius;
    const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d2 > rr * rr) return;
    e.hp -= dmg;
    if (e.def.knockbackImmune) e.flash = DT;
    if (e.hp <= 0) dead.push(i);
    if (d2 < shownD2) {
      shown = e;
      shownD2 = d2;
    }
  });
  const b = w.boss;
  if (b && b.damageable && b.hp > 0 && Math.hypot(b.x - x, b.y - y) <= r + BOSS.radius) damageBoss(w, dmg, crit);
  else if (shown) showHit(w, shown, dmg, crit);
}

function showHit(w: World, e: Enemy, dmg: number, crit: boolean): void {
  addDamageNumber(w, e.id, e.x, e.y - e.def.radius - DAMAGE_NUMBERS.abovePx, dmg, crit);
}

/**
 * DRONE BUDDY: up to 8 evenly spaced bodies orbit the merc, each firing 5 dmg twice a second. As
 * secondary shooters they take every gun stat (design.md 16.9). They keep one gun volley of room
 * under the bullet limit, so they skip a shot before the gun does.
 */
function updateDrones(w: World): void {
  const { count, mul } = overflow(w.stats.drones, DRONE.maxBodies, DRONE.overflowBonus);
  while (w.drones.length < count)
    w.drones.push({ x: w.player.x, y: w.player.y, aim: 0, cd: w.drones.length / (count * DRONE.shotsPerSec * w.stats.fireRateMul) });
  w.drones.length = count;
  const p = w.player;
  for (let i = 0; i < count; i++) {
    const d = w.drones[i];
    const a = w.time * DRONE.orbitRadPerSec + (i / count) * Math.PI * 2;
    d.x = p.x + Math.cos(a) * DRONE.orbitPx;
    d.y = p.y + Math.sin(a) * DRONE.orbitPx;
    d.cd -= DT;
    const t = nearestEnemy(w, DRONE.range, d);
    if (!t) {
      if (d.cd < 0) d.cd = 0;
      continue;
    }
    d.aim = Math.atan2(t.y - d.y, t.x - d.x);
    if (d.cd > 0) continue;
    const limit = CAPS.playerBullets - w.stats.projectiles;
    if (w.bullets.length + w.stats.projectiles > limit) {
      d.cd = 0;
      continue;
    }
    d.cd += 1 / (DRONE.shotsPerSec * w.stats.fireRateMul);
    const range = (DRONE.range + 40) * (w.stats.bulletRange / PLAYER.bulletRange);
    shoot(w, d.x, d.y, d.aim, DRONE.damage * mul * w.stats.damageMul, range, limit);
  }
}

/** Landing points for a volley: the densest on-screen clusters, spaced a blast apart; repeats if short. */
export function volleyTargets(w: World, count: number): { x: number; y: number }[] {
  const cands: { x: number; y: number; score: number }[] = [];
  const step = Math.max(1, Math.floor(w.enemies.length / 80)); // sample big crowds
  for (let i = 0; i < w.enemies.length; i += step) {
    const e = w.enemies[i];
    if (e.hp <= 0 || e.fleeing || !fullyOnScreen(w, e)) continue;
    let score = 0;
    w.grid.query(e.x, e.y, GRENADE.radius, (j) => {
      const o = w.enemies[j];
      if (o && !o.fleeing && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 <= GRENADE.radius ** 2) score++;
    });
    cands.push({ x: e.x, y: e.y, score });
  }
  const b = w.boss;
  if (b && b.damageable && b.hp > 0) cands.push({ x: b.x, y: b.y, score: 6 });
  cands.sort((a, c) => c.score - a.score);
  const picks: { x: number; y: number }[] = [];
  for (const c of cands) {
    if (picks.length >= count) break;
    if (picks.some((q) => (q.x - c.x) ** 2 + (q.y - c.y) ** 2 < GRENADE.radius ** 2)) continue;
    picks.push(c);
  }
  for (let i = 0; picks.length > 0 && picks.length < count; i++) picks.push(picks[i]);
  return picks;
}

/** FRAG OUT: on its 4 s cooldown (cut by FAST HANDS), throw the volley; grenades explode on landing for 40 dmg in 48 px. */
function updateGrenades(w: World, dead: number[]): void {
  if (w.stats.grenades > 0 && w.time >= w.nextVolleyAt && !w.won) {
    const { count, mul } = overflow(w.stats.grenades, GRENADE.maxPerVolley, GRENADE.overflowBonus);
    const targets = volleyTargets(w, count);
    if (targets.length > 0) {
      w.nextVolleyAt = w.time + GRENADE.cooldownSec * w.stats.cooldownMul;
      const p = w.player;
      for (const t of targets)
        w.grenades.push({ sx: p.x, sy: p.y, tx: t.x, ty: t.y, x: p.x, y: p.y, t: 0, damage: GRENADE.damage * mul * w.stats.damageMul });
    }
  }
  for (let i = w.grenades.length - 1; i >= 0; i--) {
    const g = w.grenades[i];
    g.t += DT;
    const k = Math.min(1, g.t / GRENADE.flightSec);
    g.x = g.sx + (g.tx - g.sx) * k;
    g.y = g.sy + (g.ty - g.sy) * k;
    if (k < 1) continue;
    const crit = w.stats.crit > 0 && w.rng() < w.stats.crit;
    areaDamage(w, g.tx, g.ty, GRENADE.radius, g.damage * (crit ? PERK_RULES.critMultiplier : 1), crit, dead);
    addBlast(w, 'frag', g.tx, g.ty);
    w.grenades[i] = w.grenades[w.grenades.length - 1];
    w.grenades.pop();
  }
}

/** Ricochet: turn the bullet toward the nearest living enemy it has not hit within range. */
function retarget(w: World, bl: Bullet, from: Enemy, speed: number): boolean {
  let best: Enemy | undefined;
  let bd = PERK_RULES.ricochetRange ** 2;
  for (const e of w.enemies) {
    if (e.hp <= 0 || e.fleeing || bl.hit.includes(e.id)) continue;
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
  if (p.invuln > 0 || w.won) return;
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

const MERGE_POP_SEC = 0.25;
/** design.md 16.3: once a second, 8+ grounded pieces within 24 px merge into one at their centre. */
const CLUMP = { everySec: 1, min: 8, radius: 24 };

export function clumpPickups(w: World): void {
  const ks = w.pickups;
  const used = new Uint8Array(ks.length);
  const r2 = CLUMP.radius * CLUMP.radius;
  const group: number[] = [];
  let removed = false;
  for (let i = 0; i < ks.length; i++) {
    if (used[i] || ks[i].flying) continue;
    group.length = 0;
    for (let j = i; j < ks.length; j++) {
      if (used[j] || ks[j].flying) continue;
      if ((ks[j].x - ks[i].x) ** 2 + (ks[j].y - ks[i].y) ** 2 <= r2) group.push(j);
    }
    if (group.length < CLUMP.min) continue;
    let sx = 0;
    let sy = 0;
    let value = 0;
    let cache = false;
    for (const j of group) {
      sx += ks[j].x;
      sy += ks[j].y;
      value += ks[j].value;
      cache ||= ks[j].cache;
      used[j] = 1;
    }
    const k = ks[i];
    k.x = sx / group.length;
    k.y = sy / group.length;
    k.value = value;
    k.cache = cache;
    k.pop = MERGE_POP_SEC;
    used[i] = 2; // keep
    removed = true;
  }
  if (removed) w.pickups = ks.filter((_, i) => used[i] !== 1);
}

export function killEnemy(w: World, i: number): void {
  const e = w.enemies[i];
  w.kills++;
  const scrap = e.noScrap ? 0 : e.def.scrap * (e.elite ? ELITE.scrap : 1);
  w.scrapDropped += scrap;
  if (scrap === 0) {
    // Phase 3 adds drop nothing.
  } else if (w.pickups.length < CAPS.pickups)
    w.pickups.push({ x: e.x, y: e.y, value: scrap, age: 0, flying: false, cache: e.elite, pop: 0 });
  else {
    // Past the cap, the value goes onto the piece on the ground nearest to where the enemy died,
    // with a cyan pop so the drop is seen landing (design.md 15.3).
    let near = w.pickups[0];
    let nd = Infinity;
    for (const k of w.pickups) {
      if (k.flying) continue;
      const d = (k.x - e.x) ** 2 + (k.y - e.y) ** 2;
      if (d < nd) {
        nd = d;
        near = k;
      }
    }
    near.value += scrap;
    near.pop = MERGE_POP_SEC;
  }
  w.enemies[i] = w.enemies[w.enemies.length - 1];
  w.enemies.pop();
}

export function step(w: World, input: Input): void {
  if (w.phase !== 'play') return;
  w.tick++;
  w.time = w.tick * DT;
  // The contract clock runs only between fights (design.md 16.11).
  if (!w.arena) w.contractTicks++;
  w.contractTime = w.contractTicks * DT;
  const p = w.player;

  // Player movement.
  const mag = Math.hypot(input.mx, input.my);
  const s = mag > 1 ? 1 / mag : 1;
  p.x += input.mx * s * w.stats.speed * DT;
  p.y += input.my * s * w.stats.speed * DT;
  p.moving = mag > 0;
  const next = BOSSES[w.target];
  if (!w.arena && !w.won && next && w.contractTime >= next.atSec) lockArena(w);
  else if (w.arena && w.downAt >= w.arena.lockedAt && w.time >= w.downAt + LIEUTENANT_DOWN.tapeFadeSec) releaseArena(w);
  const ar = w.arena;
  if (ar) {
    p.x = Math.min(ar.x1 - PLAYER.hitRadius, Math.max(ar.x0 + PLAYER.hitRadius, p.x));
    p.y = Math.min(ar.y1 - PLAYER.hitRadius, Math.max(ar.y0 + PLAYER.hitRadius, p.y));
  }
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
    if (e.fleeing) {
      // Clear-out: straight away from the player at 1.5x speed, no contact, no shots.
      const sp = e.def.speed * (e.elite ? ELITE.speed : 1) * RUN.fleeSpeedMul;
      e.x -= (dx / d) * sp * DT;
      e.y -= (dy / d) * sp * DT;
      e.facing = dx >= 0 ? -1 : 1;
      continue;
    }
    const r = e.def.ranged;
    if (!r || (!e.aiming && d > r.stopDistance)) {
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
      // Move for at least the move time, stop with a glint once fully on-screen, then fire (design.md 16.4).
      e.fireTimer -= DT;
      if (!e.aiming) {
        if (e.fireTimer <= 0 && fullyOnScreen(w, e)) {
          e.aiming = true;
          e.fireTimer = r.aimSec;
        }
      } else if (e.fireTimer <= 0) {
        e.aiming = false;
        e.fireTimer = rifleMoveSec(w.contractTime);
        const shots = e.elite ? ELITE.rifleSpreadShots : 1;
        const base = Math.atan2(dy, dx);
        const spread = (ELITE.rifleSpreadDeg * Math.PI) / 180;
        const n = fullyOnScreen(w, e) ? shots : 0;
        if (n > 0) e.firedAt = w.time;
        for (let k = 0; k < n && d <= r.bulletRange && w.enemyBullets.length < CAPS.enemyBullets; k++) {
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
    if (d < e.def.radius + PLAYER.hitRadius) {
      damagePlayer(w, contactDamage(e, w.contractTime));
      // Grunt swing (looks only): restart it once the last one has played while he keeps touching.
      if (e.def.id === 'grunt' && (e.swingAt === undefined || w.time - e.swingAt >= GRUNT_SWING_SEC)) e.swingAt = w.time;
    }
  }

  updateWarlord(w);

  fire(w);
  updateDrones(w);
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
    let hitDmg = 0;
    if (!spent) {
      grid.query(bl.x, bl.y, GRID_CELL / 2, (i) => {
        if (spent || hitEnemy) return;
        const e = w.enemies[i];
        if (e.hp <= 0 || e.fleeing || bl.hit.includes(e.id)) return;
        const rr = e.def.radius + PLAYER.bulletRadius;
        if ((e.x - bl.x) ** 2 + (e.y - bl.y) ** 2 > rr * rr) return;
        const crit = w.stats.crit > 0 && w.rng() < w.stats.crit;
        hitDmg = bl.damage * (crit ? PERK_RULES.critMultiplier : 1);
        e.hp -= hitDmg;
        showHit(w, e, hitDmg, crit);
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
    const wb = w.boss;
    if (!spent && !hitEnemy && wb && wb.damageable && wb.hp > 0 && !bl.hit.includes(-1)) {
      const rr = BOSS.radius + PLAYER.bulletRadius;
      if ((wb.x - bl.x) ** 2 + (wb.y - bl.y) ** 2 <= rr * rr) {
        const crit = w.stats.crit > 0 && w.rng() < w.stats.crit;
        const dmg = bl.damage * (crit ? PERK_RULES.critMultiplier : 1);
        bl.hit.push(-1);
        spent = true; // pierce and ricochet stop on the Warlord
        damageBoss(w, dmg, crit);
        if (bl.explodes && w.stats.explosive > 0 && w.rng() < w.stats.explosive) {
          // The blast is centred on the hit, so the Warlord takes it too, plus any adds beside him.
          areaDamage(w, bl.x, bl.y, EXPLOSIVE.radius, dmg * EXPLOSIVE.damageShare, false, dead);
          addBlast(w, 'he', bl.x, bl.y);
        }
      }
    }
    if (hitEnemy && bl.explodes && w.stats.explosive > 0 && w.rng() < w.stats.explosive) {
      // HE ROUNDS: half the hit's damage to everything within 32 px, the target included (design.md 16.7).
      areaDamage(w, hitEnemy.x, hitEnemy.y, EXPLOSIVE.radius, hitDmg * EXPLOSIVE.damageShare, false, dead);
      addBlast(w, 'he', hitEnemy.x, hitEnemy.y);
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
  updateGrenades(w, dead);
  dead.sort((a, b) => b - a);
  for (const i of dead) killEnemy(w, i);
  pruneDamageNumbers(w);
  if (w.blasts.length && w.time - w.blasts[0].at > BLAST_LIFE_SEC) w.blasts = w.blasts.filter((x) => w.time - x.at <= BLAST_LIFE_SEC);

  // Enemy bullets.
  for (let b = w.enemyBullets.length - 1; b >= 0; b--) {
    const bl = w.enemyBullets[b];
    bl.x += bl.vx * DT;
    bl.y += bl.vy * DT;
    bl.rangeLeft -= Math.hypot(bl.vx, bl.vy) * DT;
    const rr = PLAYER.hitRadius + ENEMY_BULLET_RADIUS;
    let spent = bl.rangeLeft <= 0 || (!!ar && (bl.x < ar.x0 || bl.x > ar.x1 || bl.y < ar.y0 || bl.y > ar.y1));
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
  if (w.time >= w.nextClumpAt) {
    w.nextClumpAt += CLUMP.everySec;
    clumpPickups(w);
  }
  for (let i = w.pickups.length - 1; i >= 0; i--) {
    const k = w.pickups[i];
    k.age += DT;
    if (k.pop > 0) k.pop -= DT;
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

  if (ar) despawnFled(w, ar);
  if (w.won && (w.enemies.length || w.enemyBullets.length)) clearField(w);
  if (w.phase === 'play' && w.pendingLevels > 0 && !w.won) openLevelUp(w);
}

function bossHost(w: World): BossHost {
  return {
    time: w.time,
    level: w.level,
    stats: w.stats,
    player: w.player,
    enemyBullets: w.enemyBullets,
    arena: w.arena,
    hitPlayer: (dmg) => damagePlayer(w, dmg),
    spawnAddsRing: (count) => {
      for (let i = 0; i < count; i++) {
        const e = spawnOne(w, (i / count) * Math.PI * 2, true, ENEMIES.grunt);
        if (!e) continue;
        e.noScrap = true;
        if (w.arena) {
          // Evenly spaced just outside the arena edges, walking in.
          const pt = arenaEdgePoint(w.arena, (i / count) * Math.PI * 2, ENEMIES.grunt.radius + RUN.arenaBandPx);
          e.x = pt.x;
          e.y = pt.y;
        }
      }
    },
  };
}

/** At each fight: freeze the camera on the current view and turn every enemy into a harmless runner. */
function lockArena(w: World): void {
  const p = w.player;
  const camX = Math.round(p.x - NATIVE_WIDTH / 2);
  const camY = Math.round(p.y - w.viewH / 2);
  const band = RUN.arenaBandPx;
  w.arena = {
    camX,
    camY,
    x0: camX + band,
    y0: camY + RUN.arenaHudPx + band,
    x1: camX + NATIVE_WIDTH - band,
    y1: camY + w.viewH - band,
    lockedAt: w.time,
  };
  for (const e of w.enemies) e.fleeing = true;
  w.enemyBullets.length = 0;
}

/** Point on the arena rectangle in direction `angle` from its centre, pushed `out` px outside. */
function arenaEdgePoint(a: Arena, angle: number, out: number): { x: number; y: number } {
  const cx = (a.x0 + a.x1) / 2;
  const cy = (a.y0 + a.y1) / 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tx = Math.abs(dx) > 1e-6 ? ((a.x1 - a.x0) / 2 + out) / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 1e-6 ? ((a.y1 - a.y0) / 2 + out) / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}

/** Fleeing enemies vanish once fully off the locked screen. */
function despawnFled(w: World, a: Arena): void {
  const m = 24;
  for (let i = w.enemies.length - 1; i >= 0; i--) {
    const e = w.enemies[i];
    if (!e.fleeing) continue;
    if (e.x < a.camX - m || e.x > a.camX + NATIVE_WIDTH + m || e.y < a.camY - m || e.y > a.camY + w.viewH + m) {
      w.enemies[i] = w.enemies[w.enemies.length - 1];
      w.enemies.pop();
    }
  }
}

function updateWarlord(w: World): void {
  if (w.won) return;
  const a = w.arena;
  if (!w.boss && a && w.time >= a.lockedAt + RUN.warningSec) {
    w.boss = createBoss(bossHost(w), w.target);
    w.fights.push({ target: w.target, level: w.level, hp: w.boss.maxHp, arrivedAt: -1, killedAt: -1, damage: 0 });
  }
  const b = w.boss;
  if (!b || b.hp <= 0) return;
  updateBoss(b, bossHost(w));
  if (b.damageable && w.bossArrivedAt < 0) {
    w.bossArrivedAt = w.time;
    w.fights[w.fights.length - 1].arrivedAt = w.time;
  }
}

/**
 * A lieutenant kill (design.md 16.11): enemy bullets clear and he drops a Scrap pile worth exactly the
 * next level. The walls hold while the tape fades, then the arena releases and the waves resume.
 */
function lieutenantDown(w: World, b: Boss): void {
  w.downAt = w.time;
  w.kills += 1;
  w.enemyBullets.length = 0;
  const value = scrapForLevel(w.level + w.pendingLevels);
  const n = LIEUTENANT_DOWN.scrapPieces;
  w.scrapDropped += value;
  for (let i = 0; i < n; i++) {
    // Even split (the remainder on the first piece), on a small ring so the next clumping pass merges them.
    const v = Math.floor(value / n) + (i === 0 ? value % n : 0);
    const ang = (i / n) * Math.PI * 2;
    const r = LIEUTENANT_DOWN.scrapSpreadPx;
    w.pickups.push({ x: b.x + Math.cos(ang) * r, y: b.y + Math.sin(ang) * r, value: v, age: 0, flying: false, cache: false, pop: 0 });
  }
}

/**
 * The camera unlocks and the waves resume on the contract clock. New spawns already come from at least
 * 204 px out (the edge of the tallest view plus 24 px), so none land within 200 px in the first 3 s.
 */
function releaseArena(w: World): void {
  w.arena = null;
  w.boss = null;
  w.bossArrivedAt = -1;
  w.target++;
}

/** Kill: every other enemy dies with no Scrap and enemy bullets clear (design.md 14.4). */
function winContract(w: World): void {
  w.won = true;
  w.wonAt = w.time;
  w.kills += 1;
}

/** Runs at the end of the tick, outside the grid queries that still index the enemy list. */
function clearField(w: World): void {
  w.kills += w.enemies.length;
  w.enemies.length = 0;
  w.enemyBullets.length = 0;
}

function openLevelUp(w: World): void {
  w.offer = drawOffer(w.stacks, w.damagePicks, w.level, LEVELS.perkChoices, w.rng);
  w.phase = 'levelup';
}

export function choosePerk(w: World, id: PerkId): void {
  const o = w.offer.find((x) => x.id === id);
  if (w.phase !== 'levelup' || !o) return;
  const prevMax = w.stats.maxHp;
  w.stacks[o.id] = addStack(o.id, w.stacks[o.id], o.value);
  if (perkDef(o.id).damageType) w.damagePicks++;
  w.stats = computeStats(w.stacks);
  if (o.id === 'maxhp') w.player.hp = Math.min(w.stats.maxHp, w.player.hp + (w.stats.maxHp - prevMax));
  w.level++;
  w.pendingLevels--;
  w.offer = [];
  w.phase = 'play';
  if (w.pendingLevels > 0) openLevelUp(w);
}
