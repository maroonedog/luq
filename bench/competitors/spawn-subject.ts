// ===========================================================================
// bench/competitors/spawn-subject.ts
//
// Starts one child per subject and reads its single line of JSON back.
//
// `TS_NODE_TRANSPILE_ONLY` is set deliberately: sixty children each
// type-checking bench/ and src/ would spend the run in tsc rather than
// measuring, and `npm run typecheck:bench` already checks the types once.
//
// A child that fails is never softened into a zero. A subject silently
// recorded as "0 ops/sec" would produce a ratio, and the ratio would look like
// a measurement.
// ===========================================================================
import { spawnSync } from "child_process";
import * as path from "path";
import { formatSubjectArguments } from "./subject-arguments";
import { isSubjectReport } from "./subject-report.types";
import type { SubjectReport, SubjectRequest } from "./subject-report.types";

const CHILD = path.join(__dirname, "run-subject.ts");
const BENCH_TSCONFIG = path.join(__dirname, "..", "tsconfig.json");

export class SubjectChildError extends Error {}

function describe(request: SubjectRequest): string {
  return `${request.shape}/${request.subject} (${request.pool})`;
}

/** The last non-empty line, so a warning printed ahead of the report survives. */
function lastLineOf(output: string): string {
  const lines = output.split("\n").filter((line) => line.trim().length > 0);
  return lines[lines.length - 1] ?? "";
}

export function spawnSubject(request: SubjectRequest): SubjectReport {
  const finished = spawnSync(
    process.execPath,
    ["-r", "ts-node/register", CHILD, ...formatSubjectArguments(request)],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        TS_NODE_PROJECT: BENCH_TSCONFIG,
        TS_NODE_TRANSPILE_ONLY: "true",
      },
    }
  );
  if (finished.error !== undefined) {
    throw new SubjectChildError(
      `${describe(request)}: ${finished.error.message}`
    );
  }
  if (finished.status !== 0) {
    throw new SubjectChildError(
      `${describe(request)}: child exited ${String(finished.status)}\n${finished.stderr}`
    );
  }
  const line = lastLineOf(finished.stdout);
  const parsed: unknown = line === "" ? undefined : JSON.parse(line);
  if (!isSubjectReport(parsed)) {
    throw new SubjectChildError(
      `${describe(request)}: the child printed no subject report`
    );
  }
  if (!parsed.verdictsHeld) {
    throw new SubjectChildError(
      `${describe(request)}: a timed call stopped answering as the agreement ` +
        "pass said it would, so the rate describes two different programs"
    );
  }
  return parsed;
}
