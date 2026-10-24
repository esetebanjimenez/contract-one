/** The Warlord (design.md 14.3). */
export const BOSS = {
  name: 'THE WARLORD',
  hpBase: 2000,
  hpPerLevel: 0, // flat 2000 at every level (design.md 14.3, rerun 2); formula kept for later tuning
  hpLevelRef: 20,
  hpMin: 2000,
  hpMax: 5000,
  radius: 30,
  speed: 35,
  contactDamage: 20, // not scaled by 12.1
  entryOffscreenPx: 120, // spawns this far above the top edge; undamageable until fully on-screen
  charge: { everySec: 5, telegraphSec: 0.8, distance: 300, speed: 140, damage: 25 },
  ring: { bullets: 16, gapBullets: 2, everySec: 3, speed: 90, damage: 10, range: 700 },
  phase2Below: 0.66,
  phase3Below: 0.33,
  phase3: { adds: 12, addsEverySec: 8, ringEverySec: 2, chargeEverySec: 3.5 },
  staggerSec: 1, // phase change: no attacks, white flash, enemy bullets cleared
  enrage: { ringEverySec: 1.0, speedMul: 1.5 },
};

export function bossHp(level: number): number {
  const hp = BOSS.hpBase * (1 + BOSS.hpPerLevel * (level - BOSS.hpLevelRef));
  return Math.min(BOSS.hpMax, Math.max(BOSS.hpMin, hp));
}
