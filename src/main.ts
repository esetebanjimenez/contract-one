import { Application, Graphics, Text } from 'pixi.js';
import { NATIVE_HEIGHT, NATIVE_WIDTH } from './data/display';
import { integerScale } from './render/scale';

async function boot(): Promise<void> {
  const host = document.getElementById('app')!;
  const app = new Application();
  await app.init({ width: NATIVE_WIDTH, height: NATIVE_HEIGHT, background: '#111318', antialias: false, roundPixels: true });
  host.appendChild(app.canvas);

  const ground = new Graphics().rect(8, 8, NATIVE_WIDTH - 16, NATIVE_HEIGHT - 16).stroke({ color: 0x3a3f4b, width: 2 });
  const zone = new Graphics().rect(8, (NATIVE_HEIGHT * 2) / 3, NATIVE_WIDTH - 16, NATIVE_HEIGHT / 3 - 8).fill({ color: 0x1b1e25 });
  const player = new Graphics()
    .rect(NATIVE_WIDTH / 2 - 12, NATIVE_HEIGHT / 2 - 12, 24, 24)
    .fill(0xc8b48a)
    .stroke({ color: 0x0b0c10, width: 2 });
  const title = new Text({ text: 'CONTRACT ONE', style: { fill: 0xe8e0c8, fontFamily: 'monospace', fontSize: 24, fontWeight: 'bold' } });
  title.anchor.set(0.5);
  title.position.set(NATIVE_WIDTH / 2, 120);
  const sub = new Text({ text: 'M0 placeholder - joystick zone below', style: { fill: 0x7a8090, fontFamily: 'monospace', fontSize: 11 } });
  sub.anchor.set(0.5);
  sub.position.set(NATIVE_WIDTH / 2, 150);
  app.stage.addChild(ground, zone, player, title, sub);

  const fit = (): void => {
    const s = integerScale(window.innerWidth, window.innerHeight, NATIVE_WIDTH, NATIVE_HEIGHT);
    app.canvas.style.width = `${NATIVE_WIDTH * s}px`;
    app.canvas.style.height = `${NATIVE_HEIGHT * s}px`;
  };
  window.addEventListener('resize', fit);
  fit();
}

void boot();
