// One rounding rule for every figure written to config/perf-baseline.json, so
// two numbers in that file are never rounded differently and then divided.
export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
