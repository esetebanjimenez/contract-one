export type PerkId = 'dmg' | 'rof' | 'pierce' | 'multishot' | 'move' | 'maxhp';

export interface PerkDef {
  id: PerkId;
  name: string;
  text: string;
  max: number;
  weight: number;
  perStack: number;
}

/** Vertical slice subset of design.md section 8. */
export const PERKS: PerkDef[] = [
  { id: 'dmg', name: 'Hollow Points', text: '+15% damage', max: 5, weight: 1, perStack: 0.15 },
  { id: 'rof', name: 'Trigger Job', text: '+12% fire rate', max: 5, weight: 1, perStack: 0.12 },
  { id: 'pierce', name: 'AP Rounds', text: '+1 pierce', max: 3, weight: 1, perStack: 1 },
  { id: 'multishot', name: 'Extra Barrel', text: '+1 projectile', max: 3, weight: 1, perStack: 1 },
  { id: 'move', name: 'Light Kit', text: '+8% move speed', max: 4, weight: 1, perStack: 0.08 },
  { id: 'maxhp', name: 'Plate Carrier', text: '+20 max HP, heals 20', max: 5, weight: 1, perStack: 20 },
];
