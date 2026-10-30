import { describe, expect, it } from 'vitest';
import { SMOKE_LOOK, smokeAlpha, smokeScale } from '../src/render/smoke';
import { VIPER } from '../src/data/boss';

describe("VIPER's smoke puff (design.md 16.16)", () => {
  const f = VIPER.smoke.fuseSec;
  it('holds at 90% for the first 0.6 s so he is hidden, then fades to nothing by the end of the fuse', () => {
    expect(smokeAlpha(0, f)).toBe(0.9);
    expect(smokeAlpha(0.59, f)).toBe(0.9);
    expect(smokeAlpha(0.6 + (f - 0.6) / 2, f)).toBeCloseTo(0.45);
    expect(smokeAlpha(f, f)).toBe(0);
    expect(smokeAlpha(f - 0.01, f)).toBeGreaterThan(0);
  });
  it('draws the 120 px puff at 2x, growing from 0.6 to full size', () => {
    expect(smokeScale(0, f)).toBeCloseTo(1.2);
    expect(smokeScale(f, f)).toBeCloseTo(2);
    expect(120 * smokeScale(f, f)).toBe(2 * VIPER.smoke.radiusPx);
    expect(SMOKE_LOOK.holdSec).toBeLessThan(f);
  });
});
