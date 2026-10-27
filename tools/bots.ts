import { PERKS, type PerkId } from '../src/data/perks';
import { DT } from '../src/data/sim';
import { BOSS, BOSSES } from '../src/data/boss';
import { RUN } from '../src/data/run';
import { bossRadius } from '../src/sim/boss';
import { choosePerk, createWorld, step, type Input, type World } from '../src/sim/world';

/**
 * The Warlord counts as one big enemy: keep away from his body and step sideways off the line of a
 * telegraphed or running charge. Returns a unit-ish force; callers weight it like their other threats.
 */
function bossAvoid(w: World, range: number): { x: number; y: number; threat: number } {
  const b = w.boss;
  if (!b || b.hp <= 0 || w.won) return { x: 0, y: 0, threat: 0 };
  const p = w.player;
  const dx = p.x - b.x;
  const dy = p.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  let x = 0;
  let y = 0;
  let threat = 0;
  const r = bossRadius(b);
  if (d < range + r) {
    const k = (range + r - d) / range;
    x += (dx / d) * k;
    y += (dy / d) * k;
    threat += k;
  }
  if (b.state === 'telegraph' || b.state === 'charge') {
    const along = dx * b.dirX + dy * b.dirY;
    const side = dx * -b.dirY + dy * b.dirX;
    if (along > -r && along < BOSS.charge.distance + r && Math.abs(side) < r + 20) {
      const s = Math.sign(side) || 1;
      x += -b.dirY * s * 2;
      y += b.dirX * s * 2;
      threat += 2;
    }
  }
  return { x, y, threat };
}

/** Unit vector toward the nearest supply crate within range, or null. */
function nearestCrate(w: World, range: number): { x: number; y: number } | null {
  const p = w.player;
  let best = range * range;
  let out: { x: number; y: number } | null = null;
  for (const c of w.crates) {
    const dx = c.x - p.x;
    const dy = c.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= best) continue;
    best = d2;
    const d = Math.sqrt(d2) || 1;
    out = { x: dx / d, y: dy / d };
  }
  return out;
}

const KITE_CRATE_PULL = 0.04;

export type Bot = 'idle' | 'kite' | 'kite-smart' | 'collector' | 'cc';

/** Move away from the weighted crowd and enemy bullets, with a sideways orbit so it does not run in a straight line. */
function kiteInput(w: World): Input {
  const p = w.player;
  let fx = 0;
  let fy = 0;
  for (const e of w.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 160 * 160 || d2 === 0) continue;
    const d = Math.sqrt(d2);
    fx += dx / d / d;
    fy += dy / d / d;
  }
  for (const b of w.enemyBullets) {
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 80 * 80 || d2 === 0) continue;
    // Step sideways relative to the bullet's path.
    const s = Math.sign(b.vx * dy - b.vy * dx) || 1;
    const v = Math.hypot(b.vx, b.vy);
    fx += ((-b.vy / v) * s * 3) / Math.sqrt(d2);
    fy += ((b.vx / v) * s * 3) / Math.sqrt(d2);
  }
  const ba = bossAvoid(w, 130);
  fx += ba.x * 0.05;
  fy += ba.y * 0.05;
  // Supply crates aren't pulled by the magnet, so a player walks to them (design.md 16.12).
  const c = nearestCrate(w, 240);
  if (c) {
    fx += c.x * KITE_CRATE_PULL;
    fy += c.y * KITE_CRATE_PULL;
  }
  // Orbit around the origin so the bot does not drift off forever.
  fx += (-p.y * 0.00002 - p.x * 0.00001) * 1;
  fy += (p.x * 0.00002 - p.y * 0.00001) * 1;
  const m = Math.hypot(fx, fy);
  return m > 0 ? { mx: fx / m, my: fy / m } : { mx: 0, my: 0 };
}

/**
 * Collector: kites in small loops and sweeps back through its own drops (design.md 12.4).
 * Threat avoidance wins; otherwise it heads for the nearest pickup with no enemy close to it.
 */
function collectorInput(w: World): Input {
  const p = w.player;
  let ax = 0;
  let ay = 0;
  let threat = 0;
  for (const e of w.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 90 * 90 || d2 === 0) continue;
    const d = Math.sqrt(d2);
    const k = (90 - d) / 90;
    ax += (dx / d) * k * k;
    ay += (dy / d) * k * k;
    threat += k * k;
  }
  for (const b of w.enemyBullets) {
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 80 * 80 || d2 === 0) continue;
    const s = Math.sign(b.vx * dy - b.vy * dx) || 1;
    const v = Math.hypot(b.vx, b.vy);
    ax += ((-b.vy / v) * s * 40) / Math.sqrt(d2);
    ay += ((b.vx / v) * s * 40) / Math.sqrt(d2);
    threat += 1;
  }
  const ba = bossAvoid(w, 100);
  ax += ba.x;
  ay += ba.y;
  threat += ba.threat;
  let sx = 0;
  let sy = 0;
  let best = 160 * 160;
  for (const k of w.pickups) {
    const dx = k.x - p.x;
    const dy = k.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= best) continue;
    let blocked = false;
    for (const e of w.enemies) {
      if ((e.x - k.x) ** 2 + (e.y - k.y) ** 2 < 28 * 28) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    best = d2;
    const d = Math.sqrt(d2) || 1;
    sx = dx / d;
    sy = dy / d;
  }
  const c = nearestCrate(w, 240);
  if (c) {
    sx = c.x;
    sy = c.y;
  }
  // Small loop: a tangent around the point the bot is drifting through.
  const a = w.time * 1.4;
  const lx = -Math.sin(a);
  const ly = Math.cos(a);
  const fx = ax * 2.2 + sx * (threat > 0.6 ? 0.3 : 1) + lx * 0.35;
  const fy = ay * 2.2 + sy * (threat > 0.6 ? 0.3 : 1) + ly * 0.35;
  const m = Math.hypot(fx, fy);
  return m > 0 ? { mx: fx / m, my: fy / m } : { mx: 0, my: 0 };
}

// kite-smart: a balanced, DPS-leaning build (the reference skilled player).
const PRIORITY: PerkId[] = [
  'dmg',
  'rof',
  'multishot',
  'pierce',
  'crit',
  'explosive',
  'grenade',
  'drone',
  'cooldown',
  'ricochet',
  'maxhp',
  'armor',
  'regen',
  'move',
  'bspeed',
  'magnet',
];

// cc: a crowd-clear build. It loads the perks that only help a crowd (ricochet chains, multishot spread)
// plus fire rate to feed them, and skimps on the per-hit single-target multipliers (damage, crit). Shows
// the skill-gate boss fights (§16.15): it clears waves fast but, with low single-target damage and no
// dodge skill in the bot, grinds against a single boss.
const PRIORITY_CC: PerkId[] = [
  'ricochet',
  'multishot',
  'rof',
  'drone',
  'explosive',
  'grenade',
  'pierce',
  'move',
  'maxhp',
  'armor',
  'regen',
  'magnet',
  'bspeed',
  'cooldown',
  'crit',
  'dmg',
];

function pick(w: World, bot: Bot): void {
  const pr = bot === 'kite-smart' ? PRIORITY : bot === 'cc' ? PRIORITY_CC : null;
  if (pr) {
    const id = pr.find((p) => w.offer.some((o) => o.id === p)) ?? w.offer[0].id;
    choosePerk(w, id);
  } else {
    choosePerk(w, w.offer[Math.floor(w.rng() * w.offer.length)].id);
  }
}

export interface FightResult {
  target: number; // index into BOSSES
  level: number; // player level at his spawn
  hp: number; // his HP at spawn
  damage: number; // damage dealt to him
  sec: number; // arrival to kill, or to death/timeout (0 if he never became damageable)
  killed: boolean;
  enraged: boolean;
  crates: number; // crates opened before his spawn
  kit: Partial<Record<PerkId, number>>; // crate perks at his spawn
  elites: number; // scheduled elites killed before his spawn
  playerHpPct: number; // the player's HP % when he spawned (design.md 16.13)
}

export interface RunResult {
  seed: number;
  bot: Bot;
  survivedSec: number;
  reachedBoss: boolean; // reached the first fight
  levelAtBoss: number; // level when the contract clock hit the first fight (or at death before it)
  bossKilled: boolean; // contract complete (the Warlord is dead)
  targetsDown: number;
  fights: FightResult[]; // one per target reached, in order (design.md 16.11)
  level: number;
  kills: number;
  scrapPct: number;
  peakEnemies: number;
  peakBullets: number;
  perks: string;
  cratesOpened: number;
  cratesDropped: number;
  waveDmgLate: number; // total HP lost to post-5:00 waves (design.md 16.13)
  waveSecLate: number; // seconds spent in post-5:00 waves (pool these two across runs for a rate)
  stepMsAvg: number;
}

/** Plays `bot` on `w` (picking perks) until `done` is true, the run ends, or maxSec of run time. */
export function playUntil(w: World, bot: Bot, done: (w: World) => boolean, maxSec = 900): void {
  const maxTicks = Math.round(maxSec / DT);
  while (w.tick < maxTicks && w.phase !== 'dead' && !w.won && !done(w)) {
    if (w.phase === 'levelup' || w.phase === 'crate') {
      pick(w, bot);
      continue;
    }
    step(w, bot === 'idle' ? { mx: 0, my: 0 } : bot === 'collector' ? collectorInput(w) : kiteInput(w));
  }
}

/** Long enough for all three fights to reach enrage plus a minute each, and two more minutes. */
const MAX_RUN_SEC = BOSSES[BOSSES.length - 1].atSec + BOSSES.length * (RUN.warningSec + 60 + RUN.enrageFightSec) + 120;

export function runBot(seed: number, bot: Bot, maxSec = MAX_RUN_SEC): RunResult {
  const w = createWorld(seed);
  const maxTicks = Math.round(maxSec / DT);
  const t0 = performance.now();
  let levelAtBoss = 0;
  while (w.tick < maxTicks && w.phase !== 'dead' && !w.won) {
    if (w.contractTime < BOSSES[0].atSec) levelAtBoss = w.level;
    if (w.phase === 'levelup' || w.phase === 'crate') {
      pick(w, bot);
      continue;
    }
    step(w, bot === 'idle' ? { mx: 0, my: 0 } : bot === 'collector' ? collectorInput(w) : kiteInput(w));
  }
  const ms = performance.now() - t0;
  return {
    seed,
    bot,
    survivedSec: w.time,
    reachedBoss: w.fights.length > 0,
    levelAtBoss,
    bossKilled: w.won,
    targetsDown: w.targetsDown,
    fights: w.fights.map((f) => {
      const end = f.killedAt >= 0 ? f.killedAt : w.time;
      return {
        target: f.target,
        level: f.level,
        hp: f.hp,
        damage: f.damage,
        sec: f.arrivedAt < 0 ? 0 : end - f.arrivedAt,
        killed: f.killedAt >= 0,
        enraged: f.arrivedAt >= 0 && end - f.arrivedAt >= RUN.enrageFightSec,
        crates: f.crates,
        kit: f.kit,
        elites: f.elites,
        playerHpPct: f.playerHpPct,
      };
    }),
    level: w.level,
    kills: w.kills,
    scrapPct: (100 * w.scrapCollected) / Math.max(1, w.scrapDropped),
    peakEnemies: w.peakEnemies,
    peakBullets: w.peakBullets,
    cratesOpened: w.cratesOpened,
    cratesDropped: w.cratesDropped,
    waveDmgLate: w.waveDamageLate,
    waveSecLate: w.waveSecLate,
    perks: PERKS.map((d) => `${d.id}${w.stacks[d.id]}`).join(' '),
    stepMsAvg: ms / Math.max(1, w.tick),
  };
}
