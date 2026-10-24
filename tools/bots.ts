import { PERKS, type PerkId } from '../src/data/perks';
import { DT } from '../src/data/sim';
import { choosePerk, createWorld, step, type Input, type World } from '../src/sim/world';

export type Bot = 'idle' | 'kite' | 'kite-smart';

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

const PRIORITY: PerkId[] = ['dmg', 'rof', 'pierce', 'multishot', 'maxhp', 'move'];

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
    step(w, bot === 'idle' ? { mx: 0, my: 0 } : kiteInput(w));
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
