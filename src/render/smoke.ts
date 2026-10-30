/**
 * LT. VIPER's smoke puff look (design.md 16.16; Artist, okayed by Esteban 2026-10-30). The cloud is cover for his
 * teleport, so it holds near-opaque for holdSec, then fades over the rest of VIPER.smoke.fuseSec. The 120 px puff
 * draws at drawScale (240 px, the 120 px radius) and grows from scaleFrom to full size over the fuse.
 */
export const SMOKE_LOOK = { holdSec: 0.6, holdAlpha: 0.9, scaleFrom: 0.6, drawScale: 2 };

/** The puff's alpha `age` seconds after it drops, for a cloud that lasts `fuseSec`. */
export function smokeAlpha(age: number, fuseSec: number): number {
  const { holdSec, holdAlpha } = SMOKE_LOOK;
  if (age < 0 || age >= fuseSec) return 0;
  if (age < holdSec) return holdAlpha;
  return holdAlpha * (1 - (age - holdSec) / (fuseSec - holdSec));
}

/** The sprite scale at `age`: the 2x draw times the 0.6 -> 1.0 growth. */
export function smokeScale(age: number, fuseSec: number): number {
  const k = Math.min(1, Math.max(0, age / fuseSec));
  return SMOKE_LOOK.drawScale * (SMOKE_LOOK.scaleFrom + (1 - SMOKE_LOOK.scaleFrom) * k);
}
