/**
 * CI sim smoke: a short seeded bot run per bot. Fails if the game throws,
 * if no bot reaches a target (so the HP check would prove nothing),
 * or if any target spawns below the BOSS.hpMin floor.
 */
import { BOSS, BOSSES } from '../src/data/boss';
import { runBot, type Bot } from './bots';

const bots: Bot[] = ['idle', 'kite', 'kite-smart', 'collector', 'cc'];
const seeds = [1, 2];
const failures: string[] = [];
let reachedBoss = 0;

for (const bot of bots) {
  for (const seed of seeds) {
    try {
      const r = runBot(seed, bot);
      for (const f of r.fights) {
        reachedBoss++;
        if (f.hp < BOSS.hpMin) failures.push(`${bot} seed ${seed}: ${BOSSES[f.target].name} HP ${f.hp} < ${BOSS.hpMin}`);
      }
      const hps = r.fights.map((f) => `${BOSSES[f.target].name} ${f.hp}`).join(', ') || 'none';
      console.log(`${bot} seed ${seed}: level ${r.level}, targets down ${r.targetsDown}, spawned: ${hps}`);
    } catch (e) {
      failures.push(`${bot} seed ${seed}: crashed: ${(e as Error).stack ?? String(e)}`);
    }
  }
}
if (reachedBoss === 0) failures.push('no bot reached a target, so boss HP was not checked');
if (failures.length) {
  console.error('Sim smoke FAILED:\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`Sim smoke passed (${reachedBoss} boss spawns checked).`);
