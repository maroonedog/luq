// ===========================================================================
// scripts/perf-figures/render-perf-tables.ts
//
// Builds the README's two performance tables from the recorded baseline.
//
// This exists because the same accident had already happened several times
// over. The pass rate, the version, the bundle sizes and the competitor table
// had all been moved to generation; these two tables were what was left, and
// re-recording the benchmark left the README showing the old figures. Once,
// after every shape got substantially faster, the README still advertised the
// speeds from before. Self-consistent, so no check for internal contradiction
// catches it.
//
// The tables are assembled in one place, and writing them and checking them
// go through the same function.
// ===========================================================================

export interface ThroughputRecord {
  readonly shape: string;
  readonly operation: string;
  readonly opsPerSecond: number;
  readonly relativeSpreadPercent: number;
}

export interface LegacyRecord {
  readonly shape: string;
  readonly legacyOpsPerSecond: number | null;
  readonly currentOpsPerSecond: number;
  readonly speedup: number | null;
}

export interface SizeBudgetEntry {
  readonly id: string;
  readonly gzipCeilingBytes: number;
  readonly recordedGzipBytes: number;
  readonly legacyGzipBytes?: number;
}

export interface SizeBudget {
  readonly budgets: readonly SizeBudgetEntry[];
}

export interface PerfBaseline {
  readonly throughput: readonly ThroughputRecord[];
  readonly legacyComparison: readonly LegacyRecord[];
}

/** Row order and headings. Shape ids are spelled as the measurement file spells them. */
const THROUGHPUT_ROWS: readonly (readonly [string, string])[] = [
  ["1 field, 1 check", "singleField"],
  ["3 fields, 6 plugins", "multiField"],
  ["nested, depth 2–3", "nested"],
  ["array of 50 elements", "array"],
  ["JSON Schema document", "jsonSchema"],
];

/**
 * Only the shapes that lose to the previous major are bold. Emphasis points
 * at the bad news a reader should know, never at a win. Which shapes lose is
 * decided from the measurement, so the emphasis moves on its own.
 */
const LEGACY_ROWS: readonly (readonly [string, string])[] = [
  ["1 field", "singleField"],
  ["3 fields", "multiField"],
  ["nested", "nested"],
  ["array of 50", "array"],
  ["JSON Schema", "jsonSchema"],
];

function formatOps(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function findThroughput(
  baseline: PerfBaseline,
  shape: string,
  operation: string
): ThroughputRecord {
  const found = baseline.throughput.find(
    (record) => record.shape === shape && record.operation === operation
  );
  if (found === undefined) {
    throw new Error(`config/perf-baseline.json has no ${shape}/${operation}`);
  }
  return found;
}

function findLegacy(baseline: PerfBaseline, shape: string): LegacyRecord {
  const found = baseline.legacyComparison.find(
    (record) => record.shape === shape
  );
  if (found === undefined) {
    throw new Error(`config/perf-baseline.json has no legacy ${shape}`);
  }
  return found;
}

export function renderThroughputTable(baseline: PerfBaseline): string {
  return THROUGHPUT_ROWS.map(([label, shape]) => {
    const validate = findThroughput(baseline, shape, "validate");
    const parse = findThroughput(baseline, shape, "parse");
    return `| ${label} | ${formatOps(validate.opsPerSecond)} | ${formatOps(parse.opsPerSecond)} |`;
  }).join("\n");
}

/**
 * A shape that could not be compared says "not comparable" rather than losing
 * its row. Dropping the row quietly shortens the table, which reads as "that
 * shape was never measured".
 */
export function renderLegacyTable(baseline: PerfBaseline): string {
  return LEGACY_ROWS.map(([label, shape]) => {
    const record = findLegacy(baseline, shape);
    if (record.legacyOpsPerSecond === null || record.speedup === null) {
      return `| ${label} | not comparable | ${formatOps(record.currentOpsPerSecond)} | — |`;
    }
    const ratio = `×${record.speedup.toFixed(2)}`;
    const cell = record.speedup < 1 ? `**${ratio}**` : ratio;
    return `| ${label} | ${formatOps(record.legacyOpsPerSecond)} | ${formatOps(record.currentOpsPerSecond)} | ${cell} |`;
  }).join("\n");
}

/**
 * The shape the previous major's README called "simple", measured again here.
 *
 * It appeared inside a sentence in the README and was the one figure left
 * outside generation. Generating the tables achieves nothing if a sentence
 * rots instead, so it is pulled in here. Kept in millions: it is a number in
 * prose, not a number in a table.
 */
export function renderLegacySimpleOps(baseline: PerfBaseline): string {
  const record = findLegacy(baseline, "multiField");
  if (record.legacyOpsPerSecond === null) return "no comparable figure";
  return `${(record.legacyOpsPerSecond / 1_000_000).toFixed(2)}M`;
}

/** The rows of the README's bundle table, and their headings. */
const SIZE_ROWS: readonly (readonly [string, string])[] = [
  ["`Builder` only, zero plugins", "core-only"],
  ['+ 6 plugins (1.x\'s "simple" set)', "six-plugin"],
  ["core + `jsonSchema`, the plugin alone", "jsonschema-plugin"],
  ["core + `jsonSchemaFullFeature`", "jsonschema-full-feature"],
  ["all 77 plugins", "full-feature"],
];

/**
 * The bundle table. Only rows the size budget **re-measures on every build**
 * appear here.
 *
 * The README used to carry these by hand, and they went stale: the core figure
 * stayed put through two increases. Same accident, once more.
 */
export function renderSizeTable(budget: SizeBudget): string {
  return SIZE_ROWS.map(([label, id]) => {
    const entry = budget.budgets.find((one) => one.id === id);
    if (entry === undefined) {
      throw new Error(`config/size-budget.json has no ${id}`);
    }
    const legacy =
      entry.legacyGzipBytes === undefined
        ? "—"
        : `${entry.legacyGzipBytes.toLocaleString("en-US")} B`;
    return `| ${label} | **${entry.recordedGzipBytes.toLocaleString("en-US")} B** | ${legacy} |`;
  }).join("\n");
}

/** The two numbers behind "the core is N% of the all-plugins build", from the same source as the table. */
export function renderCoreShare(budget: SizeBudget): string {
  const core = budget.budgets.find((one) => one.id === "core-only");
  const all = budget.budgets.find((one) => one.id === "full-feature");
  if (core === undefined || all === undefined) {
    throw new Error("core-only or full-feature is missing");
  }
  const share = (
    (core.recordedGzipBytes / all.recordedGzipBytes) *
    100
  ).toFixed(1);
  return `${share}% of the all-plugins build (${core.recordedGzipBytes.toLocaleString("en-US")} of ${all.recordedGzipBytes.toLocaleString("en-US")} B)`;
}

/** The figure behind "on these ten it is 2.9-8.6%", rounded as displayed. */
export function renderSpreadRange(baseline: PerfBaseline): string {
  const spreads = baseline.throughput.map(
    (record) => record.relativeSpreadPercent
  );
  const low = Math.min(...spreads);
  const high = Math.max(...spreads);
  return `${low.toFixed(1)}–${high.toFixed(1)}%`;
}
