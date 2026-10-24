export type PerkId =
  'dmg' | 'rof' | 'pierce' | 'multishot' | 'move' | 'maxhp' | 'magnet' | 'crit' | 'bspeed' | 'regen' | 'armor' | 'ricochet';

export interface PerkDef {
  id: PerkId;
  name: string;
  text: string;
  max: number;
  weight: number;
  perStack: number;
  damageType: boolean; // counts toward the damage-perk offer rule
}

/** design.md sections 8 and 13.6 (12 perks). */
export const PERKS: PerkDef[] = [
  { id: 'dmg', name: 'Hollow Points', text: '+15% damage', max: 5, weight: 1, perStack: 0.15, damageType: true },
  { id: 'rof', name: 'Trigger Job', text: '+12% fire rate', max: 5, weight: 1, perStack: 0.12, damageType: true },
  { id: 'pierce', name: 'AP Rounds', text: '+1 pierce', max: 3, weight: 1, perStack: 1, damageType: true },
  { id: 'multishot', name: 'Extra Barrel', text: '+1 projectile', max: 3, weight: 1, perStack: 1, damageType: true },
  { id: 'move', name: 'Light Kit', text: '+8% move speed', max: 4, weight: 1, perStack: 0.08, damageType: false },
  { id: 'maxhp', name: 'Plate Carrier', text: '+20 max HP, heals 20', max: 5, weight: 1, perStack: 20, damageType: false },
  { id: 'magnet', name: 'Scrap Magnet', text: '+30% pickup radius', max: 3, weight: 1, perStack: 0.3, damageType: false },
  { id: 'crit', name: 'Marksman', text: '+5% crit chance (x2 damage)', max: 5, weight: 1, perStack: 0.05, damageType: true },
  { id: 'bspeed', name: 'Hot Loads', text: '+15% bullet speed and range', max: 3, weight: 1, perStack: 0.15, damageType: false },
  { id: 'regen', name: 'Medkit', text: '+1 HP every 2 s', max: 3, weight: 1, perStack: 1, damageType: false },
  { id: 'armor', name: 'Ceramic Plates', text: '-1 damage taken per hit', max: 3, weight: 1, perStack: 1, damageType: false },
  { id: 'ricochet', name: 'Ricochet', text: 'bullets bounce to +1 target', max: 2, weight: 1, perStack: 1, damageType: true },
];

export const PERK_RULES = {
  minDamagePerks: 2, // below this many damage-type stacks, every offer includes one damage perk
  regenIntervalSec: 2,
  critMultiplier: 2,
  ricochetRange: 80,
};
