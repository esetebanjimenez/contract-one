/**
 * Screenshot scenes for CI (never deployed: built only by vite.shots.config.ts).
 * ?scene=levelup | boss | results fast-forwards a seeded kite-smart run to that screen, then hands it to the game.
 */
import { boot } from '../../src/game';
import { createWorld, step, type World } from '../../src/sim/world';
import { playUntil } from '../bots';

export type Scene = 'levelup' | 'boss' | 'results';
const SEED = 7;

function build(scene: Scene): World {
  const w = createWorld(SEED);
  if (scene === 'levelup') {
    // A mid-run kit, then one more level-up so the cards and the YOUR KIT strip show.
    playUntil(w, 'kite-smart', (x) => x.time >= 150);
    w.pendingLevels = 1;
    step(w, { mx: 0, my: 0 });
    return w;
  }
  w.player.invuln = 1e9; // survive to the fight whatever the seed does
  // Into the fight, with the Warlord close enough to share the screen.
  playUntil(
    w,
    'kite-smart',
    (x) =>
      x.bossArrivedAt >= 0 &&
      x.time >= x.bossArrivedAt + 3 &&
      !!x.boss &&
      Math.hypot(x.boss.x - x.player.x, x.boss.y - x.player.y) < 160,
  );
  if (scene === 'results') {
    // Kill him: the game plays the outro and shows the results screen.
    w.bossDamage += w.boss!.hp;
    w.boss!.hp = 0;
    w.won = true;
    w.wonAt = w.time;
  }
  w.player.invuln = 0;
  w.player.hp = w.stats.maxHp;
  return w;
}

const scene = (new URLSearchParams(location.search).get('scene') ?? 'levelup') as Scene;
const world = build(scene);
const g = window as unknown as { __world: World; __ready: boolean };
g.__world = world;
void boot(() => world).then(() => setTimeout(() => (g.__ready = true), 300));
