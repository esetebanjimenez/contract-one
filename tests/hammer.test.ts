import { describe, expect, it } from 'vitest';
import { CRATER_LOOK, HAMMER_MAX_TILT, HAMMER_MAX_TILT_UP, craterAlpha, hammerPose } from '../src/render/hammer';

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
  it('mirrors instead of rotating upside down when he faces left', () => {
    expect(hammerPose(Math.PI, 0, false)).toEqual({ mirror: true, rotation: 0 });
    expect(hammerPose(0, 0, false)).toEqual({ mirror: false, rotation: 0 });
    expect(hammerPose(Math.PI - 0.3, 0, false).rotation).toBeCloseTo(-0.3);
  });
  it('leans at most 60 degrees facing down and 15 facing up', () => {
    expect(hammerPose(Math.PI / 2, 0, false).rotation).toBeCloseTo(HAMMER_MAX_TILT); // down, unmirrored
    expect(hammerPose(Math.PI / 2 + 0.01, 0, false)).toEqual({ mirror: true, rotation: -HAMMER_MAX_TILT }); // down-left
    expect(hammerPose(-Math.PI / 2, 0, false).rotation).toBeCloseTo(-HAMMER_MAX_TILT_UP); // up, unmirrored
    expect(hammerPose(-Math.PI / 2 - 0.01, 0, false)).toEqual({ mirror: true, rotation: HAMMER_MAX_TILT_UP }); // up-left
  });
  it('keeps the charge facing through the open window', () => {
    expect(hammerPose(0, Math.PI, true).mirror).toBe(true);
    expect(hammerPose(Math.PI, 0, true).mirror).toBe(false);
  });
});
