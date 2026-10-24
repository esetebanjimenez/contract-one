/**
 * Sim table for PRs that touch src/data/ (posted as a PR comment by .github/workflows/sim-table.yml).
 * Short bot sim (RUNS per bot, default 8) checked against the current targets (design.md §16.11, with
 * §16.8's level target and §12.4's idle rule). A miss is a warning in the table, never a failure.
 */
import { BOSSES } from '../src/data/boss';
import { runBot, type Bot, type RunResult } from './bots';

const runs = Number(process.env.RUNS ?? 8);
const bots: Bot[] = ['idle', 'kite', 'kite-smart', 'collector'];
const med = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const pct = (n: number, of: number): number => (of ? Math.round((100 * n) / of) : 0);
const fmt = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const range = ([lo, hi]: [number, number], f: (x: number) => string = String): string => `${f(lo)}–${f(hi)}`;

/** kite-smart targets per fight, in BOSSES order (design.md 16.11). */
const FIGHT_TARGETS: { kills: [number, number]; sec: [number, number] }[] = [
  { kills: [70, 85], sec: [40, 90] },
  { kills: [55, 75], sec: [60, 120] },
  { kills: [40, 60], sec: [60, 120] },
];
const REACH_FIRST: [number, number] = [80, 95];
const LEVEL_AT_FIRST: [number, number] = [20, 30];
const ENRAGE_MAX = 10;

const results = new Map<Bot, RunResult[]>(bots.map((bot) => [bot, Array.from({ length: runs }, (_, i) => runBot(1000 + i, bot))]));

const warnings: string[] = [];
const check = (ok: boolean, cell: string, msg: string): string => {
  if (ok) return cell;
  warnings.push(msg);
  return `⚠️ ${cell}`;
};
const within = (x: number, [lo, hi]: [number, number]): boolean => x >= lo && x <= hi;

const runRows = bots.map((bot) => {
  const rs = results.get(bot)!;
  const smart = bot === 'kite-smart';
  const survival = med(rs.map((r) => r.survivedSec));
  const reach = pct(rs.filter((r) => r.reachedBoss).length, runs);
  const level = med(rs.map((r) => r.levelAtBoss));
  const surv =
    bot === 'idle'
      ? check(survival < 120, fmt(survival), `idle survives ${fmt(survival)}; target: dies before 2:00 (§12.4)`)
      : fmt(survival);
  const reachCell = smart
    ? check(
        within(reach, REACH_FIRST),
        `${reach}%`,
        `kite-smart reaches ${BOSSES[0].name} in ${reach}%; target ${range(REACH_FIRST)}% (§16.11)`,
      )
    : `${reach}%`;
  const levelCell = smart
    ? check(
        within(level, LEVEL_AT_FIRST),
        `${level}`,
        `kite-smart level at ${BOSSES[0].name} ${level}; target ${range(LEVEL_AT_FIRST)} (§16.8)`,
      )
    : `${level}`;
  const done = pct(rs.filter((r) => r.bossKilled).length, runs);
  return `| ${bot} | ${surv} | ${reachCell} | ${levelCell} | ${med(rs.map((r) => r.targetsDown))}/${BOSSES.length} | ${done}% |`;
});

const fightRows: string[] = [];
for (const bot of bots) {
  const rs = results.get(bot)!;
  BOSSES.forEach((b, i) => {
    const fs = rs.flatMap((r) => r.fights.filter((f) => f.target === i));
    if (!fs.length) return;
    const smart = bot === 'kite-smart';
    const t = FIGHT_TARGETS[i];
    const kills = pct(fs.filter((f) => f.killed).length, fs.length);
    const sec = med(fs.map((f) => f.sec));
    const enr = pct(fs.filter((f) => f.enraged).length, fs.length);
    const killCell = smart
      ? check(within(kills, t.kills), `${kills}%`, `kite-smart kills ${b.name} in ${kills}%; target ${range(t.kills)}% (§16.11)`)
      : `${kills}%`;
    const secCell = smart
      ? check(within(sec, t.sec), fmt(sec), `kite-smart median ${b.name} fight ${fmt(sec)}; target ${range(t.sec, fmt)} (§16.11)`)
      : fmt(sec);
    const enrCell = check(
      enr < ENRAGE_MAX,
      `${enr}%`,
      `${bot} enrages in ${enr}% of ${b.name} fights; target under ${ENRAGE_MAX}% (§16.11)`,
    );
    fightRows.push(
      `| ${bot} | ${b.name} | ${pct(fs.length, runs)}% | ${med(fs.map((f) => f.level))} | ${med(fs.map((f) => f.hp)).toLocaleString('en-US')} | ${killCell} | ${secCell} | ${enrCell} |`,
    );
  });
}

const lines = [
  `### Sim table (${runs} runs per bot)`,
  '',
  `| Bot | Median survival | Reached ${BOSSES[0].name} | Level at ${BOSSES[0].name} | Median targets down | Contract complete |`,
  '|---|---|---|---|---|---|',
  ...runRows,
  '',
  '| Bot | Target | Reached | Level at spawn | HP at spawn | Kills | Median fight | Enraged |',
  '|---|---|---|---|---|---|---|---|',
  ...fightRows,
  '',
  warnings.length
    ? `**${warnings.length} outside target** (warnings only, the check still passes):\n` + warnings.map((w) => `- ${w}`).join('\n')
    : 'All targets met.',
  '',
  `<sub>Seeds 1000–${1000 + runs - 1}. Targets at ${BOSSES.map((b) => fmt(b.atSec)).join(', ')} contract time. Reached is the share of all runs; kills, fight and enrage count only fights reached. Bots handle the walled arena badly, so tune the fights from Esteban's playtests first (§16.5).</sub>`,
];
console.log(lines.join('\n'));
