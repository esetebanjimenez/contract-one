import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ART = join(__dirname, '../public/art');
/** Width and height from a PNG's IHDR chunk. */
const size = (f: string): [number, number] => {
  const b = readFileSync(join(ART, f));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

describe('elite art (design.md 16.12)', () => {
  const elites = readdirSync(ART).filter((f) => /^(grunt|runner|heavy|rifleman)_elite_/.test(f));

  it('has a hand-drawn elite frame for every grunt weapon, runner, heavy and rifleman frame', () => {
    expect(elites).toHaveLength(19);
  });

  it('draws each elite frame at exactly 1.5x its regular frame, so the renderer can draw it at scale 1', () => {
    for (const f of elites) {
      const [w, h] = size(f.replace('_elite_', '_'));
      expect(size(f), f).toEqual([w * 1.5, h * 1.5]);
    }
  });
});
