export interface RangedDef {
  intervalSec: number;
  damage: number;
  bulletSpeed: number;
  bulletRange: number;
  stopDistance: number; // stops advancing inside this distance
  telegraphSec: number; // muzzle flash before each shot
}

export interface EnemyDef {
  id: string;
  hp: number;
  speed: number;
  contactDamage: number;
  scrap: number;
  radius: number; // collision radius in px
  knockbackImmune?: boolean;
  groupMin?: number; // arrives in groups from the same edge
  groupMax?: number;
  ranged?: RangedDef;
}

/** design.md sections 5 and 12. */
export const ENEMIES: Record<string, EnemyDef> = {
  grunt: { id: 'grunt', hp: 10, speed: 45, contactDamage: 8, scrap: 1, radius: 8 },
  runner: { id: 'runner', hp: 6, speed: 95, contactDamage: 6, scrap: 1, radius: 8, groupMin: 3, groupMax: 5 },
  heavy: { id: 'heavy', hp: 60, speed: 30, contactDamage: 15, scrap: 5, radius: 12, knockbackImmune: true },
  rifleman: {
    id: 'rifleman',
    hp: 25,
    speed: 40,
    contactDamage: 8,
    scrap: 3,
    radius: 9,
    ranged: { intervalSec: 2, damage: 10, bulletSpeed: 140, bulletRange: 420, stopDistance: 140, telegraphSec: 0.3 },
  },
};

/** design.md 12.1: scaling per minute elapsed (m). */
export const SCALING = {
  hpPerMinute: 0.12, // HP x (1 + 0.12 m), fixed at spawn
  contactPerMinute: 0.03, // contact damage x (1 + 0.03 m), at hit time
  rifleIntervalPerMinute: 0.08, // fire interval 2.0 - 0.08 m
  rifleIntervalMin: 1.2,
};

/** Elite variant of any base type (design.md section 5). */
export const ELITE = { hp: 3, speed: 1.1, contact: 1.5, scrap: 4, rifleSpreadShots: 3, rifleSpreadDeg: 12 };

/** design.md 13.5: px pushed back per player bullet hit. */
export const KNOCKBACK_PX = 4;
export const ENEMY_BULLET_RADIUS = 3;
