/** design.md sections 6 and 12. */
export const SPAWN = {
  baseRate: 1.0, // enemies/s at 0:00
  doublingSec: 150, // rate(t) = baseRate x 2^(t / doublingSec)
  offscreenMin: 24, // px outside the visible area
  offscreenMax: 48,
  pressureEverySec: 60,
  pressureDurationSec: 5,
  pressureMultiplier: 3,
  pressureArcDeg: 90, // pressure spawns come from ahead of the player's movement within this arc
  ringFromSec: 180, // from 3:00, every second wave (3:00, 5:00, 7:00, 9:00) is a full ring
  ringEveryNthWave: 2,
  pressureOverCap: 40, // a pressure wave may exceed the enemy cap by this much
  pressureHeavyFromSec: 300,
  pressureHeavyShare: 0.25, // share of Heavies in a pressure ring from 5:00
  maxRiflemen: 30, // ranged cap, elites included
};

/** Mix weights per time band (design.md 12.2). Elite picks a base type from the same band's other weights. */
export interface SpawnBand {
  fromSec: number;
  weights: { grunt: number; runner: number; heavy: number; rifleman: number; elite: number };
}

export const SPAWN_BANDS: SpawnBand[] = [
  { fromSec: 0, weights: { grunt: 100, runner: 0, heavy: 0, rifleman: 0, elite: 0 } },
  { fromSec: 90, weights: { grunt: 75, runner: 25, heavy: 0, rifleman: 0, elite: 0 } },
  { fromSec: 180, weights: { grunt: 55, runner: 25, heavy: 20, rifleman: 0, elite: 0 } },
  { fromSec: 270, weights: { grunt: 40, runner: 20, heavy: 20, rifleman: 20, elite: 0 } },
  { fromSec: 420, weights: { grunt: 25, runner: 20, heavy: 20, rifleman: 20, elite: 10 } },
];
