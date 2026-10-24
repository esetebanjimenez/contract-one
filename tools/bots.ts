import { PERKS, type PerkId } from '../src/data/perks';
import { DT } from '../src/data/sim';
import { choosePerk, createWorld, step, type Input, type World } from '../src/sim/world';

export type Bot = 'idle' | 'kite' | 'kite-smart' | 'collector';

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
  // Small loop: a tangent around the point the bot is drifting through.
  const a = w.time * 1.4;
  const lx = -Math.sin(a);
  const ly = Math.cos(a);
  const fx = ax * 2.2 + sx * (threat > 0.6 ? 0.3 : 1) + lx * 0.35;
  const fy = ay * 2.2 + sy * (threat > 0.6 ? 0.3 : 1) + ly * 0.35;
  const m = Math.hypot(fx, fy);
  return m > 0 ? { mx: fx / m, my: fy / m } : { mx: 0, my: 0 };
}

const PRIORITY: PerkId[] = ['dmg', 'rof', 'multishot', 'pierce', 'crit', 'ricochet', 'maxhp', 'armor', 'regen', 'move', 'bspeed', 'magnet'];

function pick(w: World, bot: Bot): void {
  if (bot === 'kite-smart') {
    const id = PRIORITY.find((p) => w.offer.includes(p))!;
    choosePerk(w, id);
  } else {
    choosePerk(w, w.offer[Math.floor(w.rng() * w.offer.length)]);
  }
}

export interface RunResult {
  seed: number;
  bot: Bot;
  survivedSec: number;
  reachedBoss: boolean;
  level: number;
  kills: number;
  scrapPct: number;
  peakEnemies: number;
  peakBullets: number;
  perks: string;
  stepMsAvg: number;
}

export function runBot(seed: number, bot: Bot, maxSec = 600): RunResult {
  const w = createWorld(seed);
  const maxTicks = Math.round(maxSec / DT);
  const t0 = performance.now();
  while (w.tick < maxTicks && w.phase !== 'dead') {
    if (w.phase === 'levelup') {
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
    reachedBoss: w.phase !== 'dead',
    level: w.level,
    kills: w.kills,
    scrapPct: (100 * w.scrapCollected) / Math.max(1, w.scrapDropped),
    peakEnemies: w.peakEnemies,
    peakBullets: w.peakBullets,
    perks: PERKS.map((d) => `${d.id}${w.stacks[d.id]}`).join(' '),
    stepMsAvg: ms / Math.max(1, w.tick),
  };
}
