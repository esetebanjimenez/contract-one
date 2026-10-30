import { describe, expect, it } from 'vitest';
import { CRATER_LOOK, craterAlpha } from '../src/render/hammer';

describe("HAMMER's slam crack decal (design.md 16.15)", () => {
  it('stays full where he hit, then fades out', () => {
    expect(craterAlpha(0)).toBe(1);
    expect(craterAlpha(CRATER_LOOK.holdSec - 0.01)).toBe(1);
    expect(craterAlpha(CRATER_LOOK.holdSec + CRATER_LOOK.fadeSec / 2)).toBeCloseTo(0.5);
    expect(craterAlpha(CRATER_LOOK.holdSec + CRATER_LOOK.fadeSec)).toBe(0);
    expect(craterAlpha(-1)).toBe(0);
  });
});
