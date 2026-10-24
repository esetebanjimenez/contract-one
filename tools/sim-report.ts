/**
 * Sim table for PRs that touch src/data/ (posted as a PR comment by .github/workflows/sim-table.yml).
 * Short bot sim (RUNS per bot, default 8) checked against the current targets (design.md §16.8, with
 * §12.4's idle rule). A miss is a warning in the table, never a failure.
 */
import { RUN } from '../src/data/run';
import { runBot, type Bot, type RunResult } from './bots';

const runs = Number(process.env.RUNS ?? 8);
const bots: Bot[] = ['idle', 'kite', 'kite-smart', 'collector'];
const med = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const pct = (n: number, of: number): number => (of ? Math.round((100 * n) / of) : 0);
const fmt = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

interface Row {
  bot: Bot;
  survival: number;
  reach: number;
  level: number;
  bossHp: number;
  kills: number | null; // boss kill rate of runs that reached him
  fight: number | null;
  enraged: number | null;
}

const rows: Row[] = bots.map((bot) => {
  const rs: RunResult[] = Array.from({ length: runs }, (_, i) => runBot(1000 + i, bot));
  const got = rs.filter((r) => r.reachedBoss);
  return {
    bot,
    survival: med(rs.map((r) => r.survivedSec)),
    reach: pct(got.length, runs),
    level: med(rs.map((r) => r.levelAtBoss)),
    bossHp: med(got.map((r) => r.bossHp)),
    kills: got.length ? pct(got.filter((r) => r.bossKilled).length, got.length) : null,
    fight: got.length ? med(got.map((r) => r.fightSec)) : null,
    enraged: got.length ? pct(got.filter((r) => r.enraged).length, got.length) : null,
  };
});

const warnings: string[] = [];
const check = (ok: boolean, cell: string, msg: string): string => {
  if (ok) return cell;
  warnings.push(msg);
  return `⚠️ ${cell}`;
};
const smart = (r: Row): boolean => r.bot === 'kite-smart';

const lines = [
  `### Sim table (${runs} runs per bot)`,
  '',
  '| Bot | Median survival | Reached boss | Level at boss | Boss HP at spawn | Boss kills | Median fight | Enraged |',
  '|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => {
    const surv =
      r.bot === 'idle'
        ? check(r.survival < 120, fmt(r.survival), `idle survives ${fmt(r.survival)}; target: dies before 2:00 (§12.4)`)
        : fmt(r.survival);
    const reach = smart(r)
      ? check(r.reach >= 80 && r.reach <= 95, `${r.reach}%`, `kite-smart reaches the boss in ${r.reach}%; target 80–95% (§16.8)`)
      : `${r.reach}%`;
    const level = smart(r)
      ? check(r.level >= 20 && r.level <= 30, `${r.level}`, `kite-smart level at boss ${r.level}; target 20–30 (§16.8)`)
      : `${r.level}`;
    const kills =
      r.kills === null
        ? '-'
        : smart(r)
          ? check(r.kills >= 40 && r.kills <= 60, `${r.kills}%`, `kite-smart kills the boss in ${r.kills}%; target 40–60% (§16.8)`)
          : `${r.kills}%`;
    const fight =
      r.fight === null
        ? '-'
        : smart(r)
          ? check(r.fight >= 60 && r.fight <= 120, fmt(r.fight), `kite-smart median fight ${fmt(r.fight)}; target 1:00–2:00 (§16.8)`)
          : fmt(r.fight);
    const enr =
      r.enraged === null
        ? '-'
        : check(r.enraged < 10, `${r.enraged}%`, `${r.bot} enrages in ${r.enraged}% of fights; target under 10% (§16.8)`);
    return `| ${r.bot} | ${surv} | ${reach} | ${level} | ${r.bossHp ? r.bossHp.toLocaleString('en-US') : '-'} | ${kills} | ${fight} | ${enr} |`;
  }),
  '',
  warnings.length
    ? `**${warnings.length} outside target** (warnings only, the check still passes):\n` + warnings.map((w) => `- ${w}`).join('\n')
    : 'All targets met.',
  '',
  `<sub>Seeds 1000–${1000 + runs - 1}. Boss at ${fmt(RUN.contractSec)}. Boss kills, fight and enrage count only runs that reached him. Bots handle the walled arena badly, so tune the fight from Esteban's playtests first (§16.5).</sub>`,
];
console.log(lines.join('\n'));
