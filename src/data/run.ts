/** Contract timing (design.md 14.1, 14.2, 14.4, 14.5). Seconds of run time unless noted. */
export const RUN = {
  timerRedLastSec: 10, // the countdown turns red-orange for the last 10 s
  inboundLeadSec: 30, // "TARGET INBOUND" banner 0:30 before each fight (contract time); pressure waves and rings stop from here
  inboundBannerSec: 2,
  warningSec: 3, // warning banner when the arena locks, then he walks in
  bossSpawnRateMul: 0.3, // normal spawns at 30% of the 5:00 rate during the fight
  arenaHudPx: 58, // HUD strip height; the arena is the visible world below it (design.md 14.9)
  arenaBandPx: 8, // hazard-tape band; the walls are its inner edge
  arenaGrowSec: 0.5,
  fleeSpeedMul: 1.5,
  enrageFightSec: 120, // each target enrages 2:00 after he is fully on-screen (his own fight clock, design.md 14.3, 16.11)
  // Presentation (real seconds, UI only).
  winSlowMoSec: 1,
  winSlowMoScale: 0.3,
  winResultsDelaySec: 2,
  loseFreezeSec: 0.5,
  loseBannerSec: 1.5,
  resultsInputLockSec: 0.8,
};
