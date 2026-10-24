import { runBot, type Bot } from './bots';

const runs = Number(process.env.RUNS ?? 20);
const bots: Bot[] = (process.env.BOTS?.split(',') as Bot[]) ?? ['idle', 'kite', 'kite-smart'];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

console.log(
  `| Bot | Runs | Reached 10:00 | Median survival | Median level | Median kills | Scrap collected | Peak enemies | Peak bullets |`,
);
console.log(`|---|---|---|---|---|---|---|---|---|`);
for (const bot of bots) {
  const rs = Array.from({ length: runs }, (_, i) => runBot(1000 + i, bot));
  const med = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  console.log(
    `| ${bot} | ${runs} | ${Math.round((100 * rs.filter((r) => r.reachedBoss).length) / runs)}% | ${fmt(med(rs.map((r) => r.survivedSec)))} | ${med(rs.map((r) => r.level))} | ${med(rs.map((r) => r.kills))} | ${Math.round(med(rs.map((r) => r.scrapPct)))}% | ${Math.max(...rs.map((r) => r.peakEnemies))} | ${Math.max(...rs.map((r) => r.peakBullets))} |`,
  );
}
