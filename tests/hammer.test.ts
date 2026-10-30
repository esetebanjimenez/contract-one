import { describe, expect, it } from 'vitest';
import { CRATER_LOOK, craterAlpha, hammerRotation } from '../src/render/hammer';

describe("HAMMER's slam crack decal (design.md 16.15)", () => {
  it('stays full where he hit, then fades out', () => {
    expect(craterAlpha(0)).toBe(1);
    expect(craterAlpha(CRATER_LOOK.holdSec - 0.01)).toBe(1);
    expect(craterAlpha(CRATER_LOOK.holdSec + CRATER_LOOK.fadeSec / 2)).toBeCloseTo(0.5);
    expect(craterAlpha(CRATER_LOOK.holdSec + CRATER_LOOK.fadeSec)).toBe(0);
    expect(craterAlpha(-1)).toBe(0);
  });
});

describe("HAMMER's facing (PR #59)", () => {
  it('rotates freely to face the player', () => {
    expect(hammerRotation(Math.PI, 0, false)).toBe(Math.PI);
    expect(hammerRotation(-Math.PI / 2, 0, false)).toBe(-Math.PI / 2);
  });
  it('keeps the charge facing through the open window', () => {
    expect(hammerRotation(0, Math.PI, true)).toBe(Math.PI);
  });
});
