/** The Warlord (design.md 14.3). */
export const BOSS = {
  name: 'THE WARLORD',
  hpDpsSec: 40, // HP = 40 x the player's single-target sheet DPS at spawn (design.md 16.5)
  hpExtraBulletWeight: 0.5,
  hpMin: 2000, // no upper clamp
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

export interface DpsStats {
  damage: number;
  fireRate: number; // shots/s
  projectiles: number;
  crit: number; // chance, 0..1
}

/**
 * Single-target sheet DPS (design.md 16.5): damage x shots/s x (1 + 0.5 x extra bullets) x crit factor.
 * Extra bullets count half since many miss one target. Pierce and ricochet don't count.
 */
export function sheetDps(s: DpsStats, critMultiplier: number): number {
  return s.damage * s.fireRate * (1 + BOSS.hpExtraBulletWeight * (s.projectiles - 1)) * (1 + Math.min(1, s.crit) * (critMultiplier - 1));
}

export function bossHp(s: DpsStats, critMultiplier: number): number {
  return Math.max(BOSS.hpMin, Math.round(BOSS.hpDpsSec * sheetDps(s, critMultiplier)));
}
