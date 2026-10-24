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
