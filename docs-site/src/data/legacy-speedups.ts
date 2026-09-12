// ===========================================================================
// docs-site/src/data/legacy-speedups.ts
//
// The 1.x-versus-2.x ratios, read from config/perf-baseline.json.
//
// This module exists because three pages had the ratios TYPED IN — ×0.11 on a
// single field, ×0.35 on three fields, ×1.57 on arrays — and kept displaying
// them after the numbers moved. It is the same failure this repository has now
// had four times (conformance rate, version, bundle size, competitor table),
// and the fix is the same one that worked the other three times: the page does
// not hold a number, it reads the file the benchmark wrote.
//
// A shape whose comparison could not be made (the legacy sources would not
// extract, or the ref no longer points at 1.x) has a null speedup. Callers get
// null and must decide what to render — never a stale figure standing in for a
// measurement that did not happen.
// ===========================================================================
import perfBaseline from "../../../config/perf-baseline.json";

export type LegacyShape =
  | "singleField"
  | "multiField"
  | "nested"
  | "array"
  | "jsonSchema";

/** `×0.51`, or null when this shape has no usable comparison. */
export function legacySpeedup(shape: LegacyShape): string | null {
  const row = perfBaseline.legacyComparison.find(
    (entry) => entry.shape === shape
  );
  if (row === undefined || row.speedup === null) return null;
  return `×${row.speedup}`;
}

/** Every shape at once, for prose that names several in one sentence. */
export const legacySpeedups = {
  singleField: legacySpeedup("singleField"),
  multiField: legacySpeedup("multiField"),
  nested: legacySpeedup("nested"),
  array: legacySpeedup("array"),
  jsonSchema: legacySpeedup("jsonSchema"),
} as const;
