import { describe, expect, it } from 'vitest';
import { BOSS_HIT_FLASH, bossFlashAlpha } from '../src/render/boss-flash';

describe('boss hit flash', () => {
  it('starts at the 0.45 peak on a hit and fades linearly to 0 over 80 ms', () => {
    expect(bossFlashAlpha(0)).toBeCloseTo(0.45);
    expect(bossFlashAlpha(0.04)).toBeCloseTo(0.225);
    expect(bossFlashAlpha(BOSS_HIT_FLASH.sec)).toBe(0);
    expect(bossFlashAlpha(1)).toBe(0);
  });
  it('shows nothing before the first hit', () => {
    expect(bossFlashAlpha(-1)).toBe(0);
  });
  it('never goes above the peak, so hits re-arm it instead of stacking', () => {
    for (let t = 0; t < 0.1; t += 0.005) expect(bossFlashAlpha(t)).toBeLessThanOrEqual(BOSS_HIT_FLASH.peak);
  });
});
