import { ENEMIES } from '../src/data/enemies';
import { CAPS } from '../src/data/sim';
import { createWorld, step } from '../src/sim/world';

/** Sim cost at the soft caps: 250 enemies (half Riflemen) around the player and 400 player bullets in flight. */
const w = createWorld(7);
w.tick = 600 * 60; // late-run spawn rate keeps the enemy count pinned at the cap
w.player.hp = w.stats.maxHp = 1e9;
for (let i = 0; i < CAPS.enemies; i++) {
  const a = (i / CAPS.enemies) * Math.PI * 2;
  const r = 60 + (i % 10) * 18;
  const def = i % 2 ? ENEMIES.rifleman : ENEMIES.grunt;
  w.enemies.push({
    id: w.nextEnemyId++,
    def,
    x: Math.cos(a) * r,
    y: Math.sin(a) * r,
    hp: 1e9,
    maxHp: 1e9,
    fireTimer: (i % 20) / 10,
    facing: 1,
    elite: false,
    flash: 0,
    aiming: false,
  });
}
const steps = 1200;
const t0 = performance.now();
for (let s = 0; s < steps; s++) {
  while (w.bullets.length < CAPS.playerBullets) {
    const a = Math.random() * Math.PI * 2;
    w.bullets.push({
      x: 0,
      y: 0,
      vx: Math.cos(a) * 360,
      vy: Math.sin(a) * 360,
      rangeLeft: 260,
      damage: 0,
      pierceLeft: 99,
      bounces: 0,
      hit: [],
    });
  }
  step(w, { mx: Math.cos(s / 60), my: Math.sin(s / 60) });
}
const ms = (performance.now() - t0) / steps;
console.log(
  `Sim step at caps: ${ms.toFixed(3)} ms (${w.enemies.length} enemies, ${w.bullets.length} player bullets, ${w.enemyBullets.length} enemy bullets). Budget at 60 Hz is 16.7 ms.`,
);
