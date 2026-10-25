import { DRONE, EXPLOSIVE, GRENADE, overflow } from './perks';

/** The three targets of a contract (design.md 16.11), in order, on the contract clock. */
export interface Target {
  name: string; // working name, shown on the boss bar
  atSec: number; // contract time of the fight (the clock pauses during it)
  hpDpsSec: number; // HP = this x the player's single-target sheet DPS at spawn (design.md 16.5)
  damageScale: number; // charge, bullet and mine damage (contact damage is set per attack style)
  final: boolean; // killing him ends the contract
  style: 'charger' | 'gunner'; // which attack set he fights with (the Warlord's own schedule is part 3)
}

export const BOSSES: Target[] = [
  { name: 'LT. HAMMER', atSec: 300, hpDpsSec: 40, damageScale: 1, final: false, style: 'charger' },
  { name: 'LT. VIPER', atSec: 540, hpDpsSec: 50, damageScale: 1.25, final: false, style: 'gunner' },
  // Until part 3 of 16.11 the Warlord fights like LT. HAMMER, with his own HP and damage.
  { name: 'THE WARLORD', atSec: 780, hpDpsSec: 60, damageScale: 1.5, final: true, style: 'charger' },
];

/**
 * LT. VIPER, the gunner (design.md 16.11). Bullet and mine damage are base values, times his damage
 * scale; contact damage 25 is the spec's number as written. Phase rules, stagger and walls as 14.3/14.9.
 */
export const VIPER = {
  holdPx: 160, // keeps about this far from the player
  holdSlackPx: 15, // stands still within holdPx +/- this
  speed: 45,
  contactDamage: 25,
  // Phase 1+: the aim line tracks, locks, then the burst fires down it.
  burst: { firstAfterSec: 1, everySec: 2.5, trackSec: 0.6, lockSec: 0.2, bullets: 3, shotGapSec: 0.08, speed: 160, damage: 12, range: 700 },
  // Phase 2+: a fan toward the player, alternating with the burst (never fired while a burst is aiming or firing).
  fan: { everySec: 4, firstAfterSec: 2, bullets: 7, spreadDeg: 60, speed: 100, damage: 12, range: 700 },
  // Phase 3: mines dropped behind him, and Runners from the arena edges with no Scrap.
  // Mines sit wider apart than the trigger, so stepping on one sets off only that one.
  mines: { everySec: 6, count: 3, behindPx: 24, spacingPx: 36, armSec: 1, triggerPx: 30, radiusPx: 30, damage: 25, fuseSec: 10 },
  adds: { count: 8, everySec: 8 },
};

/** On a lieutenant kill (design.md 16.11). The slow-mo is real seconds (UI); the rest is run time. */
export const LIEUTENANT_DOWN = {
  slowMoSec: 0.5,
  slowMoScale: 0.3,
  bannerSec: 2,
  tapeFadeSec: 0.5, // then the camera unlocks and waves resume
  scrapPieces: 8, // the one-level Scrap pile, split so it lands as a clump (16.3)
  scrapSpreadPx: 10,
};

/** Body and attacks (design.md 14.3), shared by every target for now. */
export const BOSS = {
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
  explosive?: number; // HE chance, 0..1
  drones?: number;
  grenades?: number;
  damageMul?: number; // HOLLOW POINTS factor for drones and grenades
  fireRateMul?: number; // TRIGGER JOB factor, for drones (design.md 16.9)
  cooldownMul?: number; // FAST HANDS factor on special-attack cooldowns
}

/**
 * Single-target sheet DPS (design.md 16.5, 16.7, 16.9): gun DPS = damage x shots/s x (1 + 0.5 x extra
 * bullets) x (1 + HE share x HE chance). Drones are secondary shooters, so the same formula with
 * drone damage and drone shots/s x the fire-rate factor. Grenades divide by the cooldown. All times the
 * crit factor. Extra bullets count half since many miss one target. Pierce and ricochet don't count.
 */
export function sheetDps(s: DpsStats, critMultiplier: number): number {
  const crit = 1 + Math.min(1, s.crit) * (critMultiplier - 1);
  const he = 1 + EXPLOSIVE.damageShare * Math.min(1, s.explosive ?? 0);
  const shot = (1 + BOSS.hpExtraBulletWeight * (s.projectiles - 1)) * he;
  const gun = s.damage * s.fireRate * shot;
  const mul = s.damageMul ?? 1;
  const d = overflow(s.drones ?? 0, DRONE.maxBodies, DRONE.overflowBonus);
  const g = overflow(s.grenades ?? 0, GRENADE.maxPerVolley, GRENADE.overflowBonus);
  const drones = d.count * DRONE.damage * d.mul * mul * DRONE.shotsPerSec * (s.fireRateMul ?? 1) * shot;
  const grenades = (g.count * GRENADE.damage * g.mul * mul) / (GRENADE.cooldownSec * (s.cooldownMul ?? 1));
  return (gun + drones + grenades) * crit;
}

export function bossHp(s: DpsStats, critMultiplier: number, hpDpsSec = BOSSES[0].hpDpsSec): number {
  return Math.max(BOSS.hpMin, Math.round(hpDpsSec * sheetDps(s, critMultiplier)));
}
