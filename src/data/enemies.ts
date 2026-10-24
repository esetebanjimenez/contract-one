export interface RangedDef {
  damage: number;
  bulletSpeed: number;
  bulletRange: number;
  stopDistance: number; // stops advancing inside this distance
  aimSec: number; // stop with a muzzle glint before each shot (design.md 16.4)
  moveSec: number; // minimum move time between stops at 0:00
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
    ranged: { damage: 10, bulletSpeed: 95, bulletRange: 420, stopDistance: 140, aimSec: 0.6, moveSec: 2 },
  },
};

/** design.md 12.1: scaling per minute elapsed (m). */
export const SCALING = {
  hpPerMinute: 0.14, // HP x (1 + 0.14 m), fixed at spawn
  contactPerMinute: 0.03, // contact damage x (1 + 0.03 m), at hit time
  rifleMovePerMinute: 0.05, // move time between shots 2.0 - 0.05 m (design.md 16.4)
  rifleMoveMin: 1.4,
};

/** Elite variant of any base type (design.md section 5). */
export const ELITE = { hp: 3, speed: 1.1, contact: 1.5, scrap: 4, rifleSpreadShots: 3, rifleSpreadDeg: 12 };

/** design.md 13.5: px pushed back per player bullet hit. */
export const KNOCKBACK_PX = 4;
export const ENEMY_BULLET_RADIUS = 4; // matches the outlined 8x8 sprite (design.md 15.1)

/**
 * Grunt weapons (Esteban, 2026-10-24): looks only. Every Grunt has the same HP, speed, hitbox and contact
 * damage whatever he carries. Weights are the Designer's split. Each Grunt's weapon comes from a hash of
 * his id, never from the run's RNG, so changing these weights can't move any spawn or sim result.
 */
export type GruntWeapon = 'shovel' | 'baton' | 'sledge';
export const GRUNT_WEAPONS = {
  weights: { shovel: 50, baton: 30, sledge: 20 } as Record<GruntWeapon, number>,
  walkFrameMs: 150, // two walk frames alternate
  // Swing on touch, animation only: the damage lands on the touch with no delay (Designer).
  windupMs: 80,
  strikeMs: 120,
};

/** Weighted pick from a hash of the enemy id: deterministic and independent of the run's RNG. */
export function gruntWeapon(enemyId: number, weights: Record<GruntWeapon, number> = GRUNT_WEAPONS.weights): GruntWeapon {
  let h = Math.imul(enemyId ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  const ids = Object.keys(weights) as GruntWeapon[];
  const total = ids.reduce((s, k) => s + weights[k], 0);
  let roll = ((h >>> 0) / 0x100000000) * total;
  for (const k of ids) {
    roll -= weights[k];
    if (roll < 0) return k;
  }
  return ids[ids.length - 1];
}
