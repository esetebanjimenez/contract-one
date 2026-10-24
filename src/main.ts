import { Application } from 'pixi.js';
import { NATIVE_HEIGHT, NATIVE_WIDTH } from './data/display';
import { DT } from './data/sim';
import { Renderer } from './render/renderer';
import { integerScale } from './render/scale';
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

  let scale = 1;
  const fit = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const s = integerScale(window.innerWidth * dpr, window.innerHeight * dpr, NATIVE_WIDTH, NATIVE_HEIGHT);
    scale = s / dpr;
    frame.style.width = `${NATIVE_WIDTH * scale}px`;
    frame.style.height = `${NATIVE_HEIGHT * scale}px`;
    frame.style.setProperty('--s', String(scale));
  };
  window.addEventListener('resize', fit);
  fit();

  const controls = new Controls(frame, (cx, cy) => {
    const r = frame.getBoundingClientRect();
    return { x: (cx - r.left) / scale, y: (cy - r.top) / scale, h: NATIVE_HEIGHT };
  });

  const renderer = new Renderer(app);
  await renderer.load();

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
