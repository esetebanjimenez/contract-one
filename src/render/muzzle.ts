import viperMeta from '../../docs/art/viper_meta.json';
import warlordMeta from '../../docs/art/warlord_meta.json';

/**
 * Where each gun frame's barrel ends (Artist, art/bosses-topdown: docs/art/*_meta.json). Sprites are drawn from
 * overhead facing right at rotation 0, so the aim line and VIPER's tracer start at the muzzle, not at the body.
 */
interface ArtMeta {
  size: number;
  pivot: number[];
  frames: Record<string, { muzzle?: number[] }>;
}
const META: ArtMeta[] = [viperMeta, warlordMeta];
export const BOSS_MUZZLE: Record<string, [number, number]> = {};
for (const m of META)
  for (const [id, f] of Object.entries(m.frames)) if (f.muzzle) BOSS_MUZZLE[id] = [f.muzzle[0] - m.pivot[0], f.muzzle[1] - m.pivot[1]];

/** A muzzle point in world space, with the body pivot (ox, oy) it hangs off. */
export interface Muzzle {
  x: number;
  y: number;
  ox: number;
  oy: number;
}

/** The muzzle of frame `art` in world space, for a sprite at (x, y) turned by `rotation`; null when it has no gun. */
export function muzzleAt(art: string, x: number, y: number, rotation: number): Muzzle | null {
  const o = BOSS_MUZZLE[art];
  if (!o) return null;
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  return { x: x + o[0] * c - o[1] * s, y: y + o[0] * s + o[1] * c, ox: x, oy: y };
}

/**
 * How much of a round's trailing streak to draw: up to `len`, but never back past the muzzle it left. Negative while
 * the round is still behind the muzzle (the sim fires from his body centre), and then it isn't drawn at all.
 */
export function streakFromMuzzle(
  bx: number,
  by: number,
  vx: number,
  vy: number,
  muzzle: { x: number; y: number; ox: number; oy: number },
  len: number,
): number {
  // Only rounds that just left him: one far out keeps its full streak even after he turns or teleports.
  if (Math.hypot(bx - muzzle.ox, by - muzzle.oy) > Math.hypot(muzzle.x - muzzle.ox, muzzle.y - muzzle.oy) + len) return len;
  const sp = Math.hypot(vx, vy) || 1;
  const t = ((bx - muzzle.x) * vx + (by - muzzle.y) * vy) / sp;
  return Math.min(len, t);
}
