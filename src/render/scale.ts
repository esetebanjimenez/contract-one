/** Largest whole-number scale that fits the native canvas inside the viewport (at least 1). */
export function integerScale(viewW: number, viewH: number, nativeW: number, nativeH: number): number {
  return Math.max(1, Math.floor(Math.min(viewW / nativeW, viewH / nativeH)));
}
