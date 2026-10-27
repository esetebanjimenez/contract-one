import { runBot, type Bot } from './bots';

const runs = Number(process.env.RUNS ?? 20);
const bots: Bot[] = (process.env.BOTS?.split(',') as Bot[]) ?? ['idle', 'kite', 'kite-smart', 'collector', 'cc'];
const reached = (rs: ReturnType<typeof runBot>[]) => rs.filter((r) => r.reachedBoss);
const bossCol = (rs: ReturnType<typeof runBot>[]) => {
  const r = reached(rs);
  return r.length ? `${Math.round((100 * r.filter((x) => x.bossKilled).length) / r.length)}%` : '-';
};
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

console.log(
  `| Bot | Runs | Reached boss | Median survival | Median level | Level at boss | Median kills | Scrap collected | Peak enemies | Peak bullets | Contract complete (of reached) | Median first fight | Enraged fights | First target HP |`,
);
console.log(`|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
for (const bot of bots) {
  const rs = Array.from({ length: runs }, (_, i) => runBot(1000 + i, bot));
  const med = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  console.log(
    `| ${bot} | ${runs} | ${Math.round((100 * rs.filter((r) => r.reachedBoss).length) / runs)}% | ${fmt(med(rs.map((r) => r.survivedSec)))} | ${med(rs.map((r) => r.level))} | ${med(rs.map((r) => r.levelAtBoss))} | ${med(rs.map((r) => r.kills))} | ${Math.round(med(rs.map((r) => r.scrapPct)))}% | ${Math.max(...rs.map((r) => r.peakEnemies))} | ${Math.max(...rs.map((r) => r.peakBullets))} | ${bossCol(rs)} | ${reached(rs).length ? fmt(med(reached(rs).map((r) => r.fights[0].sec))) : '-'} | ${rs.flatMap((r) => r.fights).filter((f) => f.enraged).length} | ${reached(rs).length ? med(reached(rs).map((r) => r.fights[0].hp)) : '-'} |`,
  );
}
