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
import type { RatioCase } from "./ratio-case";
import type { BenchShapeName } from "./shapes/bench-shape.types";

export const PERF_BASELINE_PATH = join(
  __dirname,
  "..",
  "config",
  "perf-baseline.json"
);

/**
 * CI ランナー用の床。
 *
 * このハーネスは当初「luq と手書き参照を同一プロセスで測るので、ランナーの
 * 速度は比率で相殺される」という前提で書かれていた。**その前提は PR #14 の
 * 最初の CI 実行で反証された。** ubuntu-latest (2コア) では array 形状の luq が
 * 手元の 16コア機に対して 3.8倍遅くなったのに、参照は 1.3倍しか遅くならず、
 * 比率が 0.0304 から 0.0099 に落ちた。
 *
 * 理由は明らかで、両者の性能プロファイルが違う。luq は issue オブジェクトや
 * インデックススタックを確保しながら歩くが、参照は割り当てゼロの密ループ。
 * コア数・メモリ帯域・GC の効き方が変われば、両者は同じようには落ちない。
 * 比率が相殺するのは CPU クロックだけで、割り当ての差は相殺しない。
 *
 * したがって床は**ゲートが走る環境で測った値**でなければならない。
 * CI では config/perf-baseline.ci.json を、手元では config/perf-baseline.json を
 * 読む。どちらも同じ形式で、同じ 0.75 倍の規則で床を導く。
 */
export const CI_PERF_BASELINE_PATH = join(
  __dirname,
  "..",
  "config",
  "perf-baseline.ci.json"
);

/** ゲートが読むべき床のファイル。CI かどうかで切り替える。 */
export function baselinePathForEnvironment(
  isContinuousIntegration: boolean = process.env.CI === "true"
): string {
  return isContinuousIntegration ? CI_PERF_BASELINE_PATH : PERF_BASELINE_PATH;
}

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

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isReferenceRatio(value: unknown): value is ReferenceRatioRecord {
  if (!isRecord(value)) return false;
  const shape = value["shape"];
  const operation = value["operation"];
  return (
    typeof shape === "string" &&
    SHAPE_NAMES.includes(shape as BenchShapeName) &&
    (operation === "validate" || operation === "parse") &&
    typeof value["inputIsAccepted"] === "boolean" &&
    typeof value["luqOpsPerSecond"] === "number" &&
    typeof value["referenceOpsPerSecond"] === "number" &&
    typeof value["ratio"] === "number" &&
    typeof value["ratioFloor"] === "number" &&
    Number.isFinite(value["ratioFloor"]) &&
    value["ratioFloor"] > 0 &&
    // spread は null を許す = 「測っていない」。CI の床はログから起こしたもので
    // spread が無い。0 を書くと「ばらつきが無かった」という嘘になる。
    isNumberOrNull(value["luqSpreadPercent"]) &&
    isNumberOrNull(value["referenceSpreadPercent"]) &&
    isNumberOrNull(value["ratioSpreadPercent"]) &&
    (typeof value["isQuiet"] === "boolean" || value["isQuiet"] === null)
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
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
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

/**
 * The recorded floor for one (shape, case) pairing, or undefined when it has
 * none yet. Keyed by the case as well as the shape because the gate now covers
 * parse and the rejection path: a floor recorded for validate/accepted must
 * never be applied to a pairing that measures something else.
 */
export function findRecordedFloor(
  baseline: PerfBaseline,
  shape: BenchShapeName,
  ratioCase: RatioCase
): number | undefined {
  return baseline.referenceRatio.find(
    (entry) =>
      entry.shape === shape &&
      entry.operation === ratioCase.operation &&
      entry.inputIsAccepted === ratioCase.inputIsAccepted
  )?.ratioFloor;
}
