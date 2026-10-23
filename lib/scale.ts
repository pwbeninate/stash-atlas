/**
 * Round axis ticks from 0 up to at least `max`, using steps of 1, 2, 2.5, or
 * 5 × 10^k so labels read cleanly (0 / 50K / 100K …).
 */
export function niceTicks(max: number, targetCount = 4): number[] {
  if (!(max > 0) || !Number.isFinite(max)) return [0, 1];
  const rough = max / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ??
    10 * magnitude;
  const ticks: number[] = [];
  for (let i = 0; ; i++) {
    // Round away float noise like 0.30000000000000004.
    const tick = Number((i * step).toPrecision(12));
    ticks.push(tick);
    if (tick >= max) break;
  }
  return ticks;
}
