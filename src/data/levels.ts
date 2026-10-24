/** design.md section 7. */
export const LEVELS = {
  perkChoices: 4, // 2x2 grid (design.md 16.2)
  pickupLifetimeSec: Infinity, // Scrap never despawns (Esteban, 2026-10-24)
};

/** Scrap needed to go from `level` to `level + 1`: 5, 11, 17, ... */
export function scrapForLevel(level: number): number {
  return 5 + 6 * (level - 1);
}
