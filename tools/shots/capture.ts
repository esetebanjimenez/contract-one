/**
 * Builds nothing: serves dist-shots (pnpm shots:build) and saves the level-up, boss and results screens
 * (and a grunt crowd) to shots/ at the phone viewport. Fails on a page error or when a screen is missing what it must show.
 */
import { mkdirSync } from 'node:fs';
import puppeteer, { type Page } from 'puppeteer-core';
import { preview } from 'vite';

const OUT = 'shots';
const PORT = Number(process.env.SHOTS_PORT ?? 4317);
const URL = `http://localhost:${PORT}/contract-one/tools/shots/index.html`;
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

interface Check {
  scene: string;
  waitMs: number;
  ok: (p: Page) => Promise<string | null>; // null when fine, else what is wrong
}

const checks: Check[] = [
  {
    scene: 'levelup',
    waitMs: 500,
    ok: async (p) => {
      const cards = await p.$$eval('.modal:not([hidden]) .cards .card', (e) => e.length);
      const kit = await p.$('.modal:not([hidden]) .kit');
      if (cards !== 4) return `expected 4 cards, saw ${cards}`;
      return kit ? null : 'no YOUR KIT strip';
    },
  },
  {
    scene: 'boss',
    waitMs: 500,
    ok: async (p) =>
      (await p.evaluate(() => (window as unknown as { __world: { boss: { damageable: boolean } | null } }).__world.boss?.damageable))
        ? null
        : 'the Warlord is not in the fight',
  },
  {
    scene: 'viper',
    waitMs: 150,
    ok: async (p) => {
      const s = await p.evaluate(() => {
        const w = (window as unknown as { __world: { boss: { target: number } | null; mines: unknown[] } }).__world;
        return { target: w.boss?.target ?? -1, mines: w.mines.length };
      });
      if (s.target !== 1) return 'LT. VIPER is not in the fight';
      return s.mines >= 3 ? null : `expected his mines, saw ${s.mines}`;
    },
  },
  {
    scene: 'grunts',
    waitMs: 300,
    ok: async (p) => {
      const n = await p.evaluate(
        () =>
          (window as unknown as { __world: { enemies: { def: { id: string } }[] } }).__world.enemies.filter((e) => e.def.id === 'grunt')
            .length,
      );
      return n >= 12 ? null : `expected the 12-grunt ring, saw ${n}`;
    },
  },
  {
    scene: 'numbers',
    waitMs: 300,
    ok: async (p) => {
      const ns = await p.evaluate(() => (window as unknown as { __world: { damageNumbers: { crit: boolean }[] } }).__world.damageNumbers);
      if (ns.length < 8) return `expected a busy fight, saw ${ns.length} damage numbers`;
      return ns.some((n) => n.crit) ? null : 'no crit number on screen';
    },
  },
  {
    scene: 'results',
    waitMs: 4000, // slow-mo, then the results delay
    ok: async (p) => ((await p.$('.modal:not([hidden]) .results.won')) ? null : 'no CONTRACT COMPLETE results screen'),
  },
];

mkdirSync(OUT, { recursive: true });
const server = await preview({ configFile: 'vite.shots.config.ts', preview: { port: PORT, strictPort: true } });
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const failures: string[] = [];
try {
  for (const c of checks) {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewport({ width: 412, height: 860, deviceScaleFactor: 2 });
    await page.goto(`${URL}?scene=${c.scene}`);
    try {
      await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, { timeout: 60000 });
      await new Promise((r) => setTimeout(r, c.waitMs));
      await page.screenshot({ path: `${OUT}/${c.scene}.png` });
      const bad = await c.ok(page);
      if (bad) failures.push(`${c.scene}: ${bad}`);
    } catch (e) {
      failures.push(`${c.scene}: ${(e as Error).message}`);
    }
    if (errors.length) failures.push(`${c.scene}: page error ${errors.join('; ')}`);
    console.log(`${c.scene}: saved ${OUT}/${c.scene}.png`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise<void>((r) => server.httpServer.close(() => r()));
}
if (failures.length) {
  console.error('Screenshots FAILED:\n' + failures.join('\n'));
  process.exit(1);
}
console.log('Screenshots passed.');
