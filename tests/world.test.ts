import { describe, expect, it } from 'vitest';
import { ELITE, ENEMIES, SCALING } from '../src/data/enemies';
import { scrapForLevel } from '../src/data/levels';
import { CAPS, DT } from '../src/data/sim';
import { SPAWN } from '../src/data/spawns';
import { CRATE, CRATE_PERKS, DRONE, GRENADE, PERKS, PERK_RULES, addStack } from '../src/data/perks';
import { computeStats, drawCrateOffer, drawOffer, softMove, emptyStacks, makeOffer, rollTier } from '../src/sim/perks';
import { createRng } from '../src/sim/rng';
import { BOSS, BOSSES, LIEUTENANT_DOWN, VIPER, WARLORD, bossHp, sheetDps } from '../src/data/boss';
import { PLAYER } from '../src/data/player';
import { NATIVE_WIDTH } from '../src/data/display';
import {
  bossDamageMul,
  bossRadius,
  checkPhase,
  createBoss,
  updateBoss,
  type ArtilleryCircle,
  type Boss,
  type BossHost,
  type Mine,
  type Smoke,
} from '../src/sim/boss';
import {
  choosePerk,
  createWorld,
  inPressureWave,
  isRingWave,
  killEnemy,
  clumpPickups,
  fullyOnScreen,
  cameraAt,
  cameraEasing,
  rifleMoveSec,
  riflemenAlive,
  spawnRate,
  step,
  volleyTargets,
  eliteDef,
  eliteRifleMoveSec,
  lungeStep,
  wavePowerMul,
  type Enemy,
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
      veteran: false,
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
      veteran: false,
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
      veteran: false,
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
    for (let i = 0; i < 1800; i++) {
      w.phase = 'play';
      w.pendingLevels = 0;
      step(w, { mx: 0, my: 0 });
    }
    expect(riflemenAlive(w)).toBeLessThanOrEqual(SPAWN.maxRiflemen);
    expect(w.enemies.some((e) => e.veteran)).toBe(true);
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
      rng: () => 0.5,
      arena: null,
      mines: w.mines,
      artillery: w.artillery,
      smokes: w.smokes,
      hitPlayer: () => {},
      addBlast: () => {},
      spawnAddsRing: () => {},
    });
    expect(b.phase).toBe(2);
    expect(b.state).toBe('stagger');
    expect(w.enemyBullets.length).toBe(0);
  });
  it('stamps the time of every damaging boss hit for the fading flash, and not during the stagger', () => {
    const w = godMode(5);
    toFight(w, 2);
    run(w, 10);
    const b = w.boss!;
    expect(b.damageable).toBe(true);
    b.x = w.player.x + 60;
    b.y = w.player.y;
    for (const e of w.enemies) e.x += 1000;
    let stamped = false;
    for (let i = 0; i < 300 && !stamped; i++) {
      run(w, DT);
      stamped = b.hitAt === w.time;
    }
    expect(stamped).toBe(true);
    b.state = 'stagger';
    b.stateT = 1;
    const at = b.hitAt;
    run(w, 0.5);
    expect(b.hitAt).toBe(at);
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
  it('merges 3+ grounded pieces within 40 px near the player, and leaves a pair and flyers alone (16.3)', () => {
    const w = createWorld(3);
    w.player.x = 0;
    w.player.y = 0;
    w.pickups.length = 0;
    const drop = (x: number, y: number, flying = false) => w.pickups.push({ x, y, value: 1, age: 0, flying, cache: false, pop: 0 });
    // Three grounded within 40 px of the player merge; a flyer among them is left out of the merge.
    drop(100, 0);
    drop(120, 0);
    drop(130, 0);
    drop(115, 0, true); // flying: never merges
    // A lone pair 60 px apart stays as two (below the group minimum).
    drop(260, 0);
    drop(260, 60);
    clumpPickups(w);
    const grounded = w.pickups.filter((k) => !k.flying);
    const flyers = w.pickups.filter((k) => k.flying);
    expect(flyers).toHaveLength(1);
    const merged = grounded.find((k) => k.value === 3)!;
    expect(merged).toBeTruthy();
    expect(merged.x).toBeCloseTo((100 + 120 + 130) / 3, 5);
    expect(merged.pop).toBeGreaterThan(0);
    expect(grounded.filter((k) => k.value === 1)).toHaveLength(2); // the pair is untouched
  });

  it('merges a left-behind off-screen trail across the wider 80 px (16.3)', () => {
    const w = createWorld(3);
    w.player.x = 0;
    w.player.y = 0;
    w.pickups.length = 0;
    // Three pieces 60-80 px apart, all more than 400 px from the player: too spread for 40 px, caught by 80 px.
    for (const x of [500, 560, 580]) w.pickups.push({ x, y: 0, value: 2, age: 0, flying: false, cache: false, pop: 0 });
    clumpPickups(w);
    expect(w.pickups).toHaveLength(1);
    expect(w.pickups[0].value).toBe(6);
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
      veteran: false,
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
  it('eases the camera from the arena view back onto the merc on release, holding spawns until it lands', () => {
    const w = godMode(8);
    toFight(w, 0);
    run(w, 10);
    killTarget(w);
    const a = w.arena!;
    // Put the merc in a corner so the follow view is far from the arena view.
    w.player.x = a.x0 + 10;
    w.player.y = a.y0 + 10;
    for (let i = 0; i < 600 && w.arena; i++) run(w, DT);
    expect(w.arena).toBeNull();
    const start = cameraAt(w, w.viewH);
    expect(start.x).toBeCloseTo(a.camX, 0);
    expect(start.y).toBeCloseTo(a.camY, 0);
    expect(cameraEasing(w)).toBe(true);
    const n = w.enemies.length;
    run(w, LIEUTENANT_DOWN.cameraEaseSec - 2 * DT);
    expect(w.enemies.length).toBeLessThanOrEqual(n); // no new spawns mid-ease
    run(w, 3 * DT);
    expect(cameraEasing(w)).toBe(false);
    const end = cameraAt(w, w.viewH);
    expect(end.x).toBeCloseTo(w.player.x - NATIVE_WIDTH / 2, 5);
  });
  it('sends LT. VIPER at contract 9:00 with his fixed skill-gate HP (design.md 16.15)', () => {
    const w = godMode(9);
    toFight(w, 1);
    run(w, 10);
    expect(w.boss).not.toBeNull();
    expect(w.boss!.target).toBe(1);
    expect(w.boss!.maxHp).toBe(BOSSES[1].hp);
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
      rng: createRng(99),
      enemyBullets: [] as BossHost['enemyBullets'],
      arena: null,
      mines: [] as Mine[],
      artillery: [] as ArtilleryCircle[],
      smokes: [] as Smoke[],
      hits: [] as number[],
      adds: [] as [number, string | undefined][],
      blasts: [] as ['he' | 'frag' | 'mine', number, number][],
      hitPlayer(dmg: number) {
        h.hits.push(dmg);
      },
      addBlast(kind: 'he' | 'frag' | 'mine', x: number, y: number) {
        h.blasts.push([kind, x, y]);
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
  it('always backs off from the player (design.md 16.15): his hold is wider than the arena', () => {
    const h = host();
    const b = viper(h, -120); // starts 120 px from the player, well inside the hold
    const d0 = Math.hypot(b.x, b.y);
    tick(b, h, 3);
    const d1 = Math.hypot(b.x, b.y);
    expect(d1).toBeGreaterThan(d0); // he fled, instead of settling in gun range
    tick(b, h, 3);
    expect(Math.hypot(b.x, b.y)).toBeGreaterThan(d1); // and keeps fleeing (no arena wall to corner him here)
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
  it('lays 3 mines midway to the player in phase 3 that arm after 1 s and blow up on him', () => {
    const h = host();
    const b = viper(h);
    b.phase = 3;
    b.burstCd = 99;
    b.fanCd = 99;
    tick(b, h, DT);
    expect(h.mines.length).toBe(VIPER.mines.count);
    expect(h.adds).toEqual([[VIPER.adds.count, 'runner']]);
    for (const m of h.mines) expect(Math.hypot(m.x, m.y)).toBeLessThan(Math.hypot(b.x, b.y)); // midway: nearer the player than him
    const m = h.mines[1];
    h.player.x = m.x;
    h.player.y = m.y;
    b.x = 500; // keep his body out of the way
    b.mineCd = 999; // don't lay a fresh row while we wait on this one
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
    b.mineCd = 999; // isolate the one planted mine from his own phase-1 trail (design.md 16.15)
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
    // VIPER keeps his distance in the big arena (design.md 16.16); park the player on him to land the shot.
    for (let i = 0; i < 600 && w.targetsDown < 2; i++) {
      if (w.boss) {
        w.player.x = w.boss.x;
        w.player.y = w.boss.y;
      }
      step(w, { mx: 0, my: 0 });
    }
    expect(w.targetsDown).toBe(2);
    expect(w.mines.length).toBe(0);
  });
});

describe('THE WARLORD (design.md 16.11)', () => {
  const host = () => {
    const h = {
      time: 0,
      level: 10,
      stats: { damage: 10, fireRate: 5, projectiles: 1, crit: 0 },
      player: { x: 0, y: 0 },
      rng: createRng(99),
      enemyBullets: [] as BossHost['enemyBullets'],
      arena: null,
      mines: [] as Mine[],
      artillery: [] as ArtilleryCircle[],
      smokes: [] as Smoke[],
      hits: [] as number[],
      adds: [] as [number, string | undefined][],
      blasts: [] as ['he' | 'frag' | 'mine', number, number][],
      hitPlayer(dmg: number) {
        h.hits.push(dmg);
      },
      addBlast(kind: 'he' | 'frag' | 'mine', x: number, y: number) {
        h.blasts.push([kind, x, y]);
      },
      spawnAddsRing(count: number, kind?: 'grunt' | 'runner') {
        h.adds.push([count, kind]);
      },
    };
    return h;
  };
  const warlord = (h: ReturnType<typeof host>) => {
    const b = createBoss(h, 2);
    b.x = 0;
    b.y = -400;
    b.state = 'walk';
    b.damageable = true;
    b.arrivedAt = 0;
    return b;
  };
  /** Steps until `until` holds (or `sec` runs out), keeping the player out of his way. */
  const tickUntil = (b: Boss, h: ReturnType<typeof host>, sec: number, until: () => boolean) => {
    for (let i = 0; i < Math.round(sec / DT); i++) {
      h.time += DT;
      h.player.x = b.x + 300;
      h.player.y = b.y;
      updateBoss(b, h);
      if (until()) return true;
    }
    return false;
  };
  it('has a bigger body than the lieutenants, for his 128x128 sprite', () => {
    const h = host();
    expect(bossRadius(warlord(h))).toBe(40);
    expect(bossRadius(createBoss(h, 0))).toBe(30);
    expect(bossRadius(createBoss(h, 1))).toBe(16); // VIPER is small and evasive (design.md 16.15)
  });
  it('takes turns between the charge and the aimed burst, one every 3 s', () => {
    const h = host();
    const b = warlord(h);
    expect(tickUntil(b, h, WARLORD.firstAttackSec + 0.1, () => b.state === 'telegraph')).toBe(true);
    expect(tickUntil(b, h, 5, () => b.state === 'walk')).toBe(true);
    // Next is the burst, not another charge.
    let charged = false;
    expect(
      tickUntil(b, h, WARLORD.attackEverySec + 0.1, () => {
        charged ||= b.state === 'telegraph';
        return b.aimT >= 0;
      }),
    ).toBe(true);
    expect(charged).toBe(false);
    expect(tickUntil(b, h, 1.2, () => h.enemyBullets.length === VIPER.burst.bullets)).toBe(true);
    for (const s of h.enemyBullets) expect(s.damage).toBe(VIPER.burst.damage * BOSSES[2].damageScale);
    // Then the charge again, 3 s after the burst started.
    expect(tickUntil(b, h, WARLORD.attackEverySec, () => b.state === 'telegraph')).toBe(true);
  });
  it('adds the 16-bullet ring every 3 s and the fan in phase 2', () => {
    const h = host();
    const b = warlord(h);
    b.phase = 2;
    b.chargeCd = 99;
    b.ringCd = DT;
    b.fanCd = 99;
    tickUntil(b, h, 0.05, () => false);
    const ring = BOSS.ring.bullets - BOSS.ring.gapBullets;
    expect(h.enemyBullets.length).toBe(ring);
    tickUntil(b, h, WARLORD.ringEverySec - 0.1, () => false);
    expect(h.enemyBullets.length).toBe(ring);
    tickUntil(b, h, 0.2, () => false);
    expect(h.enemyBullets.length).toBe(2 * ring);
    h.enemyBullets.length = 0;
    b.ringCd = 99;
    b.fanCd = DT;
    tickUntil(b, h, 0.05, () => false);
    expect(h.enemyBullets.length).toBe(VIPER.fan.bullets);
  });
  it('calls 8 Grunts and 4 Runners every 8 s and mines each charge start in phase 3', () => {
    const h = host();
    const b = warlord(h);
    b.phase = 3;
    b.chargeCd = DT;
    b.ringCd = 99;
    b.fanCd = 99;
    tickUntil(b, h, 0.05, () => false);
    expect(h.adds).toEqual([
      [WARLORD.adds.grunts, 'grunt'],
      [WARLORD.adds.runners, 'runner'],
    ]);
    const start = { x: 0, y: 0 };
    expect(
      tickUntil(b, h, 2, () => {
        if (b.state === 'telegraph') Object.assign(start, { x: b.x, y: b.y });
        return b.state === 'charge';
      }),
    ).toBe(true);
    expect(h.mines.length).toBe(WARLORD.chargeMines);
    expect(h.mines[0].x).toBeCloseTo(start.x, 5);
    expect(h.mines[0].y).toBeCloseTo(start.y, 5);
    tickUntil(b, h, WARLORD.adds.everySec, () => false);
    expect(h.adds.length).toBe(4);
  });
  it('hits for 30 on contact', () => {
    const h = host();
    const b = warlord(h);
    b.chargeCd = 99;
    h.player.x = b.x + 30;
    h.player.y = b.y;
    h.time += DT;
    updateBoss(b, h);
    expect(h.hits).toEqual([WARLORD.contactDamage]);
  });
});

describe('ARTILLERY CALL (design.md 16.11)', () => {
  const host = () => {
    const h = {
      time: 0,
      level: 10,
      stats: { damage: 10, fireRate: 5, projectiles: 1, crit: 0 },
      player: { x: 0, y: 0 },
      rng: createRng(7),
      enemyBullets: [] as BossHost['enemyBullets'],
      arena: null as BossHost['arena'],
      mines: [] as Mine[],
      artillery: [] as ArtilleryCircle[],
      smokes: [] as Smoke[],
      hits: [] as number[],
      blasts: [] as ['he' | 'frag' | 'mine', number, number][],
      hitPlayer(dmg: number) {
        h.hits.push(dmg);
      },
      addBlast(kind: 'he' | 'frag' | 'mine', x: number, y: number) {
        h.blasts.push([kind, x, y]);
      },
      spawnAddsRing() {},
    };
    return h;
  };
  const A = WARLORD.artillery;
  const scaled = A.damage * BOSSES[2].damageScale;
  // A Warlord well away from the player, so his walk and contact never interfere with the circles.
  const warlord = (h: ReturnType<typeof host>, phase: 2 | 3 = 2) => {
    const b = createBoss(h, 2);
    b.x = 600;
    b.y = 0;
    b.state = 'walk';
    b.damageable = true;
    b.arrivedAt = 0;
    b.phase = phase;
    b.chargeCd = 999;
    b.ringCd = 999;
    b.fanCd = 999;
    b.burstCd = 999;
    return b;
  };
  const tick = (b: Boss, h: ReturnType<typeof host>, sec: number) => {
    for (let i = 0; i < Math.round(sec / DT); i++) {
      h.time += DT;
      updateBoss(b, h);
    }
  };
  /** Steps until the throw drops its circles (throwT back to -1), returning the tick count (or -1). */
  const tickToVolley = (b: Boss, h: ReturnType<typeof host>, maxSec = 2) => {
    for (let i = 0; i < Math.round(maxSec / DT); i++) {
      h.time += DT;
      updateBoss(b, h);
      if (b.throwT < 0 && h.artillery.length > 0) return i;
    }
    return -1;
  };

  it('never throws in phase 1', () => {
    const h = host();
    const b = warlord(h, 1 as 2);
    b.artilleryCd = DT;
    tick(b, h, 3);
    expect(h.artillery.length).toBe(0);
    expect(b.throwT).toBe(-1);
  });

  it('after the throw pose drops 3 circles in phase 2 and 5 in phase 3, and re-arms the timer', () => {
    const h2 = host();
    const b2 = warlord(h2, 2);
    b2.artilleryCd = DT;
    tick(b2, h2, A.throwSec - 0.05); // mid-throw: the pose is up, no circles yet
    expect(b2.throwT).toBeGreaterThanOrEqual(0);
    expect(h2.artillery.length).toBe(0);
    tick(b2, h2, 0.1); // the throw completes
    expect(b2.throwT).toBe(-1);
    expect(h2.artillery.length).toBe(A.circles[2]);

    const h3 = host();
    const b3 = warlord(h3, 3);
    b3.artilleryCd = DT;
    expect(tickToVolley(b3, h3)).toBeGreaterThanOrEqual(0);
    expect(h3.artillery.length).toBe(A.circles[3]);
    expect(b3.artilleryCd).toBeCloseTo(A.everySec[3], 5); // re-armed the moment the circles drop
  });

  it('lands the first circle on the player and the rest 80-140 px away, none overlapping a circle or a mine', () => {
    const h = host();
    const b = warlord(h, 3);
    h.player.x = 120;
    h.player.y = -80;
    h.mines.push({ x: 120 + 100, y: -80, age: 0, damage: 1 });
    b.artilleryCd = DT;
    tick(b, h, A.throwSec + 0.1);
    const cs = h.artillery;
    expect(cs.length).toBe(A.circles[3]);
    // First circle is centred on the player's position at the throw.
    expect(Math.hypot(cs[0].x - h.player.x, cs[0].y - h.player.y)).toBeCloseTo(0, 5);
    for (let i = 1; i < cs.length; i++) {
      const d = Math.hypot(cs[i].x - h.player.x, cs[i].y - h.player.y);
      expect(d).toBeGreaterThanOrEqual(A.minPx - 1e-6);
      expect(d).toBeLessThanOrEqual(A.maxPx + 1e-6);
    }
    // No two circles overlap, and none overlaps the mine.
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        expect(Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y)).toBeGreaterThanOrEqual(2 * A.radiusPx - 1e-6);
      }
      for (const m of h.mines) {
        expect(Math.hypot(cs[i].x - m.x, cs[i].y - m.y)).toBeGreaterThanOrEqual(A.radiusPx + VIPER.mines.radiusPx - 1e-6);
      }
    }
  });

  it('fills over 1.5 s, then explodes once for 30 (20 x 1.5) with a mine blast if the player is inside', () => {
    const h = host();
    const b = warlord(h, 2);
    h.player.x = 0;
    h.player.y = -300; // clear of his body at x=600
    b.artilleryCd = DT;
    tick(b, h, A.throwSec + 0.1);
    const c = h.artillery[0];
    expect(Math.hypot(c.x - h.player.x, c.y - h.player.y)).toBeCloseTo(0, 5);
    expect(c.damage).toBe(scaled);
    tick(b, h, A.fillSec - 0.2); // still filling
    expect(h.artillery).toContain(c);
    expect(h.hits).not.toContain(scaled);
    tick(b, h, 0.25); // past the fill: it explodes
    expect(h.artillery).not.toContain(c);
    expect(h.hits).toContain(scaled);
    expect(h.blasts.some(([k]) => k === 'mine')).toBe(true);
  });

  it('never charges while throwing, and a throw pushes his next charge back', () => {
    const h = host();
    const b = warlord(h, 2);
    b.chargeCd = 0; // a charge is overdue
    b.throwT = 0; // but he is mid-throw
    let telegraphed = false;
    let chargeAtVolley = -1;
    for (let i = 0; i < Math.round((A.throwSec + 0.1) / DT); i++) {
      const throwing = b.throwT >= 0;
      h.time += DT;
      updateBoss(b, h);
      telegraphed ||= b.state === 'telegraph' || b.state === 'charge';
      if (throwing && b.throwT < 0 && chargeAtVolley < 0) chargeAtVolley = b.chargeCd; // the completion tick
    }
    expect(telegraphed).toBe(false);
    expect(chargeAtVolley).toBeCloseTo(A.chargePushbackSec, 5); // pushed back from 0 the moment he throws
  });

  it('pauses the ARTILLERY CALL timer while a charge runs', () => {
    const h = host();
    const b = warlord(h, 2);
    b.state = 'telegraph';
    b.stateT = 10; // held in the charge telegraph
    b.artilleryCd = 3;
    tick(b, h, 1);
    expect(b.artilleryCd).toBe(3); // unchanged: the timer only counts while he walks
  });

  it('a mine detonation emits the shared mine blast', () => {
    const h = host();
    const b = warlord(h, 2);
    b.chargeCd = 999;
    h.player.x = 50;
    h.player.y = 50;
    h.mines.push({ x: 50, y: 50, age: VIPER.mines.armSec + 0.1, damage: 7 });
    tick(b, h, DT);
    expect(h.mines.length).toBe(0);
    expect(h.hits).toContain(7);
    expect(h.blasts).toContainEqual(['mine', 50, 50]);
  });

  it('clears the circles when the Warlord dies in the real loop', () => {
    const w = createWorld(13);
    w.player.hp = w.stats.maxHp = 1e9;
    toFight(w, 2);
    for (let i = 0; i < 20 * 60 && !w.boss?.damageable; i++) {
      if (w.phase === 'levelup' || w.phase === 'crate') {
        w.phase = 'play';
        w.pendingLevels = 0;
      }
      step(w, { mx: 0, my: 0 });
    }
    expect(w.boss!.target).toBe(2);
    w.artillery.push({ x: w.player.x + 10, y: w.player.y, t: 0, damage: 30 });
    w.boss!.hp = 1;
    for (let i = 0; i < 600 && !w.won; i++) step(w, { mx: 0, my: 0 });
    expect(w.won).toBe(true);
    expect(w.artillery.length).toBe(0);
  });
});

describe('supply crates (design.md 16.12)', () => {
  const crateIds = ['multishot', 'grenade', 'explosive', 'drone'];
  const elite = (w: World, x: number, y: number) => {
    w.enemies.push({
      id: w.nextEnemyId++,
      def: ENEMIES.grunt,
      x,
      y,
      hp: 0,
      maxHp: 1,
      fireTimer: 9,
      facing: 1,
      veteran: false,
      elite: true,
      flash: 0,
      aiming: false,
    });
    killEnemy(w, w.enemies.length - 1);
  };
  it('keeps the four crate perks out of level-ups, leaving 12', () => {
    expect(PERKS.filter((d) => d.pool === 'level').length).toBe(12);
    expect(CRATE_PERKS).toEqual(expect.arrayContaining(crateIds));
    const s = emptyStacks();
    s.grenade = 1;
    for (let i = 0; i < 200; i++) expect(drawOffer(s, 5, 20, 4, createRng(i)).some((o) => crateIds.includes(o.id))).toBe(false);
  });
  it('offers 3 untiered crate cards at fixed steps, and drops HE at 100%', () => {
    const s = emptyStacks();
    for (let i = 0; i < 50; i++) {
      const o = drawCrateOffer(s, CRATE.cards, createRng(i));
      expect(o.length).toBe(3);
      expect(new Set(o.map((x) => x.id)).size).toBe(3);
      for (const x of o) {
        expect(x.tier).toBe('common');
        expect(x.value).toBe(x.id === 'explosive' ? 15 : 1);
      }
    }
    s.explosive = 100;
    for (let i = 0; i < 50; i++) expect(drawCrateOffer(s, CRATE.cards, createRng(i)).some((x) => x.id === 'explosive')).toBe(false);
  });
  it('every elite kill drops a crate; veteran kills never do', () => {
    const w = createWorld(3);
    elite(w, 50, 0);
    elite(w, 60, 0);
    expect(w.crates.length).toBe(2);
    expect(w.elitesKilled).toBe(2);
    w.enemies.push({ ...w.enemies[0], id: w.nextEnemyId++, def: ENEMIES.grunt, hp: 0, veteran: true, elite: false });
    w.enemies.push({
      id: w.nextEnemyId++,
      def: ENEMIES.grunt,
      x: 0,
      y: 0,
      hp: 0,
      maxHp: 1,
      fireTimer: 9,
      facing: 1,
      veteran: true,
      flash: 0,
      aiming: false,
    });
    killEnemy(w, w.enemies.length - 1);
    expect(w.crates.length).toBe(2);
  });
  it('spawns one elite every 2:00 of contract time from 1:30, x20 HP, x1.5 size, off the enemy cap', () => {
    const w = createWorld(5);
    w.player.hp = w.stats.maxHp = 1e9;
    const at: number[] = [];
    for (let i = 0; i < Math.round(300 / DT) && w.contractTime < 250; i++) {
      if (w.phase !== 'play') {
        w.phase = 'play';
        w.pendingLevels = 0;
      }
      const before = w.elitesSpawned;
      step(w, { mx: 0, my: 0 });
      if (w.elitesSpawned > before) {
        at.push(Math.round(w.contractTime));
        const e = w.enemies.find((x) => x.elite)!;
        const base = ENEMIES[e.def.id as keyof typeof ENEMIES];
        expect(e.veteran).toBe(false);
        expect(e.def.radius).toBeCloseTo(base.radius * ELITE.size);
        expect(e.def.speed).toBeCloseTo(base.speed * ELITE.byType[e.def.id].speed);
        expect(e.def.scrap).toBe(ELITE.scrap);
        expect(e.maxHp).toBeCloseTo(base.hp * ELITE.byType[e.def.id].hp * (1 + 0.14 * (w.contractTime / 60)), 0);
        w.enemies = w.enemies.filter((x) => !x.elite);
      }
    }
    expect(at).toEqual([90, 210]);
    // Off the cap: a full field still takes the elite, and never replaces it.
    const f = createWorld(6);
    f.player.hp = f.stats.maxHp = 1e9;
    setClock(f, Math.round(ELITE.firstSec / DT) - 2);
    while (f.enemies.length < CAPS.enemies)
      f.enemies.push({
        id: f.nextEnemyId++,
        def: ENEMIES.grunt,
        x: 2000,
        y: 2000,
        hp: 1e9,
        maxHp: 1e9,
        fireTimer: 9,
        facing: 1,
        veteran: false,
        flash: 0,
        aiming: false,
      });
    for (let i = 0; i < 120; i++) {
      f.phase = 'play';
      f.pendingLevels = 0;
      step(f, { mx: 0, my: 0 });
    }
    expect(f.enemies.length).toBeGreaterThan(CAPS.enemies);
    expect(f.enemies.filter((x) => x.elite).length).toBe(1);
  });
  it('crates never expire, ignore the magnet, and open a crate screen that does not use up a level', () => {
    const w = createWorld(4);
    w.player.hp = w.stats.maxHp = 1e9;
    elite(w, 30, 0);
    const c = w.crates[0];
    for (let i = 0; i < Math.round(120 / DT) && w.phase === 'play'; i++) {
      w.enemies.length = 0;
      w.pendingLevels = 0;
      step(w, { mx: 0, my: 0 });
    }
    expect(w.crates.length).toBe(1);
    expect(c.x).toBe(30); // never pulled
    const level = w.level;
    w.player.x = c.x;
    w.player.y = c.y;
    step(w, { mx: 0, my: 0 });
    expect(w.phase).toBe('crate');
    expect(w.crates.length).toBe(0);
    const pick = w.offer[0];
    const before = w.stacks[pick.id];
    choosePerk(w, pick.id);
    expect(w.stacks[pick.id]).toBe(before + pick.value);
    expect(w.level).toBe(level);
    expect(w.cratesOpened).toBe(1);
  });
});

describe('elite abilities (design.md 16.12)', () => {
  const mk = (w: World, id: string, x: number, y: number): Enemy => {
    const def = eliteDef(ENEMIES[id]);
    const e: Enemy = {
      id: w.nextEnemyId++,
      def,
      x,
      y,
      hp: 1e9,
      maxHp: 1e9,
      fireTimer: 9,
      facing: 1,
      veteran: false,
      elite: true,
      flash: 0,
      aiming: false,
    };
    w.enemies.push(e);
    return e;
  };
  it('gives each type its own HP, speed and contact, and the Rifleman faster bullets', () => {
    for (const id of ['grunt', 'runner', 'heavy', 'rifleman']) {
      const m = ELITE.byType[id];
      const d = eliteDef(ENEMIES[id]);
      expect(d.speed).toBeCloseTo(ENEMIES[id].speed * m.speed);
      expect(d.contactDamage).toBeCloseTo(ENEMIES[id].contactDamage * m.contact);
    }
    expect(ELITE.byType.runner).toEqual({ hp: 12, speed: 1.3, contact: 1.5 });
    expect(ELITE.byType.heavy).toEqual({ hp: 25, speed: 0.8, contact: 2 });
    expect(eliteDef(ENEMIES.runner).speed).toBeGreaterThan(Math.max(...Object.values(ENEMIES).map((d) => d.speed)));
    expect(eliteDef(ENEMIES.heavy).knockbackImmune).toBe(true);
    expect(eliteDef(ENEMIES.rifleman).ranged!.bulletSpeed).toBeCloseTo(ENEMIES.rifleman.ranged!.bulletSpeed * 1.3);
    expect(ENEMIES.rifleman.ranged!.bulletSpeed).toBe(95); // regulars untouched
  });
  it('moves an elite Rifleman x0.75 the regular move time between stops, never under 1.0 s', () => {
    expect(eliteRifleMoveSec(0)).toBeCloseTo(1.5);
    expect(eliteRifleMoveSec(600)).toBeCloseTo(Math.max(1, rifleMoveSec(600) * 0.75));
    expect(eliteRifleMoveSec(60 * 60)).toBeCloseTo(1.05); // the regular floor of 1.4 keeps it over 1.0 s
  });
  it('fires a 5-shot burst', () => {
    const w = createWorld(11);
    const e = mk(w, 'rifleman', w.player.x + 100, w.player.y);
    e.aiming = true;
    e.fireTimer = DT / 2;
    step(w, { mx: 0, my: 0 });
    expect(w.enemyBullets.length).toBe(5);
    expect(Math.hypot(w.enemyBullets[0].vx, w.enemyBullets[0].vy)).toBeCloseTo(95 * 1.3);
  });
  it('lunges an elite Grunt: in range only, holds still for 0.4 s, dashes 60 px on the aim held at the end, every 4 s', () => {
    const w = createWorld(12);
    const far = mk(w, 'grunt', 500, 0);
    expect(lungeStep(w, far, -500, 0, 500)).toBe(false);
    expect(far.lunge).toBeUndefined();
    const e = mk(w, 'grunt', 100, 0);
    const tick = (dx: number, dy: number) => {
      const r = lungeStep(w, e, dx, dy, Math.hypot(dx, dy));
      w.time += DT;
      return r;
    };
    expect(tick(-100, 0)).toBe(true);
    while (e.lunge!.n < Math.round(ELITE.lunge.telegraphSec / DT)) expect(tick(0, -100)).toBe(true); // tracks the player
    expect(e.x).toBe(100); // still during the telegraph
    expect(e.y).toBe(0);
    while (tick(0, 9999)); // the player moved after the lock: the dash keeps the held aim
    expect(e.x).toBeCloseTo(100);
    expect(e.y).toBeCloseTo(-60);
    expect(tick(0, -50)).toBe(false); // on cooldown
    w.time = e.lungeReadyAt!;
    expect(tick(0, -50)).toBe(true);
  });
});

describe('late waves scale with the player (design.md 16.13)', () => {
  it('wavePowerMul is 1 before the first fight, grows per level gained after 5:00, and is off during a fight', () => {
    const w = createWorld(1);
    expect(wavePowerMul(w)).toBe(1); // no baseline captured yet
    w.powerBaseLevel = w.level; // baseline at the first target; same level -> factor 1
    expect(wavePowerMul(w)).toBeCloseTo(1, 5);
    // 10 levels gained after 5:00 -> 1 + hpPerLevel x 10.
    w.level += 10;
    expect(wavePowerMul(w)).toBeCloseTo(1 + SCALING.hpPerLevel * 10, 5);
    // The arena's adds never scale this way.
    w.arena = { camX: 0, camY: 0, x0: 0, y0: 0, x1: 1, y1: 1, lockedAt: 0 };
    expect(wavePowerMul(w)).toBe(1);
  });

  it('scales a post-5:00 wave enemy HP by the level factor, and not before 5:00', () => {
    const w = createWorld(7);
    w.player.hp = w.stats.maxHp = 1e9;
    // Before the first fight: no baseline, so a wave enemy keeps the plain per-minute HP.
    let early: Enemy | undefined;
    for (let i = 0; i < 400 && !early; i++) {
      step(w, { mx: 0, my: 0 });
      early = w.enemies.find((e) => !e.veteran && !e.elite && !e.fleeing);
    }
    expect(early).toBeTruthy();
    expect(early!.maxHp).toBeCloseTo(early!.def.hp * (1 + 0.14 * (w.contractTime / 60)), 0);

    // Past the first fight, 20 levels gained: trash spawns at (1 + hpPerLevel x 20) the plain HP.
    const f = createWorld(7);
    f.target = 1; // first target down; next fight is far off (9:00)
    f.powerBaseLevel = f.level;
    f.level += 20;
    f.player.hp = f.stats.maxHp = 1e9;
    setClock(f, Math.round(400 / DT)); // contract 6:40, between fights
    let late: Enemy | undefined;
    let at = 0;
    for (let i = 0; i < 600 && !late; i++) {
      if (f.phase !== 'play') {
        f.phase = 'play';
        f.pendingLevels = 0;
      }
      step(f, { mx: 0, my: 0 });
      late = f.enemies.find((e) => !e.veteran && !e.elite && !e.fleeing && !e.noScrap);
      at = f.contractTime;
    }
    expect(late).toBeTruthy();
    const timeOnly = late!.def.hp * (1 + 0.14 * (at / 60));
    expect(late!.maxHp / timeOnly).toBeCloseTo(1 + SCALING.hpPerLevel * 20, 1);
  });

  it('floors a post-5:00 elite HP at eliteDpsSec x sheet DPS (design.md 16.13)', () => {
    const w = createWorld(9);
    w.target = 1; // between the first and second fights
    w.powerBaseLevel = 1;
    w.stacks.dmg = 400;
    w.stacks.rof = 300;
    w.stats = computeStats(w.stacks); // a big build, so the DPS floor beats the x20 formula
    w.player.hp = w.stats.maxHp = 1e9;
    setClock(w, Math.round(400 / DT));
    w.nextEliteAt = Math.round(w.contractTime);
    let e: Enemy | undefined;
    for (let i = 0; i < 1200 && !e; i++) {
      if (w.phase !== 'play') {
        w.phase = 'play';
        w.pendingLevels = 0;
      }
      step(w, { mx: 0, my: 0 });
      e = w.enemies.find((x) => x.elite);
    }
    expect(e).toBeTruthy();
    const dps = sheetDps(w.stats, PERK_RULES.critMultiplier);
    const base = e!.def.hp * ELITE.byType[e!.def.id].hp * (1 + 0.14 * (w.contractTime / 60));
    expect(ELITE.dpsSec * dps).toBeGreaterThan(base); // the floor is the binding one here
    expect(e!.maxHp).toBeCloseTo(ELITE.dpsSec * dps, 0);
  });
});

describe('bosses are skill gates (design.md 16.15)', () => {
  const bossHpFor = (build: (w: World) => void): number => {
    const w = createWorld(5);
    w.player.hp = w.stats.maxHp = 1e9;
    w.level = 30; // forced level, to prove HP is independent of it too
    build(w);
    toFight(w, 0);
    for (let i = 0; i < 20 * 60 && !w.boss; i++) {
      if (w.phase !== 'play') {
        w.phase = 'play';
        w.pendingLevels = 0;
      }
      step(w, { mx: 0, my: 0 });
    }
    return w.boss!.maxHp;
  };

  it('gives every build the same fixed boss HP (no DPS or level coupling)', () => {
    // The boss is a skill gate, not a DPS check: its HP is a fixed number, the same wall for a DPS build,
    // a crowd-clear build and any level. Single-target damage and skill decide the fight, not a scaled HP.
    const dps = bossHpFor((w) => {
      w.stacks.dmg = 500;
      w.stacks.rof = 400;
      w.stats = computeStats(w.stacks);
    });
    const cc = bossHpFor((w) => {
      w.stacks.ricochet = 7;
      w.stacks.multishot = 5;
      w.stats = computeStats(w.stacks);
    });
    expect(dps).toBe(cc);
    expect(dps).toBe(BOSSES[0].hp); // LT. HAMMER's fixed HP
  });

  const host = () => {
    const h = {
      time: 0,
      level: 10,
      stats: { damage: 10, fireRate: 5, projectiles: 1, crit: 0 },
      player: { x: 0, y: 1000 }, // well away, so the boss just walks and never contacts
      rng: createRng(99),
      enemyBullets: [] as BossHost['enemyBullets'],
      arena: null as BossHost['arena'],
      mines: [] as Mine[],
      artillery: [] as ArtilleryCircle[],
      smokes: [] as Smoke[],
      adds: [] as [number, string | undefined, number | undefined][],
      hitPlayer() {},
      addBlast() {},
      spawnAddsRing(count: number, kind?: string, _ang?: number, hpMul?: number) {
        h.adds.push([count, kind, hpMul]);
      },
    };
    return h;
  };

  it('armors HAMMER except in his post-charge window; VIPER and the Warlord are never armored', () => {
    // A charger (LT. HAMMER): guarded by default, full damage only while the vulnerable window is open.
    const hammer = createBoss(host(), 0);
    hammer.vulnT = 0;
    expect(bossDamageMul(hammer)).toBeCloseTo(BOSS.guard.mul); // guarded
    hammer.vulnT = BOSS.guard.recoverSec;
    expect(bossDamageMul(hammer)).toBe(1); // punish window: full damage
    // The gunner (VIPER) and the Warlord take full damage always — their gates are positional / survival.
    const viper = createBoss(host(), 1);
    const warlord = createBoss(host(), 2);
    viper.vulnT = 0;
    warlord.vulnT = 0;
    expect(bossDamageMul(viper)).toBe(1);
    expect(bossDamageMul(warlord)).toBe(1);
  });

  it("opens HAMMER's vulnerable window when a charge ends", () => {
    const h = host();
    const b = createBoss(h, 0);
    b.damageable = true;
    b.state = 'charge';
    b.chargeLeft = 1; // about to finish this frame
    b.dirX = 0;
    b.dirY = 1;
    b.vulnT = 0;
    expect(bossDamageMul(b)).toBeCloseTo(BOSS.guard.mul); // guarded mid-charge
    updateBoss(b, h);
    expect(b.state).toBe('walk');
    expect(b.vulnT).toBeGreaterThan(0); // the punish window is now open
    expect(bossDamageMul(b)).toBe(1);
  });

  it('plants HAMMER on the spot for his whole open window (Esteban: no slide)', () => {
    const h = host();
    const b = createBoss(h, 0);
    b.damageable = true;
    b.state = 'charge';
    b.chargeLeft = 1;
    b.dirX = 0;
    b.dirY = 1;
    updateBoss(b, h);
    const x = b.x;
    const y = b.y;
    while (b.vulnT > 0) {
      updateBoss(b, h);
      if (b.vulnT > 0) {
        expect(b.x).toBe(x);
        expect(b.y).toBe(y);
        expect(b.moving).toBe(false);
      }
    }
    updateBoss(b, h);
    expect(Math.hypot(b.x - x, b.y - y)).toBeGreaterThan(0); // walking again once guarded
  });

  it('fires a slam shockwave ring when a HAMMER charge ends (playtest 2, design.md 16.15)', () => {
    const h = host();
    const b = createBoss(h, 0);
    b.damageable = true;
    b.state = 'charge';
    b.chargeLeft = 1;
    b.dirX = 0;
    b.dirY = 1;
    b.phase = 1;
    updateBoss(b, h);
    expect(h.enemyBullets.length).toBe(BOSS.slam.bullets); // a full ring from his stop point
    for (const s of h.enemyBullets) expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(BOSS.slam.speed, 5);
    // The Warlord, who reuses the charge, does not slam.
    const h2 = host();
    const w = createBoss(h2, 2);
    w.damageable = true;
    w.state = 'charge';
    w.chargeLeft = 1;
    w.dirX = 0;
    w.dirY = 1;
    updateBoss(w, h2);
    expect(h2.enemyBullets.length).toBe(0);
  });

  it('chains phase-3 charges and only opens the window after the last (playtest 2, design.md 16.15)', () => {
    const h = host();
    const b = createBoss(h, 0);
    b.damageable = true;
    b.phase = 3;
    b.state = 'charge';
    b.chargeLeft = 1;
    b.dirX = 0;
    b.dirY = 1;
    b.chargeChain = 1; // one more charge to chain
    updateBoss(b, h);
    expect(b.state).toBe('telegraph'); // straight into the next charge, no walk
    expect(b.chargeChain).toBe(0);
    expect(b.vulnT).toBe(0); // still guarded — the window waits for the last charge
    // Finish the chained charge: now it recovers and the window opens.
    b.state = 'charge';
    b.chargeLeft = 1;
    updateBoss(b, h);
    expect(b.state).toBe('walk');
    expect(b.vulnT).toBeGreaterThan(0);
  });

  it('spawns tanky Heavy shield mobs for HAMMER from phase 1 (playtest 2, design.md 16.15)', () => {
    const h = host();
    const b = createBoss(h, 0);
    b.damageable = true;
    b.state = 'walk';
    b.phase = 1;
    b.addsCd = 0;
    updateBoss(b, h);
    const heavy = h.adds.find((a) => a[1] === 'heavy');
    expect(heavy).toBeTruthy();
    expect(heavy![0]).toBe(BOSS.shieldAdds.count);
    expect(heavy![2]).toBe(BOSS.shieldAdds.hpMul); // spawned tanky
  });
});

describe('sandbox (start menu)', () => {
  it('sets up a pre-built level, crate picks and a chosen boss', () => {
    const w = createWorld(5, { level: 10, crates: 3, boss: 1 });
    expect(w.sandbox).toBe(true);
    expect(w.pendingLevels).toBe(9); // level 1 start, 9 picks to reach level 10
    expect(w.pendingCrates).toBe(3);
    expect(w.target).toBe(1); // LT. VIPER
    expect(w.level).toBe(1);
  });

  it('takes the picks, drops straight into the chosen boss with no waves, and ends on the kill', () => {
    const w = createWorld(7, { level: 8, crates: 2, boss: 0 });
    for (let i = 0; i < 500 && (w.pendingLevels > 0 || w.pendingCrates > 0); i++) {
      if (w.phase === 'levelup' || w.phase === 'crate') choosePerk(w, w.offer[0].id);
      else step(w, { mx: 0, my: 0 });
    }
    expect(w.level).toBe(8); // started at the chosen level after the picks
    expect(w.pendingCrates).toBe(0);
    w.player.hp = w.stats.maxHp = 1e9; // survive the fight for the test
    for (let i = 0; i < 20 * 60 && !w.boss; i++) step(w, { mx: 0, my: 0 });
    expect(w.arena).not.toBeNull(); // dropped straight into the arena
    expect(w.boss!.target).toBe(0); // the chosen boss, LT. HAMMER
    expect(w.elitesSpawned).toBe(0); // sandbox never runs the wave/elite system
    for (let i = 0; i < 30 * 60 && !w.boss!.damageable; i++) step(w, { mx: 0, my: 0 });
    w.boss!.hp = 1;
    for (let i = 0; i < 10 * 60 && !w.won; i++) step(w, { mx: 0, my: 0 });
    expect(w.won).toBe(true); // a single-boss run: the kill ends it
    expect(w.targetsDown).toBe(1);
  });
});

describe('big arena & smoke break (design.md 16.16)', () => {
  const toBoss = (w: World, i: number): void => {
    w.player.hp = w.stats.maxHp = 1e9;
    toFight(w, i);
    for (let k = 0; k < 20 * 60 && !w.boss; k++) {
      if (w.phase !== 'play') {
        w.phase = 'play';
        w.pendingLevels = 0;
      }
      step(w, { mx: 0, my: 0 });
    }
  };

  it('gives VIPER a big arena the camera follows; HAMMER stays screen-sized and frozen', () => {
    const wv = createWorld(9);
    toBoss(wv, 1);
    expect(wv.arena).not.toBeNull();
    expect(wv.arena!.x1 - wv.arena!.x0).toBeGreaterThan(NATIVE_WIDTH); // VIPER's arena is bigger than the screen
    const c0 = cameraAt(wv, wv.viewH);
    wv.player.x += 300;
    expect(cameraAt(wv, wv.viewH).x).not.toBe(c0.x); // the camera follows him in the big arena

    const wh = createWorld(3);
    toBoss(wh, 0);
    expect(wh.arena!.x1 - wh.arena!.x0).toBeLessThan(NATIVE_WIDTH); // HAMMER's arena fits the screen
    const h0 = cameraAt(wh, wh.viewH);
    wh.player.x += 60;
    expect(cameraAt(wh, wh.viewH).x).toBe(h0.x); // frozen, as before
  });

  it('arms the break on taking damage, then smokes and sprints to a far corner', () => {
    const h = {
      time: 0,
      level: 10,
      stats: { damage: 10, fireRate: 5, projectiles: 1, crit: 0 },
      player: { x: 120, y: 0 },
      rng: createRng(42),
      enemyBullets: [] as BossHost['enemyBullets'],
      arena: { x0: -600, y0: -600, x1: 600, y1: 600 } as BossHost['arena'],
      mines: [] as Mine[],
      artillery: [] as ArtilleryCircle[],
      smokes: [] as Smoke[],
      hitPlayer() {},
      addBlast() {},
      spawnAddsRing() {},
    };
    const b = createBoss(h, 1); // LT. VIPER
    b.x = 0;
    b.y = 0;
    b.state = 'walk';
    b.damageable = true;
    b.arrivedAt = 0;
    h.time += DT;
    updateBoss(b, h); // settle hpSeen
    b.hp -= 500; // a fresh hit arms the break
    for (let i = 0; i < Math.round((VIPER.break.sec + 0.1) / DT) && b.vanishLeft <= 0; i++) {
      h.time += DT;
      updateBoss(b, h);
    }
    // Swallowed by the departure cloud first: still where he was, holding fire, for vanishSec.
    expect(b.vanishLeft).toBeGreaterThan(0);
    expect(h.smokes.length).toBe(1);
    const at = [b.x, b.y];
    expect([h.smokes[0].x, h.smokes[0].y]).toEqual(at); // the cloud is on him
    const shots = h.enemyBullets.length;
    for (let i = 0; i < Math.round(VIPER.break.vanishSec / DT) - 2; i++) {
      h.time += DT;
      updateBoss(b, h);
      expect([b.x, b.y]).toEqual(at);
    }
    expect(h.enemyBullets.length).toBe(shots);
    for (let i = 0; i < 10 && b.breakLeft <= 0; i++) {
      h.time += DT;
      updateBoss(b, h);
    }
    expect(h.smokes.length).toBe(2); // smoke where he vanished and where he reappears
    expect(b.breakLeft).toBeGreaterThan(0); // settling after the teleport, not cornered
    // He teleported to a far corner, well away from the player.
    expect(Math.hypot(b.x - h.player.x, b.y - h.player.y)).toBeGreaterThan(400);
  });
});
