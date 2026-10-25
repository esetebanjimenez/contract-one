export type PerkId =
  | 'dmg'
  | 'rof'
  | 'pierce'
  | 'multishot'
  | 'move'
  | 'maxhp'
  | 'magnet'
  | 'crit'
  | 'bspeed'
  | 'regen'
  | 'armor'
  | 'ricochet'
  | 'explosive'
  | 'drone'
  | 'grenade'
  | 'cooldown';

export type TierId = 'common' | 'rare' | 'epic' | 'mythic';
export type PerkCategory = 'attack' | 'defence' | 'utility';

export interface PerkDef {
  id: PerkId;
  /** Flavour name on the card (design.md 15.2, Esteban 2026-10-24). Never show the icon without it. */
  name: string;
  /** Effect line; {v} is the value gained. {s} is "s" unless {v} is 1. */
  text: string;
  /** Value per tier in display units (% or whole numbers); null = no Rare version, rolls as Common. */
  values: Record<TierId, number | null>;
  /** Hard limit on the total effect, display units (design.md 16.1: only crit has one). Excess is lost. */
  maxTotal: number;
  /** Display units to sim units (0.01 for percentages). */
  scale: number;
  weight: number;
  damageType: boolean; // counts toward the damage-perk offer rule
  category: PerkCategory;
  /** design.md 16.12: 'crate' perks are only offered by supply crates, never at level-ups. */
  pool: 'level' | 'crate';
  /** Crate perks: the fixed gain per crate pick (display units, no tiers). */
  crateStep?: number;
}

/** design.md 16.1: move speed gains past +60% count at half value. */
export const MOVE_SOFT = { kneePct: 60, pastKnee: 0.5 };

const pct = (c: number, r: number, e: number, m: number) => ({ common: c, rare: r, epic: e, mythic: m });
const whole = { common: 1, rare: null, epic: 2, mythic: 3 };

/** design.md 15.2 (12 perks with tiers). */
export const PERKS: PerkDef[] = [
  {
    id: 'dmg',
    name: 'HOLLOW POINTS',
    text: '+{v}% damage',
    values: pct(15, 23, 30, 45),
    maxTotal: Infinity,
    scale: 0.01,
    weight: 1,
    damageType: true,
    category: 'attack',
    pool: 'level',
  },
  {
    id: 'rof',
    name: 'TRIGGER JOB',
    text: '+{v}% fire rate',
    values: pct(12, 18, 24, 36),
    maxTotal: Infinity,
    scale: 0.01,
    weight: 1,
    damageType: true,
    category: 'attack',
    pool: 'level',
  },
  {
    id: 'pierce',
    name: 'AP ROUNDS',
    text: '+{v} pierce',
    values: whole,
    maxTotal: Infinity,
    scale: 1,
    weight: 1,
    damageType: true,
    category: 'attack',
    pool: 'level',
  },
  {
    id: 'multishot',
    name: 'EXTRA BARREL',
    text: '+{v} bullet{s}',
    values: whole,
    maxTotal: Infinity,
    scale: 1,
    weight: 1,
    damageType: true,
    category: 'attack',
    pool: 'crate',
    crateStep: 1,
  },
  {
    id: 'move',
    name: 'LIGHT KIT',
    text: '+{v}% move speed',
    values: pct(8, 12, 16, 24),
    maxTotal: Infinity,
    scale: 0.01,
    weight: 1,
    damageType: false,
    category: 'utility',
    pool: 'level',
  },
  {
    id: 'maxhp',
    name: 'PLATE CARRIER',
    text: '+{v} max HP, heal',
    values: pct(20, 30, 40, 60),
    maxTotal: Infinity,
    scale: 1,
    weight: 1,
    damageType: false,
    category: 'defence',
    pool: 'level',
  },
  {
    id: 'magnet',
    name: 'SCRAP MAGNET',
    text: '+{v}% magnet',
    values: pct(30, 45, 60, 90),
    maxTotal: Infinity,
    scale: 0.01,
    weight: 1,
    damageType: false,
    category: 'utility',
    pool: 'level',
  },
  {
    id: 'crit',
    name: 'MARKSMAN',
    text: '+{v}% crit',
    values: pct(5, 8, 10, 15),
    maxTotal: 100, // stops at 100%, then leaves the draw
    scale: 0.01,
    weight: 1,
    damageType: true,
    category: 'attack',
    pool: 'level',
  },
  {
    id: 'bspeed',
    name: 'HOT LOADS',
    text: '+{v}% speed/range',
    values: pct(15, 23, 30, 45),
    maxTotal: Infinity,
    scale: 0.01,
    weight: 1,
    damageType: false,
    category: 'utility',
    pool: 'level',
  },
  {
    id: 'regen',
    name: 'MEDKIT',
    text: '+{v} HP per 2s',
    values: whole,
    maxTotal: Infinity,
    scale: 1,
    weight: 1,
    damageType: false,
    category: 'defence',
    pool: 'level',
  },
  {
    id: 'armor',
    name: 'CERAMIC PLATES',
    text: '-{v} dmg per hit',
    values: whole,
    maxTotal: Infinity,
    scale: 1,
    weight: 1,
    damageType: false,
    category: 'defence',
    pool: 'level',
  },
  {
    id: 'ricochet',
    name: 'RICOCHET',
    text: '+{v} bounce{s}',
    values: whole,
    maxTotal: Infinity,
    scale: 1,
    weight: 1,
    damageType: true,
    category: 'attack',
    pool: 'level',
  },
  // design.md 16.7: normal tiers, no caps except HE stops at 100%.
  {
    id: 'explosive',
    name: 'HE ROUNDS',
    text: '+{v}% explode',
    values: pct(10, 15, 20, 30),
    maxTotal: 100, // stops at 100%, then leaves the draw
    scale: 0.01,
    weight: 1,
    damageType: true,
    category: 'attack',
    pool: 'crate',
    crateStep: 15,
  },
  {
    id: 'drone',
    name: 'DRONE BUDDY',
    text: '+{v} drone{s}',
    values: whole,
    maxTotal: Infinity,
    scale: 1,
    weight: 0.6,
    damageType: true,
    category: 'utility',
    pool: 'crate',
    crateStep: 1,
  },
  {
    id: 'grenade',
    name: 'FRAG OUT',
    text: '+{v} grenade{s}',
    values: whole,
    maxTotal: Infinity,
    scale: 1,
    weight: 0.6,
    damageType: true,
    category: 'attack',
    pool: 'crate',
    crateStep: 1,
  },
  // design.md 16.9: special-attack cooldown. Picks multiply, so the stack holds the combined cut.
  {
    id: 'cooldown',
    name: 'FAST HANDS',
    text: '-{v}% cooldown',
    values: pct(10, 15, 20, 30),
    maxTotal: Infinity,
    scale: 0.01,
    weight: 0.6,
    damageType: false,
    category: 'utility',
    pool: 'level',
  },
];

/** Supply crates (design.md 16.12): elite gap in seconds of contract time, cards per crate. Crates never expire. */
export const CRATE = {
  eliteGapSec: 90, // after the first elite crate, an elite drops one only this long after the last crate from any source
  cards: 3,
  touchRadius: 14, // the player walks over it; the Scrap magnet never pulls it
};

/** The four perks only supply crates give (design.md 16.12). */
export const CRATE_PERKS: readonly PerkId[] = PERKS.filter((d) => d.pool === 'crate').map((d) => d.id);

/** Perks that multiply instead of add (design.md 16.9): new total = 100 - (100 - total) x (1 - v / 100). */
export const MULTIPLICATIVE: ReadonlySet<PerkId> = new Set<PerkId>(['cooldown']);

/** Special attacks (design.md 16.9): FAST HANDS is only offered once the player owns one. */
export const SPECIAL_ATTACKS: readonly PerkId[] = ['grenade'];

/** The stack after gaining v of perk id. */
export function addStack(id: PerkId, total: number, v: number): number {
  return MULTIPLICATIVE.has(id) ? 100 - (100 - total) * (1 - v / 100) : total + v;
}

export interface TierDef {
  id: TierId;
  name: string;
  color: string;
}

/** Approved tier colours (frame and title bar). Mythic also twinkles. */
export const TIERS: TierDef[] = [
  { id: 'common', name: 'COMMON', color: '#9AA0A6' },
  { id: 'rare', name: 'RARE', color: '#3D6BFF' },
  { id: 'epic', name: 'EPIC', color: '#A44DFF' },
  { id: 'mythic', name: 'MYTHIC', color: '#FFC233' },
];

/** Tier odds (Common/Rare/Epic/Mythic %) by player level, design.md 15.2. */
export const TIER_ODDS: { fromLevel: number; odds: [number, number, number, number] }[] = [
  { fromLevel: 1, odds: [70, 25, 5, 0] },
  { fromLevel: 6, odds: [55, 30, 12, 3] },
  { fromLevel: 16, odds: [40, 33, 20, 7] },
];

export const PERK_RULES = {
  minDamagePerks: 2, // below this many damage-type picks, every offer includes one damage perk
  regenIntervalSec: 2,
  critMultiplier: 2,
  ricochetRange: 80,
};

/** HE ROUNDS (design.md 16.7): a hit that explodes deals this share of its damage to everything in the radius. */
export const EXPLOSIVE = { radius: 32, damageShare: 0.5 };

/** DRONE BUDDY (design.md 16.7). Past maxBodies, each extra drone adds overflowBonus damage to all drones. */
export const DRONE = {
  orbitPx: 28,
  orbitRadPerSec: 2,
  damage: 5,
  shotsPerSec: 2,
  maxBodies: 8,
  overflowBonus: 0.125,
  range: 220, // same reach as the merc's targeting
};

/** FRAG OUT (design.md 16.7, 16.9: a special attack on a cooldown). Past maxPerVolley, each extra grenade adds overflowBonus damage to the volley. */
export const GRENADE = {
  cooldownSec: 4, // before FAST HANDS
  damage: 40,
  radius: 48,
  maxPerVolley: 8,
  overflowBonus: 0.125,
  flightSec: 0.5, // thrown from the merc, explodes where it lands
};

/** Bodies drawn and the damage multiplier from overflow, for drones and grenades. */
export function overflow(n: number, max: number, bonus: number): { count: number; mul: number } {
  return { count: Math.min(max, n), mul: 1 + bonus * Math.max(0, n - max) };
}

export function perkDef(id: PerkId): PerkDef {
  return PERKS.find((d) => d.id === id)!;
}

export function effectText(d: PerkDef, v: number): string {
  return d.text.replace('{v}', String(v)).replace('{s}', v === 1 ? '' : 's');
}
