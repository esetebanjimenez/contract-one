import { DRONE, EXPLOSIVE, GRENADE, overflow } from './perks';

/** The three targets of a contract (design.md 16.11), in order, on the contract clock. */
export interface Target {
  name: string; // working name, shown on the boss bar
  atSec: number; // contract time of the fight (the clock pauses during it)
  hp: number; // fixed HP (design.md 16.15): a skill gate, not a multiple of sheet DPS (§16.5) or a schedule (§16.14)
  damageScale: number; // charge, bullet and mine damage (contact damage is set per attack style)
  final: boolean; // killing him ends the contract
  style: 'charger' | 'gunner' | 'warlord'; // which attack set he fights with
  radius: number; // body and hit radius, px (scales with his sprite: 30 for 96x96)
}

// design.md 16.15: bosses are skill gates, not DPS checks, so HP is a fixed number sized to "N clean skill
// windows" — the same wall for every build and level, player-independent. It no longer rides sheet DPS
// (§16.5) or a contract-stage schedule (§16.14, retired). The main playtest lever for each fight's length.
export const BOSSES: Target[] = [
  { name: 'LT. HAMMER', atSec: 300, hp: 9000, damageScale: 1, final: false, style: 'charger', radius: 30 },
  { name: 'LT. VIPER', atSec: 540, hp: 13000, damageScale: 1.25, final: false, style: 'gunner', radius: 26 },
  { name: 'THE WARLORD', atSec: 780, hp: 20000, damageScale: 1.5, final: true, style: 'warlord', radius: 40 }, // 128x128
];

/**
 * THE WARLORD, both styles (design.md 16.11): LT. HAMMER's charge and ring plus LT. VIPER's burst,
 * fan and mines on a schedule. Contact damage 30 is the spec's number as written; the rest take x1.5.
 */
export const WARLORD = {
  contactDamage: 30,
  attackEverySec: 3, // phase 1+: charge and aimed burst take turns, one every 3 s
  firstAttackSec: 1,
  ringEverySec: 3, // phase 2+, every phase (enrage still goes to 1 s)
  adds: { grunts: 8, runners: 4, everySec: 8 }, // phase 3
  chargeMines: 1, // phase 3: dropped where each charge starts
  // ARTILLERY CALL (design.md 16.11): his own attack, makes standing still punishable. Not in phase 1.
  // He stops in a throw pose, then target circles appear: one on the player, the rest 80-140 px away,
  // never overlapping each other or a mine. Each fills inward over fillSec, then explodes over its radius.
  // design.md 16.15: the survival window. ARTILLERY CALL comes often, with more and bigger circles that
  // cover most of the arena, funnelling the player through shrinking safe pockets. Circles never overlap
  // each other or a mine (the `clear` check), so there is always a walkable gap between them — the fairness
  // guarantee. A spot that can't be placed is skipped, which self-limits coverage and keeps the gaps.
  artillery: {
    everySec: { 2: 5, 3: 3.5 } as Record<2 | 3, number>,
    throwSec: 0.4, // throw pose before the circles drop
    fillSec: 1.5, // the ring fills inward, then explodes
    grenadeSec: 0.4, // a grenade arcs in from him over the last of the fill
    circles: { 2: 5, 3: 8 } as Record<2 | 3, number>,
    radiusPx: 22, // the circle is 44 px across
    minPx: 80, // the extra circles land this far from the player ...
    maxPx: 200, // ... out to here, inside the arena walls
    damage: 20, // x his damageScale (1.5) = 30 per circle; Ceramic Plates applies
    chargePushbackSec: 1, // a throw pushes his next charge back; the timer also pauses during a charge
    placeTries: 40, // attempts to find a non-overlapping spot for each extra circle
  },
};

/**
 * LT. VIPER, the gunner (design.md 16.11). Bullet and mine damage are base values, times his damage
 * scale; contact damage 25 is the spec's number as written. Phase rules, stagger and walls as 14.3/14.9.
 */
export const VIPER = {
  // design.md 16.15: the sniper keeps his distance and snipes — a big hold so the player has to chase him
  // down. He can't kite through a wall, so the skill is cornering him through his own mine trail.
  holdPx: 240, // keeps about this far from the player
  holdSlackPx: 15, // stands still within holdPx +/- this
  speed: 45,
  contactDamage: 25,
  // Phase 1+: the aim line tracks, locks, then the burst fires down it.
  burst: { firstAfterSec: 1, everySec: 2.5, trackSec: 0.6, lockSec: 0.2, bullets: 3, shotGapSec: 0.08, speed: 160, damage: 12, range: 700 },
  // Phase 2+: a fan toward the player, alternating with the burst (never fired while a burst is aiming or firing).
  fan: { everySec: 4, firstAfterSec: 2, bullets: 7, spreadDeg: 60, speed: 100, damage: 12, range: 700 },
  // design.md 16.15: a mine trail dropped behind him as he backs off, from phase 1 (not just phase 3), so
  // the player can't walk a straight line at him. Mines sit wider apart than the trigger, so stepping on
  // one sets off only that one. Phase 3 also brings Runners from the arena edges with no Scrap.
  mines: { everySec: 6, count: 3, behindPx: 24, spacingPx: 36, armSec: 1, triggerPx: 30, radiusPx: 30, damage: 25, fuseSec: 10 },
  adds: { count: 8, everySec: 8 },
};

/** On a lieutenant kill (design.md 16.11). The slow-mo is real seconds (UI); the rest is run time. */
export const LIEUTENANT_DOWN = {
  slowMoSec: 0.5,
  slowMoScale: 0.3,
  bannerSec: 2,
  tapeFadeSec: 0.5, // then the camera unlocks and waves resume
  cameraEaseSec: 0.4, // the camera eases from the arena view back onto the merc; spawns hold until it lands
  scrapPieces: 8, // the one-level Scrap pile, split so it lands as a clump (16.3)
  scrapSpreadPx: 10,
};

/** LT. HAMMER's body and attacks (design.md 14.3); the Warlord reuses them. Radius is per target. */
export const BOSS = {
  hpExtraBulletWeight: 0.5,
  hpMin: 2000, // no upper clamp
  speed: 35,
  contactDamage: 20, // not scaled by 12.1
  entryOffscreenPx: 120, // spawns this far above the top edge; undamageable until fully on-screen
  // design.md 16.15: HAMMER the brawler charges often, with a short telegraph, fast — the pressure that
  // makes him a dodge test. The Warlord reuses these numbers as part of his finale.
  charge: { everySec: 3.5, telegraphSec: 0.6, distance: 300, speed: 190, damage: 25 },
  ring: { bullets: 16, gapBullets: 2, everySec: 3, speed: 90, damage: 10, range: 700 },
  // design.md 16.15: the armor window. The charger (HAMMER only) takes `mul` of all damage while guarded,
  // and full damage during the `recoverSec` window after a charge ends (he overshoots and is exposed). So
  // you earn damage by surviving a charge and punishing the recovery; reduced-not-immune keeps a weak build
  // chipping and never makes the fight a hard DPS wall. Not applied to the gunner or the Warlord.
  guard: { mul: 0.25, recoverSec: 1.2 },
  phase2Below: 0.66,
  phase3Below: 0.33,
  phase3: { adds: 12, addsEverySec: 8, ringEverySec: 2, chargeEverySec: 2.5 },
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

/**
 * Single-target sheet DPS x a seconds multiplier. No longer the boss HP driver (bosses use fixed skill-gate
 * HP, design.md 16.15); kept as the elite floor (§16.13) and the measure of a build's single-target output.
 */
export function bossHp(s: DpsStats, critMultiplier: number, hpDpsSec = 40): number {
  return Math.max(BOSS.hpMin, Math.round(hpDpsSec * sheetDps(s, critMultiplier)));
}
