import { MOVE_SOFT, PERK_RULES, PERKS, SPECIAL_ATTACKS, TIER_ODDS, TIERS, perkDef, type PerkId, type TierId } from '../data/perks';
import { PLAYER } from '../data/player';

/** Total effect per perk in display units (e.g. dmg 45 = +45%). */
export type PerkStacks = Record<PerkId, number>;

export interface Offer {
  id: PerkId;
  tier: TierId;
  /** Value actually gained (clipped to the perk's hard limit, if any). */
  value: number;
}

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
  explosive: number; // HE chance, 0..1
  drones: number; // DRONE BUDDY total
  grenades: number; // FRAG OUT total per volley
  damageMul: number; // HOLLOW POINTS factor, also applied to drones and grenades
  fireRateMul: number; // TRIGGER JOB factor, also applied to drones (design.md 16.9)
  cooldownMul: number; // FAST HANDS factor on special-attack cooldowns
}

/** Effective move % after the soft limit (design.md 16.1). */
export function softMove(pct: number): number {
  return pct <= MOVE_SOFT.kneePct ? pct : MOVE_SOFT.kneePct + (pct - MOVE_SOFT.kneePct) * MOVE_SOFT.pastKnee;
}

export function computeStats(s: PerkStacks): PlayerStats {
  const p = (id: PerkId) => perkDef(id).scale * s[id];
  return {
    damage: PLAYER.damage * (1 + p('dmg')),
    fireRate: PLAYER.fireRate * (1 + p('rof')),
    pierce: PLAYER.pierce + p('pierce'),
    projectiles: 1 + p('multishot'),
    speed: PLAYER.speed * (1 + softMove(s.move) * perkDef('move').scale),
    maxHp: PLAYER.hp + p('maxhp'),
    magnet: PLAYER.magnet * (1 + p('magnet')),
    crit: p('crit'),
    bulletSpeed: PLAYER.bulletSpeed * (1 + p('bspeed')),
    bulletRange: PLAYER.bulletRange * (1 + p('bspeed')),
    regenPerTick: p('regen'),
    armor: p('armor'),
    ricochet: p('ricochet'),
    explosive: Math.min(1, p('explosive')),
    drones: p('drone'),
    grenades: p('grenade'),
    damageMul: 1 + p('dmg'),
    fireRateMul: 1 + p('rof'),
    cooldownMul: 1 - p('cooldown'),
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

export function tierOdds(level: number): [number, number, number, number] {
  let odds = TIER_ODDS[0].odds;
  for (const t of TIER_ODDS) if (level >= t.fromLevel) odds = t.odds;
  return odds;
}

export function rollTier(level: number, rng: () => number): TierId {
  const odds = tierOdds(level);
  let r = rng() * odds.reduce((a, b) => a + b, 0);
  for (let i = 0; i < odds.length; i++) {
    r -= odds[i];
    if (r < 0) return TIERS[i].id;
  }
  return 'common';
}

/** Tier and value for one card; a Rare roll on a whole-number perk becomes Common. */
export function makeOffer(id: PerkId, rolled: TierId, stacks: PerkStacks): Offer {
  const d = perkDef(id);
  const tier = d.values[rolled] === null ? 'common' : rolled;
  const value = Math.min(d.values[tier]!, d.maxTotal - stacks[id]);
  return { id, tier, value };
}

/**
 * Weighted draw without duplicates from perks below their max total, each card with its own tier
 * roll. While the player has fewer than PERK_RULES.minDamagePerks damage-type picks, at least one
 * card is a damage perk.
 */
export function drawOffer(stacks: PerkStacks, damagePicks: number, level: number, count: number, rng: () => number): Offer[] {
  const special = SPECIAL_ATTACKS.some((id) => stacks[id] > 0);
  const pool = PERKS.filter((d) => d.pool === 'level' && stacks[d.id] < d.maxTotal && (d.id !== 'cooldown' || special));
  const ids: PerkId[] = [];
  if (damagePicks < PERK_RULES.minDamagePerks) {
    const dmgPool = pool.filter((d) => d.damageType);
    if (dmgPool.length > 0) {
      const pick = dmgPool[drawOne(dmgPool, rng)];
      ids.push(pick.id);
      pool.splice(pool.indexOf(pick), 1);
    }
  }
  while (ids.length < count && pool.length > 0) {
    const i = drawOne(pool, rng);
    ids.push(pool[i].id);
    pool.splice(i, 1);
  }
  // Shuffle so the guaranteed damage card is not always first.
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.map((id) => makeOffer(id, rollTier(level, rng), stacks));
}

/**
 * A supply crate's cards (design.md 16.12): up to `count` different crate perks, drawn evenly, each the
 * perk's fixed crate step with no tier. A perk at its hard limit (HE at 100%) is left out.
 */
export function drawCrateOffer(stacks: PerkStacks, count: number, rng: () => number): Offer[] {
  const pool = PERKS.filter((d) => d.pool === 'crate' && stacks[d.id] < d.maxTotal);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).map((d) => ({ id: d.id, tier: 'common', value: Math.min(d.crateStep!, d.maxTotal - stacks[d.id]) }));
}
