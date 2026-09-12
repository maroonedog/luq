// ===========================================================================
// bench/competitors/report-check-outcome.ts
//
// Tells the workflow WHY the check failed, not just that it did.
//
// The two failures this check can raise want opposite handling, and an exit
// code cannot tell them apart:
//
//   stale versions   The record describes a library nobody runs any more. The
//                    fix is to re-measure, which is exactly what the runner is
//                    standing there able to do. CI should propose it.
//
//   agreement moved  A competitor now answers differently from Luq on a value
//                    they used to agree on. Re-recording that would write the
//                    new behaviour into the baseline as though it were
//                    expected, which is how a behavioural change becomes
//                    invisible. A person has to look first.
//
// Without this distinction the arrangement deadlocked: the version gate failed
// the step, a failed step skips the ones after it, and the step after it was
// the one that opens the re-record pull request. So the gate stayed red
// waiting for a re-record that could never run. That was a real bug, shipped
// and observed on master — run 34688400093, where "Open a pull request when
// the record has moved" is marked `skipped` under a failed check.
// ===========================================================================
import * as fs from "fs";

export interface CheckOutcome {
  /** A competitor's verdicts moved. Nothing may be re-recorded automatically. */
  readonly agreementFailed: boolean;
  /** A recorded figure names a version that is not installed. */
  readonly versionsStale: boolean;
}

/**
 * Appends the outcome to GitHub's step-output file when running under Actions.
 *
 * **A no-op everywhere else.** Locally there is no GITHUB_OUTPUT and nothing
 * should be written; the function is still called so the local and CI paths do
 * not diverge into two arrangements only one of which is exercised.
 */
export function reportCheckOutcome(outcome: CheckOutcome): void {
  const target = process.env["GITHUB_OUTPUT"];
  if (target === undefined || target === "") return;

  fs.appendFileSync(
    target,
    `agreement-failed=${String(outcome.agreementFailed)}\n` +
      `versions-stale=${String(outcome.versionsStale)}\n`,
    "utf8"
  );
}
