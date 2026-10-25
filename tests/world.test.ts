import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { scrapForLevel } from '../src/data/levels';
import { CAPS, DT } from '../src/data/sim';
import { SPAWN } from '../src/data/spawns';
import { DRONE, GRENADE, PERKS, addStack } from '../src/data/perks';
import { computeStats, drawOffer, softMove, emptyStacks, makeOffer, rollTier } from '../src/sim/perks';
import { createRng } from '../src/sim/rng';
import { BOSSES, LIEUTENANT_DOWN, VIPER, bossHp } from '../src/data/boss';
import { PLAYER } from '../src/data/player';
import { checkPhase, createBoss, updateBoss, type Boss, type BossHost, type Mine } from '../src/sim/boss';
import {
  choosePerk,
  createWorld,
  inPressureWave,
  isRingWave,
  killEnemy,
  clumpPickups,
  fullyOnScreen,
  rifleMoveSec,
  riflemenAlive,
  spawnRate,
  step,
  volleyTargets,
  type World,
} from '../src/sim/world';
import { runBot } from '../tools/bots';

/** Jump the run clock and the contract clock together (they only differ once a fight has been fought). */
function setClock(w: World, tick: number): void {
  w.tick = tick;
  w.contractTicks = tick;
}

/** One tick before target `i`'s fight: the next step locks the arena. */
function toFight(w: World, i: number): void {
  setClock(w, Math.round(BOSSES[i].atSec / DT) - 1);
  w.target = i;
  w.targetsDown = i;
}

describe('perk tiers', () => {
  it('scales values by tier and turns Rare whole-number rolls into Common', () => {
    const s = emptyStacks();
    expect(makeOffer('dmg', 'rare', s)).toEqual({ id: 'dmg', tier: 'rare', value: 23 });
    expect(makeOffer('dmg', 'mythic', s).value).toBe(45);
    expect(makeOffer('pierce', 'rare', s)).toEqual({ id: 'pierce', tier: 'common', value: 1 });
    expect(makeOffer('pierce', 'epic', s).value).toBe(2);
  });
  it('has no caps except crit, clipped at 100%', () => {
    const s = emptyStacks();
    s.ricochet = 50;
    s.dmg = 600;
    s.crit = 98;
    expect(makeOffer('ricochet', 'mythic', s).value).toBe(3);
    expect(makeOffer('dmg', 'epic', s).value).toBe(30);
    expect(makeOffer('crit', 'common', s).value).toBe(2);
  });
  it('rolls tiers by level', () => {
    const rng = createRng(5);
    const count = (lv: number) => {
      const c = { common: 0, rare: 0, epic: 0, mythic: 0 };
      for (let i = 0; i < 4000; i++) c[rollTier(lv, rng)]++;
      return c;
    };
    const low = count(3);
    expect(low.mythic).toBe(0);
    expect(low.common / 4000).toBeCloseTo(0.7, 1);
    const high = count(20);
    expect(high.mythic / 4000).toBeCloseTo(0.07, 1);
    expect(high.epic / 4000).toBeCloseTo(0.2, 1);
  });
});

describe('levels and perks', () => {
  it('follows 5 + 6 x (level - 1)', () => {
    expect([1, 2, 3, 4].map(scrapForLevel)).toEqual([5, 11, 17, 23]);
  });
  it('offers 4 distinct perks, with no caps except crit at 100%', () => {
    const s = emptyStacks();
    const rng = createRng(3);
    for (let i = 0; i < 50; i++) {
      const o = drawOffer(s, 2, 1, 4, rng);
      expect(new Set(o.map((x) => x.id)).size).toBe(4);
    }
    for (const d of PERKS) s[d.id] = 1000;
    s.crit = 100;
    for (let i = 0; i < 50; i++) {
      const o = drawOffer(s, 2, 1, 4, rng);
      expect(o).toHaveLength(4);
      expect(o.some((x) => x.id === 'crit')).toBe(false);
    }
    expect(makeOffer('crit', 'mythic', { ...s, crit: 95 }).value).toBe(5);
  });
  it('counts move speed past +60% at half value', () => {
    expect(softMove(40)).toBe(40);
    expect(softMove(60)).toBe(60);
    expect(softMove(100)).toBe(80);
  });
  it('guarantees a damage perk while the player has fewer than 2', () => {
    const rng = createRng(9);
    const s = emptyStacks();
    for (let i = 0; i < 200; i++) {
      expect(drawOffer(s, 1, 1, 3, rng).some((o) => PERKS.find((d) => d.id === o.id)!.damageType)).toBe(true);
    }
    expect(drawOffer(s, 2, 1, 3, rng).length).toBe(3);
  });
  it('armor reduces hits to a minimum of 1 and regen heals every 2 s', () => {
    const w = createWorld(1);
    w.stacks.armor = 3;
    w.stacks.regen = 1;
    w.stats = computeStats(w.stacks);
    expect(w.stats.armor).toBe(3);
    w.player.hp = 50;
    for (let i = 0; i < 2 * 60 + 1; i++) {
      w.enemies.length = 0;
      step(w, { mx: 0, my: 0 });
    }
    expect(w.player.hp).toBe(51);
  });
  it('past the pickup cap, drops add their value to the grounded piece nearest the kill, with a pop', () => {
    const w = createWorld(1);
    while (w.enemies.length === 0) step(w, { mx: 0, my: 0 });
    w.pickups.length = 0;
    const e = w.enemies[0];
    for (let i = 0; i < CAPS.pickups; i++) w.pickups.push({ x: 3000, y: 3000, value: 1, age: 0, flying: false, cache: false, pop: 0 });
    w.pickups[5].x = e.x + 10;
    w.pickups[5].y = e.y;
    w.pickups[6].x = e.x + 1;
    w.pickups[6].y = e.y;
    w.pickups[6].flying = true;
    killEnemy(w, 0);
    expect(w.pickups).toHaveLength(CAPS.pickups);
    expect(w.pickups[6].value).toBe(1);
    expect(w.pickups[5].value).toBeGreaterThan(1);
    expect(w.pickups[5].pop).toBeGreaterThan(0);
    expect(w.pickups[0].value).toBe(1);
    expect(w.scrap).toBe(0);
  });
  it('pauses for a level-up and applies the pick', () => {
    const w = createWorld(1);
    w.pickups.push({ x: 0, y: 0, value: 5, age: 0, flying: true, cache: false, pop: 0 });
    step(w, { mx: 0, my: 0 });
    expect(w.phase).toBe('levelup');
    expect(w.offer).toHaveLength(4);
    const { id, value } = w.offer[0];
    choosePerk(w, id);
    expect(w.phase).toBe('play');
    expect(w.level).toBe(2);
    expect(w.stacks[id as keyof typeof w.stacks]).toBe(value);
  });
});

describe('sim', () => {
  it('spawn rate doubles every 150 s', () => {
    expect(spawnRate(0)).toBeCloseTo(1.0);
    expect(spawnRate(150)).toBeCloseTo(2.0);
  });
  it('is deterministic for a seed', () => {
    const a = runBot(42, 'kite', 120);
    const b = runBot(42, 'kite', 120);
    expect({ ...a, stepMsAvg: 0 }).toEqual({ ...b, stepMsAvg: 0 });
  });
  it('Riflemen stop at their stop distance and shoot', () => {
    const w = createWorld(2);
    w.player.hp = w.stats.maxHp = 1e9;
    setClock(w, -1e9); // keep the spawner quiet
    w.enemies.push({
      id: 1,
      def: ENEMIES.rifleman,
      x: 300,
      y: 0,
      hp: 1e9,
      maxHp: 1e9,
      fireTimer: 2,
      facing: 1,
      elite: false,
      flash: 0,
      aiming: false,
    });
    for (let i = 0; i < Math.round(12 / DT); i++) step(w, { mx: 0, my: 0 });
    expect(w.enemies[0].x).toBeGreaterThan(135);
    expect(w.enemies[0].x).toBeLessThan(146);
    expect(w.player.hp).toBeLessThan(1e9);
  });
  it('never exceeds the enemy cap plus the pressure-wave overflow', () => {
    const w = createWorld(5);
    w.player.hp = w.stats.maxHp = 1e9;
    setClock(w, 900 * 60);
    for (let i = 0; i < 600; i++) step(w, { mx: 0, my: 0 });
    expect(w.peakEnemies).toBeLessThanOrEqual(CAPS.enemies + SPAWN.pressureOverCap);
  });
  it('an idle bot with no perks dies before 2:00', () => {
    for (const seed of [1, 2, 3]) {
      const w = createWorld(seed);
      while (w.phase !== 'dead' && w.time < 120) {
        if (w.phase === 'levelup') {
          w.phase = 'play';
          w.pendingLevels = 0;
        }
        step(w, { mx: 0, my: 0 });
      }
      expect(w.phase).toBe('dead');
    }
  });
  it('scales the Rifleman move time between stops down to 1.4 s', () => {
    expect(rifleMoveSec(0)).toBeCloseTo(2);
    expect(rifleMoveSec(300)).toBeCloseTo(1.75);
    expect(rifleMoveSec(720)).toBeCloseTo(1.4);
    expect(rifleMoveSec(900)).toBeCloseTo(1.4);
  });
  it('Riflemen stop 0.6 s with a glint before firing, and never fire while off-screen', () => {
    const w = createWorld(2);
    w.player.hp = w.stats.maxHp = 1e9;
    setClock(w, -1e9);
    w.enemies.push({
      id: 1,
      def: ENEMIES.rifleman,
      x: 120,
      y: 0,
      hp: 1e9,
      maxHp: 1e9,
      fireTimer: 0,
      facing: 1,
      elite: false,
      flash: 0,
      aiming: false,
    });
    step(w, { mx: 0, my: 0 });
    const e = w.enemies[0];
    expect(e.aiming).toBe(true);
    for (let i = 0; i < Math.round(0.5 / DT); i++) step(w, { mx: 0, my: 0 });
    expect(e.aiming).toBe(true);
    expect(w.enemyBullets).toHaveLength(0);
    for (let i = 0; i < Math.round(0.2 / DT); i++) step(w, { mx: 0, my: 0 });
    expect(w.enemyBullets).toHaveLength(1);
    expect(e.aiming).toBe(false);
    // Off-screen: never stops to aim.
    const far = createWorld(2);
    setClock(far, -1e9);
    far.enemies.push({
      id: 1,
      def: ENEMIES.rifleman,
      x: 2000,
      y: 0,
      hp: 1e9,
      maxHp: 1e9,
      fireTimer: 0,
      facing: 1,
      elite: false,
      flash: 0,
      aiming: false,
    });
    expect(fullyOnScreen(far, far.enemies[0])).toBe(false);
    step(far, { mx: 0, my: 0 });
    expect(far.enemies[0].aiming).toBe(false);
  });
  it('keeps at most 30 Riflemen and replaces Grunts at the cap late in the run', () => {
    const w = createWorld(9);
    w.player.hp = w.stats.maxHp = 1e9;
    setClock(w, 240 * 60);
    for (let i = 0; i < 1800; i++) step(w, { mx: 0, my: 0 });
    expect(riflemenAlive(w)).toBeLessThanOrEqual(SPAWN.maxRiflemen);
    expect(w.enemies.some((e) => e.elite)).toBe(true);
    expect(w.enemies.some((e) => e.def.id === 'heavy')).toBe(true);
  });
  it('makes the waves at 2:00, 4:00, 7:00, 8:00, 11:00 and 12:00 full rings', () => {
    expect([60, 120, 180, 240, 360, 420, 480, 600, 660, 720].map((t) => isRingWave(t + 1))).toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
      true,
      false,
      true,
      true,
    ]);
  });
});

describe('M3 contract', () => {
  const godMode = (seed: number) => {
    const w = createWorld(seed);
    w.player.hp = w.stats.maxHp = 1e9;
    return w;
  };
  const run = (w: ReturnType<typeof createWorld>, sec: number) => {
    for (let i = 0; i < Math.round(sec / DT); i++) {
      if (w.phase === 'levelup') {
        w.phase = 'play';
        w.pendingLevels = 0;
      }
      step(w, { mx: 0, my: 0 });
    }
  };
  it('sets boss HP to 40x sheet DPS at spawn, extra bullets at half, minimum 2000, no upper clamp', () => {
    expect(bossHp({ damage: PLAYER.damage, fireRate: PLAYER.fireRate, projectiles: 1, crit: 0 }, 2)).toBe(2000);
    expect(bossHp({ damage: 20, fireRate: 10, projectiles: 4, crit: 0.5 }, 2)).toBe(40 * 20 * 10 * 2.5 * 1.5);
    expect(bossHp({ damage: 1000, fireRate: 10, projectiles: 10, crit: 1 }, 2)).toBe(40 * 1000 * 10 * 5.5 * 2);
  });
  it('stops pressure waves 0:30 before each fight and skips the fight minute', () => {
    expect(inPressureWave(241)).toBe(true);
    expect(inPressureWave(271)).toBe(false);
    expect(inPressureWave(301)).toBe(false);
    expect(inPressureWave(361)).toBe(true);
    expect(inPressureWave(511)).toBe(false);
    expect(inPressureWave(541)).toBe(false);
    expect(inPressureWave(721)).toBe(true);
    expect(inPressureWave(751)).toBe(false);
  });
  it('spawns the target after the 3 s warning, off-screen and undamageable until he is in view', () => {
    const w = godMode(3);
    toFight(w, 0);
    run(w, 2.9);
    expect(w.arena).not.toBeNull();
    expect(w.boss).toBeNull();
    run(w, 0.2);
    expect(w.boss).not.toBeNull();
    expect(w.boss!.damageable).toBe(false);
    run(w, 10);
    expect(w.boss!.damageable).toBe(true);
    expect(w.bossArrivedAt).toBeGreaterThan(303);
  });
  it('staggers and clears enemy bullets on a phase change', () => {
    const w = godMode(4);
    toFight(w, 0);
    run(w, 10);
    const b = w.boss!;
    w.enemyBullets.push({ ...w.player, vx: 1, vy: 0 } as unknown as (typeof w.enemyBullets)[number]);
    b.hp = b.maxHp * 0.6;
    checkPhase(b, {
      time: w.time,
      stats: w.stats,
      level: w.level,
      player: w.player,
      enemyBullets: w.enemyBullets,
      arena: null,
      mines: w.mines,
      hitPlayer: () => {},
      spawnAddsRing: () => {},
    });
    expect(b.phase).toBe(2);
    expect(b.state).toBe('stagger');
    expect(w.enemyBullets.length).toBe(0);
  });
  it('wins on the Warlord kill: other enemies die with no Scrap and the boss bar stops', () => {
    const w = godMode(5);
    toFight(w, 2);
    run(w, 10);
    w.boss!.hp = 1;
    w.boss!.x = w.player.x + 60;
    w.boss!.y = w.player.y;
    for (const e of w.enemies) e.x += 1000; // nothing closer than the boss to target
    const pickups = w.pickups.length;
    for (let i = 0; i < 600 && !w.won; i++) run(w, DT);
    expect(w.won).toBe(true);
    expect(w.enemies.length).toBe(0);
    expect(w.enemyBullets.length).toBe(0);
    expect(w.pickups.length).toBeLessThanOrEqual(pickups + 2);
    expect(w.bossDamage).toBeGreaterThan(0);
    expect(w.targetsDown).toBe(3);
    const kills = w.kills;
    run(w, 2);
    expect(w.enemies.length).toBe(0);
    expect(w.kills).toBe(kills);
  });
  it('locks the arena at 5:00: enemies flee and despawn, spawns stop, the player is walled in', () => {
    const w = godMode(6);
    setClock(w, Math.round(299.9 / DT));
    run(w, 0.05);
    expect(w.arena).toBeNull();
    run(w, 0.1);
    const a = w.arena!;
    expect(a).not.toBeNull();
    expect(a.x1 - a.x0).toBe(360 - 16);
    expect(w.enemies.every((e) => e.fleeing)).toBe(true);
    expect(w.enemyBullets.length).toBe(0);
    run(w, 3);
    expect(w.enemies.filter((e) => !e.fleeing).length).toBe(0);
    for (let i = 0; i < 300; i++) step(w, { mx: 1, my: 1 });
    expect(w.player.x).toBeLessThanOrEqual(a.x1);
    expect(w.player.y).toBeLessThanOrEqual(a.y1);
    run(w, 6);
    expect(w.enemies.some((e) => e.fleeing)).toBe(false);
    expect(w.boss!.damageable).toBe(true);
    expect(w.boss!.y).toBeGreaterThanOrEqual(a.y0);
  });
  it('clumps 8+ grounded pieces within 24 px into one at their centre', () => {
    const w = createWorld(3);
    w.pickups.length = 0;
    for (let i = 0; i < 8; i++) w.pickups.push({ x: 100 + i * 2, y: 50, value: 1, age: 0, flying: false, cache: false, pop: 0 });
    for (let i = 0; i < 7; i++) w.pickups.push({ x: 400 + i * 2, y: 50, value: 1, age: 0, flying: false, cache: false, pop: 0 });
    clumpPickups(w);
    expect(w.pickups).toHaveLength(8);
    expect(w.pickups[0]).toMatchObject({ x: 107, y: 50, value: 8 });
    expect(w.pickups[0].pop).toBeGreaterThan(0);
  });
});

describe('16.7 attack perks', () => {
  const quiet = (seed = 1) => {
    const w = createWorld(seed);
    w.player.hp = w.stats.maxHp = 1e9;
    w.spawnAcc = -1e9; // no spawns
    return w;
  };
  const place = (w: ReturnType<typeof createWorld>, x: number, y: number, hp = 1000) => {
    const e = {
      id: w.nextEnemyId++,
      def: ENEMIES.heavy,
      x,
      y,
      hp,
      maxHp: hp,
      fireTimer: 9,
      aiming: false,
      facing: 1 as const,
      elite: false,
      flash: 0,
    };
    w.enemies.push(e);
    return e;
  };
  it('rolls drone and grenade like whole-number perks, HE like crit, and stops HE at 100%', () => {
    const s = emptyStacks();
    expect(makeOffer('drone', 'rare', s)).toEqual({ id: 'drone', tier: 'common', value: 1 });
    expect(makeOffer('grenade', 'mythic', s).value).toBe(3);
    expect(makeOffer('explosive', 'epic', s).value).toBe(20);
    s.explosive = 90;
    expect(makeOffer('explosive', 'mythic', s).value).toBe(10);
    s.explosive = 100;
    for (let i = 0; i < 50; i++) expect(drawOffer(s, 5, 20, 4, createRng(i)).some((o) => o.id === 'explosive')).toBe(false);
  });
  it('explodes every hit at 100% HE: half damage to neighbours within 32 px', () => {
    const w = quiet();
    w.stacks.explosive = 100;
    w.stats = computeStats(w.stacks);
    const a = place(w, 60, 0);
    const b = place(w, 80, 0);
    for (let i = 0; i < 120 && a.hp === 1000; i++) step(w, { mx: 0, my: 0 });
    const hit = 1000 - a.hp;
    expect(hit).toBeCloseTo(w.stats.damage * 1.5, 5); // the hit plus its own blast
    expect(1000 - b.hp).toBeCloseTo(w.stats.damage * 0.5, 5);
    expect(w.blasts.some((x) => x.kind === 'he')).toBe(true);
  });
  it('draws at most 8 drones; extra ones add 12.5% damage each', () => {
    const w = quiet();
    w.stacks.drone = 10;
    w.stats = computeStats(w.stacks);
    place(w, 0, 100, 1e6);
    for (let i = 0; i < 60; i++) step(w, { mx: 0, my: 0 });
    expect(w.drones.length).toBe(8);
    const shot = w.bullets.find((b) => b.damage !== w.stats.damage);
    expect(shot?.damage).toBeCloseTo(DRONE.damage * 1.25, 5);
  });
  it('throws grenades at the densest cluster and blasts 40 dmg in 48 px', () => {
    const w = quiet();
    w.stacks.grenade = 1;
    w.stats = computeStats(w.stacks);
    for (let i = 0; i < 5; i++) place(w, -80 + i * 6, 60);
    const lone = place(w, 90, -60);
    w.grid.clear();
    w.enemies.forEach((e, i) => w.grid.insert(i, e.x, e.y));
    const t = volleyTargets(w, 1)[0];
    expect(t.x).toBeLessThan(-40);
    for (let i = 0; i < Math.round((GRENADE.flightSec + 0.2) / DT); i++) step(w, { mx: 0, my: 0 });
    const cluster = w.enemies.filter((e) => e !== lone && e.y === 60);
    expect(cluster.every((e) => e.hp <= 1000 - GRENADE.damage + 1e-6)).toBe(true);
  });
  it('adds drone and grenade DPS to boss HP in full and scales gun DPS by HE', () => {
    const base = { damage: 20, fireRate: 10, projectiles: 1, crit: 0 };
    expect(bossHp({ ...base, explosive: 1 }, 2)).toBe(40 * 200 * 1.5);
    expect(bossHp({ ...base, drones: 10, damageMul: 2 }, 2)).toBe(40 * (200 + 8 * 5 * 2 * 1.25 * 2));
    expect(bossHp({ ...base, grenades: 3 }, 2)).toBe(40 * (200 + (3 * 40) / 4));
  });
  it('counts drones like the gun and grenades by cooldown in boss HP (16.9)', () => {
    const base = { damage: 20, fireRate: 10, projectiles: 3, crit: 0, explosive: 1 };
    const shot = (1 + 0.5 * 2) * 1.5;
    expect(bossHp({ ...base, drones: 2, fireRateMul: 1.5 }, 2)).toBeCloseTo(40 * (200 + 2 * 5 * 2 * 1.5) * shot, 6);
    expect(bossHp({ ...base, projectiles: 1, explosive: 0, grenades: 2, cooldownMul: 0.5 }, 2)).toBe(40 * (200 + (2 * 40) / 2));
  });
  it('gives drones the gun stats: fire rate, extra bullets, pierce, bounces, HE, range (16.9)', () => {
    const w = quiet();
    Object.assign(w.stacks, { drone: 1, rof: 100, multishot: 2, pierce: 1, ricochet: 1, bspeed: 50 });
    w.stats = computeStats(w.stacks);
    w.player.fireCd = 1e9; // gun silent
    place(w, 0, 100, 1e6);
    const shots: number[] = [];
    let b = w.bullets[0];
    for (let i = 0; i < Math.round(2 / DT); i++) {
      const before = w.bullets.length;
      step(w, { mx: 0, my: 0 });
      if (w.bullets.length > before) {
        shots.push(w.bullets.length - before);
        b = { ...w.bullets[w.bullets.length - 1] };
      }
    }
    expect(shots.length).toBeGreaterThanOrEqual(7); // 2 x 2 per second, over 2 s
    expect(shots.every((n) => n === 3)).toBe(true);
    expect(b.pierceLeft).toBe(w.stats.pierce);
    expect(b.bounces).toBe(1);
    expect(b.explodes).toBe(true);
  });
  it('lets drones skip before the gun at the bullet limit', () => {
    const w = quiet();
    w.stacks.drone = 8;
    w.stats = computeStats(w.stacks);
    place(w, 0, 100, 1e6);
    const fill = CAPS.playerBullets - w.stats.projectiles;
    for (let i = 0; i < fill; i++)
      w.bullets.push({ x: 0, y: -5000, vx: 0, vy: 0, rangeLeft: 1e9, damage: 0, pierceLeft: 0, bounces: 0, hit: [] });
    w.drones.forEach((d) => (d.cd = 0));
    w.player.fireCd = 0;
    step(w, { mx: 0, my: 0 });
    expect(w.bullets.length).toBe(CAPS.playerBullets); // the gun fired, no drone did
  });
  it('offers FAST HANDS only with a special attack, and its picks multiply (16.9)', () => {
    const s = emptyStacks();
    for (let i = 0; i < 200; i++) expect(drawOffer(s, 5, 20, 4, createRng(i)).some((o) => o.id === 'cooldown')).toBe(false);
    s.grenade = 1;
    expect(
      Array.from({ length: 200 }, (_, i) => drawOffer(s, 5, 20, 4, createRng(i))).some((o) => o.some((x) => x.id === 'cooldown')),
    ).toBe(true);
    expect(addStack('cooldown', addStack('cooldown', 0, 20), 20)).toBeCloseTo(36, 9);
    expect(addStack('dmg', 20, 20)).toBe(40);
    s.cooldown = 36;
    expect(computeStats(s).cooldownMul).toBeCloseTo(0.64, 9);
  });
  it('throws the next volley after the cut cooldown', () => {
    const w = quiet();
    w.stacks.grenade = 1;
    w.stacks.cooldown = 50;
    w.stats = computeStats(w.stacks);
    place(w, 0, 60, 1e6);
    step(w, { mx: 0, my: 0 });
    expect(w.nextVolleyAt).toBeCloseTo(w.time + GRENADE.cooldownSec * 0.5, 6);
  });
});

describe('three targets (design.md 16.11)', () => {
  const godMode = (seed: number) => {
    const w = createWorld(seed);
    w.player.hp = w.stats.maxHp = 1e9;
    return w;
  };
  const run = (w: World, sec: number) => {
    for (let i = 0; i < Math.round(sec / DT); i++) {
      if (w.phase === 'levelup') {
        w.phase = 'play';
        w.pendingLevels = 0;
      }
      step(w, { mx: 0, my: 0 });
    }
  };
  const killTarget = (w: World) => {
    w.boss!.hp = 1;
    w.boss!.x = w.player.x + 60;
    w.boss!.y = w.player.y;
    for (const e of w.enemies) e.x += 1000;
    const down = w.targetsDown;
    for (let i = 0; i < 600 && w.targetsDown === down; i++) run(w, DT);
  };
  it('doubles the spawn rate to 4/s at 5:00, then every 5:00, capped at 10/s', () => {
    expect(spawnRate(300)).toBeCloseTo(4, 5);
    expect(spawnRate(540)).toBeCloseTo(4 * 2 ** (240 / 300), 5);
    expect(spawnRate(600)).toBeCloseTo(8, 5);
    expect(spawnRate(780)).toBe(10);
  });
  it('pauses the contract clock from the warning until the kill', () => {
    const w = godMode(7);
    toFight(w, 0);
    run(w, 20);
    expect(w.time).toBeGreaterThan(319);
    expect(w.contractTime).toBeCloseTo(BOSSES[0].atSec, 5);
  });
  it('a lieutenant kill drops one level of Scrap, releases the arena after the tape fade and moves to the next target', () => {
    const w = godMode(8);
    toFight(w, 0);
    run(w, 10);
    const scrap = scrapForLevel(w.level + w.pendingLevels);
    const pickups = w.pickups.length;
    killTarget(w);
    expect(w.won).toBe(false);
    expect(w.targetsDown).toBe(1);
    expect(w.downAt).toBeGreaterThan(0);
    const pile = w.pickups.slice(pickups).reduce((s, p) => s + p.value, 0);
    expect(pile).toBeGreaterThanOrEqual(scrap);
    expect(w.arena).not.toBeNull();
    run(w, LIEUTENANT_DOWN.tapeFadeSec + 0.05);
    expect(w.arena).toBeNull();
    expect(w.boss).toBeNull();
    expect(w.target).toBe(1);
    expect(w.fights[0].killedAt).toBeGreaterThan(w.fights[0].arrivedAt);
    const resumed = w.contractTime;
    run(w, 1);
    expect(w.contractTime).toBeCloseTo(resumed + 1, 5);
  });
  it('sends LT. VIPER at contract 9:00 with 50x sheet DPS', () => {
    const w = godMode(9);
    toFight(w, 1);
    run(w, 10);
    expect(w.boss).not.toBeNull();
    expect(w.boss!.target).toBe(1);
    expect(w.boss!.maxHp).toBe(bossHp(w.stats, w.stats.crit, BOSSES[1].hpDpsSec));
    expect(w.fights.at(-1)!.target).toBe(1);
  });
});

describe('LT. VIPER (design.md 16.11)', () => {
  const host = () => {
    const h = {
      time: 0,
      level: 10,
      stats: { damage: 10, fireRate: 5, projectiles: 1, crit: 0 },
      player: { x: 0, y: 0 },
      enemyBullets: [] as BossHost['enemyBullets'],
      arena: null,
      mines: [] as Mine[],
      hits: [] as number[],
      adds: [] as [number, string | undefined][],
      hitPlayer(dmg: number) {
        h.hits.push(dmg);
      },
      spawnAddsRing(count: number, kind?: 'grunt' | 'runner') {
        h.adds.push([count, kind]);
      },
    };
    return h;
  };
  const viper = (h: ReturnType<typeof host>, y = -VIPER.holdPx) => {
    const b = createBoss(h, 1);
    b.x = 0;
    b.y = y;
    b.state = 'walk';
    b.damageable = true;
    b.arrivedAt = 0;
    return b;
  };
  const tick = (b: Boss, h: ReturnType<typeof host>, sec: number) => {
    for (let i = 0; i < Math.round(sec / DT); i++) {
      h.time += DT;
      updateBoss(b, h);
    }
  };
  it('holds about 160 px off, walking in when far and backing off when the player closes in', () => {
    const h = host();
    const far = viper(h, -300);
    tick(far, h, 5);
    expect(Math.abs(Math.hypot(far.x, far.y) - VIPER.holdPx)).toBeLessThanOrEqual(VIPER.holdSlackPx + 1);
    const near = viper(h, -60);
    tick(near, h, 5);
    expect(Math.abs(Math.hypot(near.x, near.y) - VIPER.holdPx)).toBeLessThanOrEqual(VIPER.holdSlackPx + 1);
  });
  it('tracks for 0.6 s, locks for 0.2 s, then fires 3 bullets down the locked line', () => {
    const h = host();
    const b = viper(h);
    b.burstCd = DT;
    tick(b, h, 0.3);
    expect(b.aimT).toBeGreaterThan(0);
    expect(h.enemyBullets.length).toBe(0);
    tick(b, h, 0.4); // 0.7 s in: locked
    h.player.x = 120; // too late to move the line
    tick(b, h, 0.4);
    expect(h.enemyBullets.length).toBe(VIPER.burst.bullets);
    for (const s of h.enemyBullets) {
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(VIPER.burst.speed, 5);
      expect(s.vx).toBeCloseTo(0, 5);
      expect(s.damage).toBe(VIPER.burst.damage * BOSSES[1].damageScale);
    }
  });
  it('fires the burst every 2.5 s in phase 1 and no fan', () => {
    const h = host();
    const b = viper(h);
    tick(b, h, VIPER.burst.firstAfterSec + 3 * VIPER.burst.everySec - 0.1);
    expect(h.enemyBullets.length).toBe(3 * VIPER.burst.bullets);
  });
  it('adds a 7-bullet 60 degree fan in phase 2, never while a burst is aiming', () => {
    const h = host();
    const b = viper(h);
    b.phase = 2;
    b.burstCd = 99;
    b.fanCd = DT;
    tick(b, h, 0.05);
    expect(h.enemyBullets.length).toBe(VIPER.fan.bullets);
    const angles = h.enemyBullets.map((s) => Math.atan2(s.vy, s.vx));
    expect(Math.max(...angles) - Math.min(...angles)).toBeCloseTo((VIPER.fan.spreadDeg * Math.PI) / 180, 5);
    for (const s of h.enemyBullets) expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(VIPER.fan.speed, 5);
    h.enemyBullets.length = 0;
    b.aimT = 0;
    b.fanCd = DT;
    tick(b, h, 0.3);
    expect(h.enemyBullets.length).toBe(0);
  });
  it('drops 3 mines behind him in phase 3 that arm after 1 s and blow up on the player', () => {
    const h = host();
    const b = viper(h);
    b.phase = 3;
    b.burstCd = 99;
    b.fanCd = 99;
    tick(b, h, DT);
    expect(h.mines.length).toBe(VIPER.mines.count);
    expect(h.adds).toEqual([[VIPER.adds.count, 'runner']]);
    for (const m of h.mines) expect(Math.hypot(m.x, m.y)).toBeGreaterThan(Math.hypot(b.x, b.y)); // behind him
    const m = h.mines[1];
    h.player.x = m.x;
    h.player.y = m.y;
    b.x = 500; // keep his body out of the way
    tick(b, h, 0.5);
    expect(h.hits.length).toBe(0); // not armed yet
    tick(b, h, 0.6);
    expect(h.hits).toContain(VIPER.mines.damage * BOSSES[1].damageScale);
    expect(h.mines.length).toBe(VIPER.mines.count - 1);
  });
  it('mines left alone go off after 10 s', () => {
    const h = host();
    h.mines.push({ x: 300, y: 300, age: 0, damage: 1 });
    const b = viper(h);
    tick(b, h, VIPER.mines.fuseSec - 0.1);
    expect(h.mines.length).toBe(1);
    tick(b, h, 0.2);
    expect(h.mines.length).toBe(0);
    expect(h.hits.length).toBe(0); // too far to hurt
  });
  it('fights LT. VIPER in the real loop: bullets fly and mines clear when he goes down', () => {
    const w = createWorld(11);
    w.player.hp = w.stats.maxHp = 1e9;
    toFight(w, 1);
    for (let i = 0; i < 15 * 60; i++) {
      if (w.phase === 'levelup') {
        w.phase = 'play';
        w.pendingLevels = 0;
      }
      step(w, { mx: 0, my: 0 });
    }
    expect(w.boss!.target).toBe(1);
    expect(w.boss!.damageable).toBe(true);
    w.mines.push({ x: w.player.x + 999, y: w.player.y, age: 0, damage: 1 });
    w.boss!.hp = 1;
    for (let i = 0; i < 600 && w.targetsDown < 2; i++) step(w, { mx: 0, my: 0 });
    expect(w.targetsDown).toBe(2);
    expect(w.mines.length).toBe(0);
  });
});
