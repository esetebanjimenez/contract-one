import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { scrapForLevel } from '../src/data/levels';
import { CAPS, DT } from '../src/data/sim';
import { drawOffer, emptyStacks } from '../src/sim/perks';
import { createRng } from '../src/sim/rng';
import { choosePerk, createWorld, spawnRate, step } from '../src/sim/world';
import { runBot } from '../tools/bots';

describe('levels and perks', () => {
  it('follows 5 + 6 x (level - 1)', () => {
    expect([1, 2, 3, 4].map(scrapForLevel)).toEqual([5, 11, 17, 23]);
  });
  it('offers 3 distinct perks and drops maxed ones', () => {
    const s = emptyStacks();
    const rng = createRng(3);
    for (let i = 0; i < 50; i++) {
      const o = drawOffer(s, 3, rng);
      expect(new Set(o).size).toBe(3);
    }
    s.pierce = 3;
    s.multishot = 3;
    s.dmg = 5;
    s.rof = 5;
    expect(drawOffer(s, 3, rng).sort()).toEqual(['maxhp', 'move']);
  });
  it('pauses for a level-up and applies the pick', () => {
    const w = createWorld(1);
    w.pickups.push({ x: 0, y: 0, value: 5, age: 0, flying: true });
    step(w, { mx: 0, my: 0 });
    expect(w.phase).toBe('levelup');
    expect(w.offer).toHaveLength(3);
    const id = w.offer[0];
    choosePerk(w, id);
    expect(w.phase).toBe('play');
    expect(w.level).toBe(2);
    expect(w.stacks[id]).toBe(1);
  });
});

describe('sim', () => {
  it('spawn rate doubles every 150 s', () => {
    expect(spawnRate(0)).toBeCloseTo(1.0);
    expect(spawnRate(150)).toBeCloseTo(2.0);
  });
  it('is deterministic for a seed', () => {
    const a = runBot(42, 'kite', 120);
    const b = runBot(42, 'kite', 120);
    expect({ ...a, stepMsAvg: 0 }).toEqual({ ...b, stepMsAvg: 0 });
  });
  it('Riflemen stop at their stop distance and shoot', () => {
    const w = createWorld(2);
    w.player.hp = w.stats.maxHp = 1e9;
    w.tick = -1e9; // keep the spawner quiet
    w.enemies.push({ id: 1, def: ENEMIES.rifleman, x: 300, y: 0, hp: 1e9, maxHp: 1e9, fireTimer: 2, facing: 1 });
    for (let i = 0; i < Math.round(8 / DT); i++) step(w, { mx: 0, my: 0 });
    expect(w.enemies[0].x).toBeGreaterThan(135);
    expect(w.enemies[0].x).toBeLessThan(142);
    expect(w.player.hp).toBeLessThan(1e9);
  });
  it('never exceeds the enemy cap', () => {
    const w = createWorld(5);
    w.player.hp = w.stats.maxHp = 1e9;
    w.tick = 900 * 60;
    for (let i = 0; i < 600; i++) step(w, { mx: 0, my: 0 });
    expect(w.peakEnemies).toBeLessThanOrEqual(CAPS.enemies);
  });
  it('an idle bot with no perks dies before 2:00', () => {
    for (const seed of [1, 2, 3]) {
      const w = createWorld(seed);
      while (w.phase !== 'dead' && w.time < 120) {
        if (w.phase === 'levelup') {
          w.phase = 'play';
          w.pendingLevels = 0;
        }
        step(w, { mx: 0, my: 0 });
      }
      expect(w.phase).toBe('dead');
    }
  });
});
