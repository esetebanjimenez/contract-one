import { describe, expect, it } from 'vitest';
import { ENEMIES, GRUNT_WEAPONS, gruntWeapon, type GruntWeapon } from '../src/data/enemies';
import { PLAYER } from '../src/data/player';
import { createWorld, step } from '../src/sim/world';

describe('grunt weapons (looks only)', () => {
  it('splits close to the data weights', () => {
    const n = 20000;
    const count: Record<GruntWeapon, number> = { shovel: 0, baton: 0, sledge: 0 };
    for (let id = 0; id < n; id++) count[gruntWeapon(id)]++;
    const total = Object.values(GRUNT_WEAPONS.weights).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(count) as GruntWeapon[]) {
      expect(Math.abs(count[k] / n - GRUNT_WEAPONS.weights[k] / total)).toBeLessThan(0.02);
    }
  });

  it('is the same weapon for the same id every time', () => {
    for (let id = 0; id < 100; id++) expect(gruntWeapon(id)).toBe(gruntWeapon(id));
  });

  it("doesn't touch the run's RNG: the same seed plays out the same", () => {
    const a = createWorld(42);
    const b = createWorld(42);
    for (let i = 0; i < 60 * 60; i++) {
      step(a, { mx: 0.3, my: -0.2 });
      for (const e of b.enemies) gruntWeapon(e.id); // extra weapon look-ups must change nothing
      step(b, { mx: 0.3, my: -0.2 });
    }
    expect(b.player.hp).toBe(a.player.hp);
    expect(b.kills).toBe(a.kills);
    expect(b.rng()).toBe(a.rng());
  });

  it('damage lands on the touch, with the swing only as a look', () => {
    const w = createWorld(1);
    w.tick = -1e9; // keep the spawner quiet
    const hp = w.player.hp;
    w.enemies.push({
      id: 1,
      def: ENEMIES.grunt,
      x: w.player.x + ENEMIES.grunt.radius + PLAYER.hitRadius - 2,
      y: w.player.y,
      hp: 1e9,
      maxHp: 1e9,
      fireTimer: 0,
      facing: 1,
      elite: false,
      flash: 0,
      aiming: false,
    });
    step(w, { mx: 0, my: 0 });
    expect(w.player.hp).toBeLessThan(hp); // same tick as the touch, no wind-up delay
    expect(w.enemies[0].swingAt).toBe(w.time);
  });
});
