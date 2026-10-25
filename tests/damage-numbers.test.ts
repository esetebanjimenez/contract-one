import { describe, expect, it } from 'vitest';
import { DAMAGE_NUMBERS as DN, formatDamage } from '../src/data/damage-numbers';
import { BOSS_KEY, addDamageNumber, damageNumberLook, pruneDamageNumbers, type DamageNumber } from '../src/sim/damage-numbers';
import { computeStats } from '../src/sim/perks';
import { ENEMIES } from '../src/data/enemies';
import { createWorld, step } from '../src/sim/world';

const host = () => ({ time: 0, tick: 0, damageNumbers: [] as DamageNumber[] });

describe('damage numbers (16.10)', () => {
  it('formats whole numbers, never 0, k past 9,999, ! on crits', () => {
    expect(formatDamage(0.2, false)).toBe('1');
    expect(formatDamage(12.6, false)).toBe('13');
    expect(formatDamage(9999, false)).toBe('9999');
    expect(formatDamage(10249, true)).toBe('10.2k!');
  });
  it('merges normal hits on one enemy within 0.15 s, never crits', () => {
    const w = host();
    addDamageNumber(w, 5, 0, 0, 10, false);
    w.time = 0.1;
    addDamageNumber(w, 5, 0, 0, 10, false);
    addDamageNumber(w, 5, 0, 0, 20, true);
    addDamageNumber(w, 5, 0, 0, 20, true);
    expect(w.damageNumbers.map((n) => [n.value, n.crit])).toEqual([
      [20, false],
      [20, true],
      [20, true],
    ]);
    w.time = 0.1 + DN.mergeSec + 0.01;
    addDamageNumber(w, 5, 0, 0, 1, false);
    expect(w.damageNumbers.length).toBe(4);
  });
  it('gives the boss a 0.25 s merge window', () => {
    const w = host();
    addDamageNumber(w, BOSS_KEY, 0, 0, 10, false);
    w.time = 0.22;
    addDamageNumber(w, BOSS_KEY, 0, 0, 10, false);
    expect(w.damageNumbers.length).toBe(1);
    expect(w.damageNumbers[0].value).toBe(20);
  });
  it('gives elites the boss window too (design.md 16.12), not normal enemies', () => {
    const w = host();
    addDamageNumber(w, 7, 0, 0, 10, false, true);
    addDamageNumber(w, 8, 0, 0, 10, false);
    w.time = 0.22;
    addDamageNumber(w, 7, 0, 0, 10, false, true);
    addDamageNumber(w, 8, 0, 0, 10, false);
    expect(w.damageNumbers.filter((n) => n.key === 7).length).toBe(1);
    expect(w.damageNumbers.filter((n) => n.key === 8).length).toBe(2);
  });
  it('caps at 40 and drops the oldest first', () => {
    const w = host();
    for (let i = 0; i < 45; i++) {
      w.time = i * 0.001;
      addDamageNumber(w, i, 0, 0, i + 1, false);
    }
    expect(w.damageNumbers.length).toBe(DN.cap);
    expect(w.damageNumbers[0].key).toBe(5);
  });
  it('pops, rises 12 px and fades over the last third, then goes', () => {
    const w = host();
    addDamageNumber(w, 1, 0, 0, 5, false);
    const n = w.damageNumbers[0];
    expect(damageNumberLook(n, 0).scale).toBe(DN.popScale);
    expect(damageNumberLook(n, 0.2).alpha).toBe(1);
    expect(damageNumberLook(n, DN.popSec + DN.riseSec).rise).toBe(DN.risePx);
    expect(damageNumberLook(n, 0.45).alpha).toBeLessThan(1);
    w.time = 0.51;
    pruneDamageNumbers(w);
    expect(w.damageNumbers.length).toBe(0);
  });
  it('shows gun hits in play and one number per HE blast', () => {
    const w = createWorld(3);
    w.player.hp = w.stats.maxHp = 1e9;
    w.spawnAcc = -1e9;
    w.stacks.explosive = 100;
    w.stats = computeStats(w.stacks);
    for (const [x, y] of [
      [60, 0],
      [70, 8],
      [70, -8],
    ])
      w.enemies.push({
        id: w.nextEnemyId++,
        def: { ...ENEMIES.heavy, speed: 0, contactDamage: 0 },
        x,
        y,
        hp: 1e6,
        maxHp: 1e6,
        fireTimer: 9,
        aiming: false,
        facing: 1,
        veteran: false,
        flash: 0,
      });
    for (let i = 0; i < 120 && w.damageNumbers.length === 0; i++) step(w, { mx: 0, my: 0 });
    // The bullet and its blast land on the same enemy and merge; the two neighbours get no number.
    expect(w.damageNumbers.length).toBe(1);
    expect(w.damageNumbers[0].value).toBeCloseTo(w.stats.damage * 1.5, 5);
  });
});
