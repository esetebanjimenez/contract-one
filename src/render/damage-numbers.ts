import { Container, Sprite, Texture } from 'pixi.js';
import { DAMAGE_NUMBERS as DN, formatDamage } from '../data/damage-numbers';
import { damageNumberLook } from '../sim/damage-numbers';
import type { World } from '../sim/world';

const GLYPHS = '0123456789.k!';
const MAX_CHARS = 6; // "10.2k!" / "9999!"

interface Glyph {
  fill: Texture;
  outline: Texture;
  advance: number;
}
type Style = 'normal' | 'crit';

/** Pixel-crisp glyph: the font drawn, thresholded to solid pixels, plus a 1 px outline ring as its own texture. */
function bakeGlyph(ch: string, px: number, color: string): Glyph {
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = `${px}px Silkscreen`;
  const advance = Math.ceil(probe.measureText(ch).width);
  const w = advance + 2;
  const h = px + 2;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.font = `${px}px Silkscreen`;
  g.textBaseline = 'top';
  g.fillStyle = '#fff';
  g.fillText(ch, 1, 1);
  const src = g.getImageData(0, 0, w, h).data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] >= 128;
  const paint = (test: (x: number, y: number) => boolean, hex: string): Texture => {
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const og = out.getContext('2d')!;
    og.fillStyle = hex;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (test(x, y)) og.fillRect(x, y, 1, 1);
    const t = Texture.from(out);
    t.source.scaleMode = 'nearest';
    return t;
  };
  const fill = paint(solid, color);
  const outline = paint((x, y) => !solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)), DN.outline);
  return { fill, outline, advance };
}

/** One number: all outlines under all fills, so neighbouring glyphs never cover each other. */
class Slot {
  readonly root = new Container();
  private readonly outlines = new Container();
  private readonly fills = new Container();
  private readonly o: Sprite[] = [];
  private readonly f: Sprite[] = [];
  private text = '';
  constructor() {
    this.root.addChild(this.outlines, this.fills);
    for (let i = 0; i < MAX_CHARS; i++) {
      this.o.push(this.outlines.addChild(new Sprite()));
      this.f.push(this.fills.addChild(new Sprite()));
    }
  }
  set(text: string, glyphs: Record<string, Glyph>, px: number): void {
    if (text === this.text) return;
    this.text = text;
    let x = 0;
    for (let i = 0; i < MAX_CHARS; i++) {
      const g = i < text.length ? glyphs[text[i]] : undefined;
      this.o[i].visible = this.f[i].visible = !!g;
      if (!g) continue;
      this.o[i].texture = g.outline;
      this.f[i].texture = g.fill;
      this.o[i].position.set(x - 1, -1);
      this.f[i].position.set(x - 1, -1);
      x += g.advance;
    }
    this.root.pivot.set(Math.round(x / 2), px);
  }
}

/** design.md 16.10 floating damage numbers, drawn from the sim's effect list. */
export class DamageNumbers {
  readonly layer = new Container();
  private glyphs = {} as Record<Style, Record<string, Glyph>>;
  private slots: Slot[] = [];

  async load(): Promise<void> {
    await Promise.all([document.fonts.load(`${DN.normal.px}px Silkscreen`), document.fonts.load(`${DN.crit.px}px Silkscreen`)]);
    for (const style of ['normal', 'crit'] as Style[]) {
      const { px, color } = DN[style];
      this.glyphs[style] = Object.fromEntries([...GLYPHS].map((ch) => [ch, bakeGlyph(ch, px, color)]));
    }
    for (let i = 0; i < DN.cap; i++) {
      const s = new Slot();
      s.root.visible = false;
      this.slots.push(s);
      this.layer.addChild(s.root);
    }
  }

  draw(w: World): void {
    const list = w.damageNumbers;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      const n = list[i];
      s.root.visible = !!n;
      if (!n) continue;
      const style: Style = n.crit ? 'crit' : 'normal';
      s.set(formatDamage(n.value, n.crit), this.glyphs[style], DN[style].px);
      const look = damageNumberLook(n, w.time);
      s.root.position.set(Math.round(n.x), Math.round(n.y) - look.rise);
      s.root.scale.set(look.scale);
      s.root.alpha = look.alpha;
    }
  }
}
