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
  ranged?: RangedDef;
}

/** design.md section 5. M1 slice: Grunt and Rifleman only. */
export const ENEMIES: Record<string, EnemyDef> = {
  grunt: { id: 'grunt', hp: 10, speed: 45, contactDamage: 8, scrap: 1, radius: 8 },
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

/** All enemy HP is multiplied by 1 + hpPerMinute x minutes elapsed. */
export const ENEMY_HP_PER_MINUTE = 0.08;
export const ENEMY_BULLET_RADIUS = 3;
