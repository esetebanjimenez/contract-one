/**
 * LT. HAMMER's bomb-suit look (design.md 16.15; Artist, art/hammer-redesign). The slam crack decal stays on the sand
 * where each charge stops: full for holdSec, then it fades out over fadeSec.
 */
export const CRATER_LOOK = { holdSec: 2.5, fadeSec: 1, max: 6 };
/** The charge run alternates chargeA/chargeB this fast (quicker than the 180 ms walk, he is sprinting). */
export const HAMMER_CHARGE_FRAME_MS = 110;

/** The crack decal's alpha `age` seconds after the slam. */
export function craterAlpha(age: number): number {
  const { holdSec, fadeSec } = CRATER_LOOK;
  if (age < 0 || age >= holdSec + fadeSec) return 0;
  if (age < holdSec) return 1;
  return 1 - (age - holdSec) / fadeSec;
}

/** He tilts at most this far either side of horizontal (Artist: three-quarter view lit from the top-left). */
export const HAMMER_MAX_TILT = Math.PI / 3;

/**
 * HAMMER's sprite transform (Esteban, PR #59). Facing left he is mirrored around his (40,45) pivot instead of being
 * rotated upside down, and tilted no more than HAMMER_MAX_TILT. Through the open window he keeps the facing of the
 * charge he just finished (the sim already holds it through the windup and the charge).
 */
export function hammerPose(facing: number, chargeDir: number, open: boolean): { mirror: boolean; rotation: number } {
  const f = open ? chargeDir : facing;
  const mirror = Math.cos(f) < 0;
  let t = f - (mirror ? Math.PI : 0);
  t = Math.atan2(Math.sin(t), Math.cos(t)); // into (-pi, pi]
  return { mirror, rotation: Math.max(-HAMMER_MAX_TILT, Math.min(HAMMER_MAX_TILT, t)) };
}
