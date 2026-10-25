/** design.md sections 6 and 12. */
export const SPAWN = {
  baseRate: 1.0, // enemies/s at 0:00
  doublingSec: 150, // rate(t) = baseRate x 2^(t / doublingSec) until lateFromSec (contract time)
  lateFromSec: 300, // after 5:00 the rate doubles every lateDoublingSec instead, up to maxRate (design.md 16.11)
  lateDoublingSec: 300,
  maxRate: 10,
  offscreenMin: 24, // px outside the visible area
  offscreenMax: 48,
  pressureEverySec: 60,
  pressureDurationSec: 5,
  pressureMultiplier: 3,
  pressureArcDeg: 90, // pressure spawns come from ahead of the player's movement within this arc
  ringWavesSec: [120, 240, 420, 480, 660, 720], // pressure waves that are full rings (design.md 16.8, 16.11)
  pressureOverCap: 40, // a pressure wave may exceed the enemy cap by this much
  pressureHeavyFromSec: 240,
  pressureHeavyShare: 0.25, // share of Heavies in a pressure ring from 4:00
  maxRiflemen: 30, // ranged cap, veterans and elites included
};

/** Mix weights per time band (design.md 12.2, at half the old times per 16.8). Veteran picks a base type from the same band's other weights. */
export interface SpawnBand {
  fromSec: number;
  weights: { grunt: number; runner: number; heavy: number; rifleman: number; veteran: number };
}

export const SPAWN_BANDS: SpawnBand[] = [
  { fromSec: 0, weights: { grunt: 100, runner: 0, heavy: 0, rifleman: 0, veteran: 0 } },
  { fromSec: 45, weights: { grunt: 75, runner: 25, heavy: 0, rifleman: 0, veteran: 0 } },
  { fromSec: 90, weights: { grunt: 55, runner: 25, heavy: 20, rifleman: 0, veteran: 0 } },
  { fromSec: 135, weights: { grunt: 40, runner: 20, heavy: 20, rifleman: 20, veteran: 0 } },
  { fromSec: 210, weights: { grunt: 30, runner: 20, heavy: 20, rifleman: 20, veteran: 10 } },
  { fromSec: 300, weights: { grunt: 25, runner: 20, heavy: 20, rifleman: 20, veteran: 15 } }, // design.md 16.11
  { fromSec: 540, weights: { grunt: 20, runner: 20, heavy: 20, rifleman: 20, veteran: 20 } },
];
