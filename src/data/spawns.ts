/** design.md section 6. */
export const SPAWN = {
  baseRate: 1.0, // enemies/s at 0:00
  doublingSec: 150, // rate(t) = baseRate x 2^(t / doublingSec)
  offscreenMin: 24, // px outside the visible area
  offscreenMax: 48,
  pressureEverySec: 60,
  pressureDurationSec: 5,
  pressureMultiplier: 3,
  pressureArcDeg: 60, // pressure spawns come from one direction within this arc
};

export interface SpawnEntry {
  type: string;
  unlockSec: number;
  startWeight: number;
  weightPerMinute: number;
  maxWeight: number;
}

/** Mix weights. A newly unlocked type starts at 20% and grows. */
export const SPAWN_TABLE: SpawnEntry[] = [
  { type: 'grunt', unlockSec: 0, startWeight: 1, weightPerMinute: 0, maxWeight: 1 },
  { type: 'rifleman', unlockSec: 270, startWeight: 0.2, weightPerMinute: 0.1, maxWeight: 0.5 },
];
