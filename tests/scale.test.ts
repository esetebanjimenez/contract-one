import { describe, expect, it } from 'vitest';
import { integerScale } from '../src/render/scale';
import { createRng } from '../src/sim/rng';

describe('integerScale', () => {
  it('fits whole multiples', () => {
    expect(integerScale(1080, 1920, 360, 640)).toBe(3);
    expect(integerScale(390, 844, 360, 640)).toBe(1);
    expect(integerScale(200, 300, 360, 640)).toBe(1);
  });
});

describe('createRng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    xs.forEach((x) => expect(x).toBeGreaterThanOrEqual(0));
  });
});
