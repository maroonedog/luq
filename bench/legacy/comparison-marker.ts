// The one line bench/legacy/compare-implementations.ts prints and
// bench/measure-legacy-throughput.ts reads. It lives in its own module because
// the child script RUNS on import: a parent that imported the marker from it
// would run the whole comparison inside itself, in a process whose ts-node is
// not in transpile-only mode, and get a compile error instead of a number.
export const COMPARISON_MARKER = "LUQ_BENCH_LEGACY_JSON ";
