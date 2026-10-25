/** Boss hit flash (Artist, okayed by Esteban): a white overlay inside the outline, at its peak alpha on a hit, fading to 0. */
export const BOSS_HIT_FLASH = { peak: 0.45, sec: 0.08 };

/** The overlay's alpha `since` seconds after the last hit: linear from the peak to 0. Each hit re-arms it, so it never stacks. */
export function bossFlashAlpha(since: number): number {
  return since < 0 ? 0 : Math.max(0, BOSS_HIT_FLASH.peak * (1 - since / BOSS_HIT_FLASH.sec));
}
