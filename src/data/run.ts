/** Contract timing (design.md 14.1, 14.2, 14.4, 14.5). Seconds of run time unless noted. */
export const RUN = {
  contractSec: 600, // the Warlord arrives at 10:00
  timerRedLastSec: 10, // the countdown turns red-orange for the last 10 s
  inboundAtSec: 570, // "TARGET INBOUND" banner; pressure waves and rings stop from here
  inboundBannerSec: 2,
  warningSec: 3, // warning banner at 10:00, then he walks in
  bossSpawnRateMul: 0.3, // normal spawns at 30% of the 10:00 rate during the fight
  enrageSec: 720, // 12:00
  // Presentation (real seconds, UI only).
  winSlowMoSec: 1,
  winSlowMoScale: 0.3,
  winResultsDelaySec: 2,
  loseFreezeSec: 0.5,
  loseBannerSec: 1.5,
  resultsInputLockSec: 0.8,
};
