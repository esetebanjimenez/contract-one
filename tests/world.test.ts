import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { scrapForLevel } from '../src/data/levels';
import { CAPS, DT } from '../src/data/sim';
import { SPAWN } from '../src/data/spawns';
import { PERKS } from '../src/data/perks';
import { computeStats, drawOffer, softMove, emptyStacks, makeOffer, rollTier } from '../src/sim/perks';
import { createRng } from '../src/sim/rng';
import { bossHp } from '../src/data/boss';
import { checkPhase } from '../src/sim/boss';
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
} from '../src/sim/world';
import { runBot } from '../tools/bots';

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
    w.tick = -1e9; // keep the spawner quiet
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
    w.tick = 900 * 60;
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
    w.tick = -1e9;
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
    far.tick = -1e9;
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
    w.tick = 540 * 60;
    for (let i = 0; i < 1800; i++) step(w, { mx: 0, my: 0 });
    expect(riflemenAlive(w)).toBeLessThanOrEqual(SPAWN.maxRiflemen);
    expect(w.enemies.some((e) => e.elite)).toBe(true);
    expect(w.enemies.some((e) => e.def.id === 'heavy')).toBe(true);
  });
  it('makes every second wave from 3:00 a full ring', () => {
    expect([120, 180, 240, 300, 420, 540].map((t) => isRingWave(t + 1))).toEqual([false, true, false, true, true, true]);
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
  it('keeps boss HP at a flat 2000 inside the clamp', () => {
    expect(bossHp(20)).toBe(2000);
    expect(bossHp(30)).toBe(2000);
    expect(bossHp(5)).toBe(2000);
    expect(bossHp(60)).toBe(2000);
  });
  it('stops pressure waves from 9:30', () => {
    expect(inPressureWave(541)).toBe(true);
    expect(inPressureWave(571)).toBe(false);
    expect(inPressureWave(661)).toBe(false);
  });
  it('spawns the Warlord after the 3 s warning, off-screen and undamageable until he is in view', () => {
    const w = godMode(3);
    w.tick = Math.round(602.9 / DT);
    run(w, 0.05);
    expect(w.boss).toBeNull();
    run(w, 0.2);
    expect(w.boss).not.toBeNull();
    expect(w.boss!.damageable).toBe(false);
    run(w, 10);
    expect(w.boss!.damageable).toBe(true);
    expect(w.bossArrivedAt).toBeGreaterThan(603);
  });
  it('staggers and clears enemy bullets on a phase change', () => {
    const w = godMode(4);
    w.tick = Math.round(603 / DT);
    run(w, 10);
    const b = w.boss!;
    w.enemyBullets.push({ ...w.player, vx: 1, vy: 0 } as unknown as (typeof w.enemyBullets)[number]);
    b.hp = b.maxHp * 0.6;
    checkPhase(b, {
      time: w.time,
      level: w.level,
      player: w.player,
      enemyBullets: w.enemyBullets,
      arena: null,
      hitPlayer: () => {},
      spawnAddsRing: () => {},
    });
    expect(b.phase).toBe(2);
    expect(b.state).toBe('stagger');
    expect(w.enemyBullets.length).toBe(0);
  });
  it('wins on the kill: other enemies die with no Scrap and the boss bar stops', () => {
    const w = godMode(5);
    w.tick = Math.round(603 / DT);
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
    const kills = w.kills;
    run(w, 2);
    expect(w.enemies.length).toBe(0);
    expect(w.kills).toBe(kills);
  });
  it('locks the arena at 10:00: enemies flee and despawn, spawns stop, the player is walled in', () => {
    const w = godMode(6);
    w.tick = Math.round(599.9 / DT);
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
