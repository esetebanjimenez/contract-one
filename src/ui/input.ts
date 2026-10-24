import { JOYSTICK } from '../data/controls';
import type { Input } from '../sim/world';

/** Floating thumb joystick (bottom third, either thumb) plus WASD/arrows for desktop. */
export class Controls {
  active = false;
  originX = 0; // native px
  originY = 0;
  knobX = 0;
  knobY = 0;
  private pointerId = -1;
  private keys = new Set<string>();

  constructor(
    private readonly el: HTMLElement,
    private readonly toNative: (clientX: number, clientY: number) => { x: number; y: number; h: number },
  ) {
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e));
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private down(e: PointerEvent): void {
    if (this.pointerId !== -1) return;
    const p = this.toNative(e.clientX, e.clientY);
    if (p.y < p.h * JOYSTICK.zoneFromTop) return;
    this.pointerId = e.pointerId;
    this.el.setPointerCapture(e.pointerId);
    this.active = true;
    this.originX = this.knobX = p.x;
    this.originY = this.knobY = p.y;
    e.preventDefault();
  }

  private move(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    const p = this.toNative(e.clientX, e.clientY);
    let dx = p.x - this.originX;
    let dy = p.y - this.originY;
    const d = Math.hypot(dx, dy);
    if (d > JOYSTICK.knobRadius) {
      dx = (dx / d) * JOYSTICK.knobRadius;
      dy = (dy / d) * JOYSTICK.knobRadius;
    }
    this.knobX = this.originX + dx;
    this.knobY = this.originY + dy;
  }

  private up(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = -1;
    this.active = false;
  }

  reset(): void {
    this.pointerId = -1;
    this.active = false;
  }

  read(): Input {
    if (this.active) {
      const dx = (this.knobX - this.originX) / JOYSTICK.knobRadius;
      const dy = (this.knobY - this.originY) / JOYSTICK.knobRadius;
      if (Math.hypot(dx, dy) < JOYSTICK.deadZone) return { mx: 0, my: 0 };
      return { mx: dx, my: dy };
    }
    const k = this.keys;
    const mx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const my = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    return { mx, my };
  }
}
