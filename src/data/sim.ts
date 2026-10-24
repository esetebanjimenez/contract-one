/** Fixed simulation step. Rendering runs at display rate and never changes sim results. */
export const SIM_HZ = 60;
export const DT = 1 / SIM_HZ;

/** Soft caps (benchmarked by `pnpm bench`). Past the enemy cap, spawning recycles the farthest enemy. */
export const CAPS = { enemies: 250, playerBullets: 400, enemyBullets: 400, pickups: 300 };

/** Spatial hash cell size in px, used for bullet hits and enemy separation. */
export const GRID_CELL = 32;

/** Push apart overlapping enemies (fraction of overlap resolved per step). */
export const SEPARATION = 0.35;
