import { Application } from 'pixi.js';
import { MAX_VIEW_HEIGHT, NATIVE_HEIGHT, NATIVE_WIDTH } from './data/display';
import { DT } from './data/sim';
import { Renderer } from './render/renderer';
import { choosePerk, createWorld, step } from './sim/world';
import { Hud } from './ui/hud';
import { Controls } from './ui/input';
import './ui/style.css';

async function boot(): Promise<void> {
  const host = document.getElementById('app')!;
  const frame = document.createElement('div');
  frame.className = 'frame';
  host.appendChild(frame);

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

  await renderer.load();
  fit();

  let world = createWorld(Date.now() >>> 0);
  const hud = new Hud(
    frame,
    (id) => choosePerk(world, id),
    () => {
      world = createWorld(Date.now() >>> 0);
      controls.reset();
    },
  );

  let acc = 0;
  app.ticker.add((t) => {
    acc = Math.min(acc + t.deltaMS / 1000, 0.25);
    while (acc >= DT) {
      acc -= DT;
      if (world.phase !== 'play') {
        acc = 0;
        break;
      }
      step(world, controls.read());
    }
    if (world.phase !== 'play') controls.reset();
    renderer.draw(world, controls, t.deltaMS / 1000);
    hud.update(world);
  });
}

void boot();
