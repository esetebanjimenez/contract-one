/**
 * Screenshot scenes for CI (never deployed: built only by vite.shots.config.ts).
 * ?scene=levelup | boss | results | grunts fast-forwards a seeded kite-smart run to that screen, then hands it to the game.
 */
import { boot } from '../../src/game';
import { ENEMIES, gruntWeapon, type GruntWeapon } from '../../src/data/enemies';
import { PLAYER } from '../../src/data/player';
import { createWorld, step, type World } from '../../src/sim/world';
import { playUntil } from '../bots';

export type Scene = 'levelup' | 'boss' | 'results' | 'grunts';
const SEED = 7;

function build(scene: Scene): World {
  const w = createWorld(SEED);
  if (scene === 'grunts') {
    // Grunts only until 0:45: a crowd closing in on the merc, so their weapons are easy to check.
    w.player.invuln = 1e9;
    playUntil(w, 'idle', (x) => x.time >= 30);
    w.player.invuln = 0;
    w.player.hp = w.stats.maxHp;
    // A ring of four Grunts per weapon (ids picked by weapon), the inner ones touching so their swing shows.
    const want: Record<GruntWeapon, number> = { shovel: 4, baton: 4, sledge: 4 };
    let n = 0;
    for (let id = 100000; n < 12; id++) {
      const k = gruntWeapon(id);
      if (want[k] === 0) continue;
      want[k]--;
      const a = (n / 12) * Math.PI * 2;
      const r = n % 4 === 0 ? ENEMIES.grunt.radius + PLAYER.hitRadius - 2 : 40 + (n % 3) * 22;
      w.enemies.push({
        id,
        def: ENEMIES.grunt,
        x: w.player.x + Math.cos(a) * r,
        y: w.player.y + Math.sin(a) * r,
        hp: 1e6,
        maxHp: 1e6,
        fireTimer: 0,
        facing: Math.cos(a) > 0 ? -1 : 1,
        elite: false,
        flash: 0,
        aiming: false,
      });
      n++;
    }
    return w;
  }
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
      x.bossArrivedAt >= 0 && x.time >= x.bossArrivedAt + 3 && !!x.boss && Math.hypot(x.boss.x - x.player.x, x.boss.y - x.player.y) < 160,
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
