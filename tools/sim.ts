import { BOSS } from '../src/data/boss';
import { runBot, type Bot } from './bots';

const runs = Number(process.env.RUNS ?? 20);
const bots: Bot[] = (process.env.BOTS?.split(',') as Bot[]) ?? ['idle', 'kite', 'kite-smart', 'collector'];
const reached = (rs: ReturnType<typeof runBot>[]) => rs.filter((r) => r.reachedBoss);
const bossCol = (rs: ReturnType<typeof runBot>[]) => {
  const r = reached(rs);
  return r.length ? `${Math.round((100 * r.filter((x) => x.bossKilled).length) / r.length)}%` : '-';
};
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

console.log(
  `| Bot | Runs | Reached 10:00 | Median survival | Median level | Level at 10:00 | Median kills | Scrap collected | Peak enemies | Peak bullets | Boss kills (of reached) | Median fight | Enraged | Boss HP at spawn | Landed DPS / sheet |`,
);
console.log(`|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
/** Damage landed on the Warlord per second, as a share of the sheet DPS behind his HP. */
const landed = (rs: ReturnType<typeof runBot>[]): string => {
  const xs = rs
    .filter((r) => r.bossHp > 0 && r.fightSec > 5)
    .map((r) => r.bossDamage / r.fightSec / (r.bossHp / BOSS.hpDpsSec))
    .sort((a, b) => a - b);
  return xs.length ? `${Math.round(100 * xs[Math.floor(xs.length / 2)])}%` : '-';
};
for (const bot of bots) {
  const rs = Array.from({ length: runs }, (_, i) => runBot(1000 + i, bot));
  const med = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  console.log(
    `| ${bot} | ${runs} | ${Math.round((100 * rs.filter((r) => r.reachedBoss).length) / runs)}% | ${fmt(med(rs.map((r) => r.survivedSec)))} | ${med(rs.map((r) => r.level))} | ${med(rs.map((r) => r.levelAt10))} | ${med(rs.map((r) => r.kills))} | ${Math.round(med(rs.map((r) => r.scrapPct)))}% | ${Math.max(...rs.map((r) => r.peakEnemies))} | ${Math.max(...rs.map((r) => r.peakBullets))} | ${bossCol(rs)} | ${reached(rs).length ? fmt(med(reached(rs).map((r) => r.fightSec))) : '-'} | ${reached(rs).filter((r) => r.enraged).length} | ${reached(rs).length ? med(reached(rs).map((r) => r.bossHp)) : '-'} | ${landed(rs)} |`,
  );
}
