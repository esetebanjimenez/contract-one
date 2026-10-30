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
