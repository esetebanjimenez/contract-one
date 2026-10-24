/** Damage numbers (design.md 16.10, look by the Artist, okayed by Esteban 2026-10-24). Looks only. */
export const DAMAGE_NUMBERS = {
  mergeSec: 0.15, // normal hits on one enemy within this add into one number
  bossMergeSec: 0.25,
  cap: 40, // on screen; the oldest goes first
  popSec: 0.06,
  popScale: 1.2,
  riseSec: 0.5,
  risePx: 12,
  fadeFrom: 2 / 3, // fades over the last third
  jitterPx: 6, // random sideways offset at spawn
  abovePx: 6, // spawns this far above the top of the body
  outline: '#14110F',
  normal: { color: '#FFFFFF', px: 8 },
  crit: { color: '#FFC21C', px: 16 },
};

/** Whole number, never 0; over 9,999 as "10.2k". Crits add "!". */
export function formatDamage(v: number, crit: boolean): string {
  const r = Math.max(1, Math.round(v));
  const s = r > 9999 ? `${(Math.floor(r / 100) / 10).toFixed(1)}k` : String(r);
  return crit ? `${s}!` : s;
}
