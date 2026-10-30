import { describe, expect, it } from 'vitest';
import viperMeta from '../docs/art/viper_meta.json';
import { BOSS_MUZZLE, muzzleAt, streakFromMuzzle } from '../src/render/muzzle';

describe('boss muzzle points (art/bosses-topdown)', () => {
  it('has a muzzle for every VIPER and Warlord gun frame', () => {
    expect(Object.keys(BOSS_MUZZLE).filter((k) => k.startsWith('viper_')).length).toBe(Object.keys(viperMeta.frames).length);
    expect(BOSS_MUZZLE.warlordfinal_t1_aim_00).toBeDefined();
  });
  it('turns with the sprite', () => {
    const [ox, oy] = BOSS_MUZZLE.viper_t1_fire_00;
    const r = muzzleAt('viper_t1_fire_00', 0, 0, 0)!;
    expect(r.x).toBeCloseTo(ox);
    expect(r.y).toBeCloseTo(oy);
    const d = muzzleAt('viper_t1_fire_00', 10, 20, Math.PI / 2)!;
    expect(d.x).toBeCloseTo(10 - oy);
    expect(d.y).toBeCloseTo(20 + ox);
    expect(muzzleAt('hammer_t1_idle_00', 0, 0, 0)).toBeNull();
  });
  it('never trails a round back past the muzzle', () => {
    const m = { x: 100, y: 0, ox: 0, oy: 0 };
    expect(streakFromMuzzle(90, 0, 5, 0, m, 30)).toBeLessThan(0); // still inside the rifle
    expect(streakFromMuzzle(110, 0, 5, 0, m, 30)).toBeCloseTo(10);
    expect(streakFromMuzzle(300, 0, 5, 0, m, 30)).toBe(30);
    expect(streakFromMuzzle(-300, 0, -5, 0, m, 30)).toBe(30); // a round fired before he turned keeps its streak
  });
});
