export type PerkId =
  'dmg' | 'rof' | 'pierce' | 'multishot' | 'move' | 'maxhp' | 'magnet' | 'crit' | 'bspeed' | 'regen' | 'armor' | 'ricochet';

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
  },
];

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

export function perkDef(id: PerkId): PerkDef {
  return PERKS.find((d) => d.id === id)!;
}

export function effectText(d: PerkDef, v: number): string {
  return d.text.replace('{v}', String(v)).replace('{s}', v === 1 ? '' : 's');
}
