import { PERKS, type PerkId } from '../data/perks';
import { PLAYER } from '../data/player';

export type PerkStacks = Record<PerkId, number>;

export function emptyStacks(): PerkStacks {
  return { dmg: 0, rof: 0, pierce: 0, multishot: 0, move: 0, maxhp: 0 };
}

export interface PlayerStats {
  damage: number;
  fireRate: number;
  pierce: number;
  projectiles: number;
  speed: number;
  maxHp: number;
}

export function computeStats(s: PerkStacks): PlayerStats {
  const p = (id: PerkId) => PERKS.find((d) => d.id === id)!.perStack;
  return {
    damage: PLAYER.damage * (1 + p('dmg') * s.dmg),
    fireRate: PLAYER.fireRate * (1 + p('rof') * s.rof),
    pierce: PLAYER.pierce + p('pierce') * s.pierce,
    projectiles: 1 + p('multishot') * s.multishot,
    speed: PLAYER.speed * (1 + p('move') * s.move),
    maxHp: PLAYER.hp + p('maxhp') * s.maxhp,
  };
}

/** Weighted draw without duplicates from perks that are not maxed. */
export function drawOffer(stacks: PerkStacks, count: number, rng: () => number): PerkId[] {
  const pool = PERKS.filter((d) => stacks[d.id] < d.max);
  const out: PerkId[] = [];
  while (out.length < count && pool.length > 0) {
    const total = pool.reduce((a, d) => a + d.weight, 0);
    let r = rng() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= pool[i].weight;
      if (r < 0) break;
    }
    out.push(pool[i].id);
    pool.splice(i, 1);
  }
  return out;
}
