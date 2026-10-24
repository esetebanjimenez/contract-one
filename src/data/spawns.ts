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
  ringFromSec: 120, // from 2:00, every second wave (2:00, 4:00) is a full ring (design.md 16.8)
  ringEveryNthWave: 2,
  ringWavePhase: 0, // wave n (= floor(t / 60)) is a ring when n % ringEveryNthWave === ringWavePhase
  pressureOverCap: 40, // a pressure wave may exceed the enemy cap by this much
  pressureHeavyFromSec: 240,
  pressureHeavyShare: 0.25, // share of Heavies in a pressure ring from 4:00
  maxRiflemen: 30, // ranged cap, elites included
};

/** Mix weights per time band (design.md 12.2, at half the old times per 16.8). Elite picks a base type from the same band's other weights. */
export interface SpawnBand {
  fromSec: number;
  weights: { grunt: number; runner: number; heavy: number; rifleman: number; elite: number };
}

export const SPAWN_BANDS: SpawnBand[] = [
  { fromSec: 0, weights: { grunt: 100, runner: 0, heavy: 0, rifleman: 0, elite: 0 } },
  { fromSec: 45, weights: { grunt: 75, runner: 25, heavy: 0, rifleman: 0, elite: 0 } },
  { fromSec: 90, weights: { grunt: 55, runner: 25, heavy: 20, rifleman: 0, elite: 0 } },
  { fromSec: 135, weights: { grunt: 40, runner: 20, heavy: 20, rifleman: 20, elite: 0 } },
  { fromSec: 210, weights: { grunt: 30, runner: 20, heavy: 20, rifleman: 20, elite: 10 } },
];
