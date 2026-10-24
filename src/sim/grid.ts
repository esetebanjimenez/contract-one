/** Spatial hash over integer cells. Rebuilt every step; buckets are reused to avoid garbage. */
export class SpatialGrid {
  private buckets = new Map<number, number[]>();
  private used: number[][] = [];
  constructor(private readonly cell: number) {}

  private key(cx: number, cy: number): number {
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  clear(): void {
    for (const b of this.used) b.length = 0;
    this.used.length = 0;
  }

  insert(i: number, x: number, y: number): void {
    const k = this.key(Math.floor(x / this.cell), Math.floor(y / this.cell));
    let b = this.buckets.get(k);
    if (!b) {
      b = [];
      this.buckets.set(k, b);
    }
    if (b.length === 0) this.used.push(b);
    b.push(i);
  }

  /** Calls fn for every index in cells overlapping the square around (x, y) with half-size r. */
  query(x: number, y: number, r: number, fn: (i: number) => void): void {
    const x0 = Math.floor((x - r) / this.cell);
    const x1 = Math.floor((x + r) / this.cell);
    const y0 = Math.floor((y - r) / this.cell);
    const y1 = Math.floor((y + r) / this.cell);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const b = this.buckets.get(this.key(cx, cy));
        if (b) for (let n = 0; n < b.length; n++) fn(b[n]);
      }
    }
  }
}
