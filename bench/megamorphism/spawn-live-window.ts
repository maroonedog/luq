// ===========================================================================
// bench/megamorphism/spawn-live-window.ts
//
// Starts one child per window and reads its single line of JSON back.
//
// `TS_NODE_TRANSPILE_ONLY` is set deliberately. Sixty child processes each
// type-checking bench/ and src/ would spend most of the run in tsc and none of
// it measuring, and the types are already checked once by
// `npm run typecheck:bench`. What the child runs is the same transpiled
// CommonJS the rest of bench/ measures.
//
// A child that fails is never softened into a zero. A missing or unparseable
// report throws with the window named, because a window silently recorded as
// "0 ops/sec" would drag a median down and look like a measurement.
// ===========================================================================
import { spawnSync } from "child_process";
import * as path from "path";
import { formatWindowArguments } from "./window-arguments";
import { isWindowReport } from "./window-report.types";
import type { WindowReport, WindowRequest } from "./window-report.types";

const CHILD = path.join(__dirname, "run-live-window.ts");
const BENCH_TSCONFIG = path.join(__dirname, "..", "tsconfig.json");

export class LiveWindowChildError extends Error {}

function describe(request: WindowRequest): string {
  return (
    `validators=${request.validatorCount} pool=${request.poolSize} ` +
    `offset=${request.offset}`
  );
}

/** The last non-empty line, so a stray warning ahead of the report is survivable. */
function lastLineOf(output: string): string {
  const lines = output.split("\n").filter((line) => line.trim().length > 0);
  return lines[lines.length - 1] ?? "";
}

function parseReport(request: WindowRequest, stdout: string): WindowReport {
  const line = lastLineOf(stdout);
  const parsed: unknown = line === "" ? undefined : JSON.parse(line);
  if (!isWindowReport(parsed)) {
    throw new LiveWindowChildError(
      `${describe(request)}: the child printed no window report`
    );
  }
  return parsed;
}

export function spawnLiveWindow(request: WindowRequest): WindowReport {
  const finished = spawnSync(
    process.execPath,
    ["-r", "ts-node/register", CHILD, ...formatWindowArguments(request)],
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
    throw new LiveWindowChildError(
      `${describe(request)}: ${finished.error.message}`
    );
  }
  if (finished.status !== 0) {
    throw new LiveWindowChildError(
      `${describe(request)}: child exited ${String(finished.status)}\n${finished.stderr}`
    );
  }
  return parseReport(request, finished.stdout);
}
