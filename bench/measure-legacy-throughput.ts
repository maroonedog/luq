// ===========================================================================
// bench/measure-legacy-throughput.ts
//
// The 1.x-versus-rewrite comparison, measured rather than argued.
//
// 1.x's own claims are on record and they contradict each other: the README
// said 1.2M ops/sec (simple) and 43K ops/sec (complex); the benchmarks page,
// generated from a results file on an AMD Ryzen 7 5825U with Node v22.12.0,
// said 694,692 and 35,946 (docs/legacy-spec/documented-promises.md:12, :274).
// Neither figure is this project's and neither was measured here, so both
// sides are measured on one machine with one primitive.
//
// This file is only the plumbing: it exports the 1.x sources out of git and
// runs bench/legacy/compare-implementations.ts in a child process under
// ts-node --transpile-only. Every failure to compare produces a record that
// SAYS SO — a missing legacy figure is never silently a zero and never
// silently the current implementation measured twice.
// ===========================================================================
import { execFileSync } from "child_process";
import { join } from "path";
import { measureThroughput } from "./measure-throughput";
import { BENCH_SHAPES } from "./shapes/index";
import { extractLegacySources } from "./legacy/extract-legacy-sources";
import { COMPARISON_MARKER } from "./legacy/comparison-marker";
import type { LegacyComparisonRecord } from "./perf-baseline.types";

const CHILD_SCRIPT = join(__dirname, "legacy", "compare-implementations.ts");
const CHILD_PROJECT = join(__dirname, "..", "scripts", "tsconfig.json");
const CHILD_TIMEOUT_MS = 15 * 60 * 1000;

function measureCurrentOnly(reason: string): readonly LegacyComparisonRecord[] {
  return BENCH_SHAPES.map((shape) => {
    const validator = shape.buildValidator();
    const current = measureThroughput(
      `${shape.name}:current`,
      () => validator.validate(shape.acceptedValue).valid
    );
    return {
      shape: shape.name,
      legacyOpsPerSecond: null,
      currentOpsPerSecond: current.opsPerSecond,
      speedup: null,
      note: `not comparable: ${reason}`,
    };
  });
}

function readMarkedJson(output: string): readonly LegacyComparisonRecord[] {
  const line = output
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(COMPARISON_MARKER));
  if (line === undefined) {
    throw new Error("the comparison child printed no result line");
  }
  const parsed: unknown = JSON.parse(line.slice(COMPARISON_MARKER.length));
  if (!Array.isArray(parsed)) {
    throw new Error("the comparison child printed a non-array result");
  }
  return parsed as readonly LegacyComparisonRecord[];
}

export function measureLegacyComparison(): readonly LegacyComparisonRecord[] {
  const sources = extractLegacySources();
  if (!sources.extracted) {
    return measureCurrentOnly(`sources-not-extractable (${sources.detail})`);
  }

  try {
    const tsNodeBin = require.resolve("ts-node/dist/bin.js");
    const output = execFileSync(
      process.execPath,
      [
        tsNodeBin,
        "--transpile-only",
        "--project",
        CHILD_PROJECT,
        CHILD_SCRIPT,
        sources.sourceRoot,
      ],
      {
        cwd: join(__dirname, ".."),
        encoding: "utf8",
        timeout: CHILD_TIMEOUT_MS,
        maxBuffer: 8 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    return readMarkedJson(output);
  } catch (failure) {
    const detail = failure instanceof Error ? failure.message : String(failure);
    return measureCurrentOnly(
      `the 1.x comparison child failed (ref ${sources.ref} @ ${sources.commit.slice(0, 8)}): ${detail}`
    );
  }
}
