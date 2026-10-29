import { Application } from 'pixi.js';
import { MAX_VIEW_HEIGHT, NATIVE_HEIGHT, NATIVE_WIDTH } from './data/display';
import { LIEUTENANT_DOWN } from './data/boss';
import { RUN } from './data/run';
import { DT } from './data/sim';
import { Renderer } from './render/renderer';
import { choosePerk, createWorld, step, type World } from './sim/world';
import { Hud } from './ui/hud';
import { Menu } from './ui/menu';
import { Loading } from './ui/loading';
import { Controls } from './ui/input';
import './ui/style.css';

/** Starts the game on `first` (a fresh run by default). New contracts always start fresh. */
export async function boot(first?: () => World): Promise<void> {
  const host = document.getElementById('app')!;
  const frame = document.createElement('div');
  frame.className = 'frame';
  host.appendChild(frame);

  // Loading screen (title + progress bar) over everything while the art loads.
  const loading = new Loading(host);

  const app = new Application();
  await app.init({ width: NATIVE_WIDTH, height: NATIVE_HEIGHT, background: '#2a2117', antialias: false, roundPixels: true });
  frame.appendChild(app.canvas);

  const renderer = new Renderer(app);
  let scale = 1;
  let viewH = NATIVE_HEIGHT;
  const fit = (): void => {
    // Fill the screen: width-fit on phones, with the view growing taller (up to MAX_VIEW_HEIGHT) to match the aspect.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    scale = Math.min(vw / NATIVE_WIDTH, vh / NATIVE_HEIGHT);
    viewH = Math.max(NATIVE_HEIGHT, Math.min(MAX_VIEW_HEIGHT, Math.floor(vh / scale)));
    app.renderer.resize(NATIVE_WIDTH, viewH);
    renderer.setViewHeight(viewH);
    frame.style.width = `${NATIVE_WIDTH * scale}px`;
    frame.style.height = `${viewH * scale}px`;
    frame.style.setProperty('--s', String(scale));
  };
  window.addEventListener('resize', fit);
  // Go fullscreen on the first tap where the browser allows it (not iOS Safari); fit() reruns on resize.
  const goFullscreen = (): void => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  };
  window.addEventListener('pointerdown', goFullscreen, { once: true });

  const controls = new Controls(frame, (cx, cy) => {
    const r = frame.getBoundingClientRect();
    return { x: (cx - r.left) / scale, y: (cy - r.top) / scale, h: viewH };
  });

  await renderer.load((f) => loading.set(f));
  fit();
  loading.done();

  // Idle world as a backdrop until a mode is chosen; the opaque menu overlay covers it.
  let world = first ? first() : createWorld(Date.now() >>> 0);
  let mode: 'menu' | 'running' = first ? 'running' : 'menu';
  let acc = 0;
  let outro = 0; // real seconds since the win or the death
  let seenDownAt = -1;
  let downSlow = 0; // real seconds of lieutenant-kill slow-mo left

  const newContract = (): World => createWorld(Date.now() >>> 0);
  const startRun = (factory: () => World): void => {
    world = factory();
    mode = 'running';
    acc = 0;
    outro = 0;
    seenDownAt = -1;
    downSlow = 0;
    controls.reset();
    menu.hide();
  };

  const hud = new Hud(
    frame,
    (id) => choosePerk(world, id),
    () => {
      // A sandbox run is a one-off; its results go back to the menu. A contract starts a fresh contract.
      if (world.sandbox) {
        mode = 'menu';
        menu.showMain();
      } else {
        startRun(newContract);
      }
    },
  );

  const menu = new Menu(frame, {
    onStart: () => startRun(newContract),
    onSandbox: (cfg) => startRun(() => createWorld(Date.now() >>> 0, cfg)),
  });
  if (mode === 'menu') menu.showMain();

  app.ticker.add((t) => {
    if (mode === 'menu') return; // the opaque menu overlay covers the frame; nothing to sim or draw
    const dt = t.deltaMS / 1000;
    // Paused: freeze the sim and the outro clock, hide the stick, and draw the held frame (dt 0).
    if (hud.paused) {
      acc = 0;
      controls.reset();
      world.viewH = viewH;
      renderer.draw(world, controls, 0);
      hud.update(world, outro);
      return;
    }
    const ended = world.won || world.phase === 'dead';
    if (ended) outro += dt;
    if (world.downAt !== seenDownAt) {
      seenDownAt = world.downAt;
      downSlow = world.downAt >= 0 ? LIEUTENANT_DOWN.slowMoSec : 0;
    }
    // On the kill: 1 s of slow-mo at 0.3x, then normal speed while the banner shows (design.md 14.4);
    // 0.5 s on a lieutenant kill (16.11).
    let timeScale = world.won && outro < RUN.winSlowMoSec ? RUN.winSlowMoScale : 1;
    if (downSlow > 0 && !world.won) {
      downSlow -= dt;
      timeScale = LIEUTENANT_DOWN.slowMoScale;
    }
    acc = Math.min(acc + dt * timeScale, 0.25);
    if (world.won && Hud.resultsDue(world, outro)) acc = 0;
    while (acc >= DT) {
      acc -= DT;
      if (world.phase !== 'play') {
        acc = 0;
        break;
      }
      step(world, controls.read());
    }
    if (world.phase !== 'play' || Hud.resultsDue(world, outro)) controls.reset();
    world.viewH = viewH;
    renderer.draw(world, controls, dt * timeScale);
    hud.update(world, outro);
  });
}
