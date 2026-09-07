// ===========================================================================
// bench/read-perf-baseline.ts
//
// The only reader of config/perf-baseline.json. Two consumers depend on it and
// they want opposite things, which is why the parse is strict:
//   - the CI gate needs `referenceRatio[].ratioFloor` and must refuse to run
//     rather than pass vacuously when the file is missing or truncated. A gate
//     that silently becomes a no-op is worse than no gate.
//   - prose (README, docs) must quote figures from here instead of retyping
//     them, which is the mistake 1.x made and published for a year.
// ===========================================================================
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { PerfBaseline, ReferenceRatioRecord } from "./perf-baseline.types";
import type { BenchShapeName } from "./shapes/bench-shape.types";

export const PERF_BASELINE_PATH = join(
  __dirname,
  "..",
  "config",
  "perf-baseline.json"
);

const SHAPE_NAMES: readonly BenchShapeName[] = [
  "singleField",
  "multiField",
  "nested",
  "array",
  "jsonSchema",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReferenceRatio(value: unknown): value is ReferenceRatioRecord {
  if (!isRecord(value)) return false;
  const shape = value["shape"];
  return (
    typeof shape === "string" &&
    SHAPE_NAMES.includes(shape as BenchShapeName) &&
    typeof value["luqOpsPerSecond"] === "number" &&
    typeof value["referenceOpsPerSecond"] === "number" &&
    typeof value["ratio"] === "number" &&
    typeof value["ratioFloor"] === "number" &&
    Number.isFinite(value["ratioFloor"]) &&
    value["ratioFloor"] > 0 &&
    typeof value["luqSpreadPercent"] === "number" &&
    typeof value["referenceSpreadPercent"] === "number" &&
    typeof value["ratioSpreadPercent"] === "number" &&
    typeof value["isQuiet"] === "boolean"
  );
}

function isPerfBaseline(value: unknown): value is PerfBaseline {
  if (!isRecord(value)) return false;
  if (typeof value["recordedAt"] !== "string") return false;
  if (!isRecord(value["machine"])) return false;
  if (!isRecord(value["conditions"])) return false;
  const ratios = value["referenceRatio"];
  if (!Array.isArray(ratios) || ratios.length === 0) return false;
  return ratios.every(isReferenceRatio);
}

export class PerfBaselineUnreadableError extends Error {
  constructor(reason: string) {
    super(
      `config/perf-baseline.json ${reason}. Record it with \`run-bench --record\` before gating on it; a gate with no floors passes everything.`
    );
    this.name = "PerfBaselineUnreadableError";
  }
}

/** Throws rather than returning a default: see the class comment above. */
export function readPerfBaseline(
  path: string = PERF_BASELINE_PATH
): PerfBaseline {
  if (!existsSync(path)) throw new PerfBaselineUnreadableError("is missing");
  // A BOM is stripped rather than tolerated by accident: a Windows editor or
  // `Set-Content -Encoding utf8` writes one, and JSON.parse then rejects a
  // file that is otherwise a perfectly good baseline.
  const raw = readFileSync(path, "utf8").replace(/^﻿/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (failure) {
    throw new PerfBaselineUnreadableError(
      `is not valid JSON (${failure instanceof Error ? failure.message : String(failure)})`
    );
  }
  if (!isPerfBaseline(parsed)) {
    throw new PerfBaselineUnreadableError(
      "is not a complete baseline (recordedAt, machine, conditions and a non-empty referenceRatio with positive floors are all required)"
    );
  }
  return parsed;
}

/** The recorded floor for one shape, or undefined when it has none yet. */
export function findRecordedFloor(
  baseline: PerfBaseline,
  shape: BenchShapeName
): number | undefined {
  return baseline.referenceRatio.find((entry) => entry.shape === shape)
    ?.ratioFloor;
}
