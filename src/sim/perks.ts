import { PERK_RULES, PERKS, type PerkId } from '../data/perks';
import { PLAYER } from '../data/player';

export type PerkStacks = Record<PerkId, number>;

export function emptyStacks(): PerkStacks {
  return Object.fromEntries(PERKS.map((d) => [d.id, 0])) as PerkStacks;
}

export interface PlayerStats {
  damage: number;
  fireRate: number;
  pierce: number;
  projectiles: number;
  speed: number;
  maxHp: number;
  magnet: number;
  crit: number;
  bulletSpeed: number;
  bulletRange: number;
  regenPerTick: number; // HP per regen interval
  armor: number;
  ricochet: number;
}

export function computeStats(s: PerkStacks): PlayerStats {
  const p = (id: PerkId) => PERKS.find((d) => d.id === id)!.perStack * s[id];
  return {
    damage: PLAYER.damage * (1 + p('dmg')),
    fireRate: PLAYER.fireRate * (1 + p('rof')),
    pierce: PLAYER.pierce + p('pierce'),
    projectiles: 1 + p('multishot'),
    speed: PLAYER.speed * (1 + p('move')),
    maxHp: PLAYER.hp + p('maxhp'),
    magnet: PLAYER.magnet * (1 + p('magnet')),
    crit: p('crit'),
    bulletSpeed: PLAYER.bulletSpeed * (1 + p('bspeed')),
    bulletRange: PLAYER.bulletRange * (1 + p('bspeed')),
    regenPerTick: p('regen'),
    armor: p('armor'),
    ricochet: p('ricochet'),
  };
}

function drawOne(pool: typeof PERKS, rng: () => number): number {
  const total = pool.reduce((a, d) => a + d.weight, 0);
  let r = rng() * total;
  let i = 0;
  for (; i < pool.length - 1; i++) {
    r -= pool[i].weight;
    if (r < 0) break;
  }
  return i;
}

export function damageStacks(s: PerkStacks): number {
  return PERKS.filter((d) => d.damageType).reduce((a, d) => a + s[d.id], 0);
}

/**
 * Weighted draw without duplicates from perks that are not maxed. While the player has fewer than
 * PERK_RULES.minDamagePerks damage-type stacks, at least one card is a damage perk.
 */
export function drawOffer(stacks: PerkStacks, count: number, rng: () => number): PerkId[] {
  const pool = PERKS.filter((d) => stacks[d.id] < d.max);
  const out: PerkId[] = [];
  if (damageStacks(stacks) < PERK_RULES.minDamagePerks) {
    const dmgPool = pool.filter((d) => d.damageType);
    if (dmgPool.length > 0) {
      const pick = dmgPool[drawOne(dmgPool, rng)];
      out.push(pick.id);
      pool.splice(pool.indexOf(pick), 1);
    }
  }
  while (out.length < count && pool.length > 0) {
    const i = drawOne(pool, rng);
    out.push(pool[i].id);
    pool.splice(i, 1);
  }
  // Shuffle so the guaranteed damage card is not always first.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
