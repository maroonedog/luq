// ===========================================================================
// test/json-schema/report-skip-causes.ts
//
// The output used to count the conformance tables and the recorded figures.
// Not a test: it is run when the record is being updated.
//
//   npx ts-node --project scripts/tsconfig.json test/json-schema/report-skip-causes.ts
//
// Counted by hand, the failure and cause tables stayed at their old totals
// while several causes had been resolved outright and the tables said nothing
// about it. Counting is a machine's job.
// ===========================================================================
import { runSuiteCase, tryBuildSuiteValidator } from "./build-suite-validator";
import { readSuiteCorpus, readSuitePin } from "./read-suite-corpus";
import { SUITE_SKIPS, findSuiteSkip } from "./suite-skip-list";

interface Tally {
  caseCount: number;
  validCases: number;
  passingValidCases: number;
  passingInvalidCases: number;
  failingCases: number;
}

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function run(): void {
  const corpus = readSuiteCorpus(readSuitePin());
  const perCause = new Map<string, number>();
  const perFailureMode = new Map<string, number>();
  const tally: Tally = {
    caseCount: 0,
    validCases: 0,
    passingValidCases: 0,
    passingInvalidCases: 0,
    failingCases: 0,
  };

  for (const file of corpus.files) {
    for (const group of file.groups) {
      const built = tryBuildSuiteValidator(group.schema);
      for (const one of group.tests) {
        const outcome = runSuiteCase(
          built.validator,
          built.buildError,
          one.data
        );
        tally.caseCount += 1;
        if (one.valid) tally.validCases += 1;
        if (outcome.kind === "verdict" && outcome.valid === one.valid) {
          if (one.valid) tally.passingValidCases += 1;
          else tally.passingInvalidCases += 1;
          continue;
        }
        tally.failingCases += 1;
        increment(
          perFailureMode,
          outcome.kind === "verdict" ? "wrong verdict" : outcome.kind
        );
        const skip = findSuiteSkip(
          file.name,
          group.description,
          one.description
        );
        increment(perCause, skip?.cause ?? "UNRECORDED");
      }
    }
  }

  const entriesPerCause = new Map<string, number>();
  for (const skip of SUITE_SKIPS) increment(entriesPerCause, skip.cause);

  console.log("failure mode\tcases");
  for (const [mode, count] of [...perFailureMode].sort((a, b) => b[1] - a[1])) {
    console.log(mode + "\t" + String(count));
  }

  console.log("\ncause\tcases\tskip entries");
  for (const [cause, count] of [...perCause].sort((a, b) => b[1] - a[1])) {
    console.log(
      cause +
        "\t" +
        String(count) +
        "\t" +
        String(entriesPerCause.get(cause) ?? 0)
    );
  }
  console.log(
    "TOTAL\t" + String(tally.failingCases) + "\t" + String(SUITE_SKIPS.length)
  );

  // The lines to copy into the recorded figures, so nothing is added up by hand.
  const pin = {
    caseCount: tally.caseCount,
    passingCases: tally.passingValidCases + tally.passingInvalidCases,
    skippedCases: tally.failingCases,
    skipEntryCount: SUITE_SKIPS.length,
    validCases: tally.validCases,
    invalidCases: tally.caseCount - tally.validCases,
    passingValidCases: tally.passingValidCases,
    passingInvalidCases: tally.passingInvalidCases,
  };
  console.log("\nconfig/json-schema-suite.json:");
  console.log(JSON.stringify(pin, null, 2));
}

run();
