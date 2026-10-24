/**
 * CI sim smoke: a short seeded bot run per bot. Fails if the game throws,
 * if no bot reaches the Warlord (so the HP check would prove nothing),
 * or if any Warlord spawns below the BOSS.hpMin floor.
 */
import { BOSS } from '../src/data/boss';
import { runBot, type Bot } from './bots';

const bots: Bot[] = ['idle', 'kite', 'kite-smart', 'collector'];
const seeds = [1, 2];
const failures: string[] = [];
let reachedBoss = 0;

for (const bot of bots) {
  for (const seed of seeds) {
    try {
      const r = runBot(seed, bot);
      if (r.reachedBoss) {
        reachedBoss++;
        if (r.bossHp < BOSS.hpMin) failures.push(`${bot} seed ${seed}: boss HP ${r.bossHp} < ${BOSS.hpMin}`);
      }
      console.log(`${bot} seed ${seed}: level ${r.level}, reached boss ${r.reachedBoss}, boss HP ${r.bossHp}`);
    } catch (e) {
      failures.push(`${bot} seed ${seed}: crashed: ${(e as Error).stack ?? String(e)}`);
    }
  }
}
if (reachedBoss === 0) failures.push('no bot reached the Warlord, so boss HP was not checked');
if (failures.length) {
  console.error('Sim smoke FAILED:\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`Sim smoke passed (${reachedBoss} boss spawns checked).`);
