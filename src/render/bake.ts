import { Texture } from 'pixi.js';

/** Bone-white used for the Elite outline (design.md 13.1). */
export const BONE_WHITE = '#e8e0cc';

function sourceCanvas(t: Texture): HTMLCanvasElement {
  const img = t.source.resource as CanvasImageSource & { width: number; height: number };
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c;
}

function toTexture(c: HTMLCanvasElement): Texture {
  const t = Texture.from(c);
  t.source.scaleMode = 'nearest';
  return t;
}

/** Solid silhouette of a sprite in one colour (used for the 1-frame hit flash). */
export function silhouette(t: Texture, color: string): Texture {
  const c = sourceCanvas(t);
  const g = c.getContext('2d')!;
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return toTexture(c);
}

/**
 * The sprite's opaque pixels in white, except its #14110F outline pixels, which stay transparent. Drawn over the
 * sprite at alpha a, each inner pixel becomes rgb + (255 - rgb) * a while the outline stays dark (boss hit flash).
 */
export function innerWhite(t: Texture): Texture {
  const c = sourceCanvas(t);
  const g = c.getContext('2d')!;
  const d = g.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] === 0) continue;
    const ink = p[i] === 0x14 && p[i + 1] === 0x11 && p[i + 2] === 0x0f;
    p[i] = p[i + 1] = p[i + 2] = 255;
    if (ink) p[i + 3] = 0;
  }
  g.putImageData(d, 0, 0);
  return toTexture(c);
}

/** The sprite with a 1 px outline around its opaque pixels, padded by 1 px on every side. */
export function outlined(t: Texture, color: string): Texture {
  const src = sourceCanvas(t);
  const sil = silhouette(t, color).source.resource as HTMLCanvasElement;
  const c = document.createElement('canvas');
  c.width = src.width + 2;
  c.height = src.height + 2;
  const g = c.getContext('2d')!;
  for (const [dx, dy] of [
    [0, 1],
    [2, 1],
    [1, 0],
    [1, 2],
  ])
    g.drawImage(sil, dx, dy);
  g.drawImage(src, 1, 1);
  return toTexture(c);
}
