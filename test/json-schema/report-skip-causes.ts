// ===========================================================================
// test/json-schema/report-skip-causes.ts
//
// docs/json-schema-conformance.md の「失敗のしかた」と「原因別」を数えるための
// 出力口。テストではなく、ドキュメントを書くときに実行するもの。
//
//   npx ts-node --project scripts/tsconfig.json test/json-schema/report-skip-causes.ts
//
// 手で数えていた頃、この2つの表は 101件 / 53エントリのまま残り、実際の 74件 /
// 44エントリとずれていた。原因が4つ丸ごと解消したのに表がそれを言わない、
// という状態である。数えるのは機械の仕事にする。
// ===========================================================================
import { runSuiteCase, tryBuildSuiteValidator } from "./build-suite-validator";
import { readSuiteCorpus, readSuitePin } from "./read-suite-corpus";
import { SUITE_SKIPS, findSuiteSkip } from "./suite-skip-list";

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function run(): void {
  const pin = readSuitePin();
  const corpus = readSuiteCorpus(pin);
  const perCause = new Map<string, number>();
  const perFailureMode = new Map<string, number>();
  let skipped = 0;

  for (const file of corpus.files) {
    for (const group of file.groups) {
      const built = tryBuildSuiteValidator(group.schema);
      for (const one of group.tests) {
        const outcome = runSuiteCase(built.validator, built.buildError, one.data);
        if (outcome.kind === "verdict" && outcome.valid === one.valid) continue;
        skipped += 1;
        increment(
          perFailureMode,
          outcome.kind === "verdict" ? "wrong verdict" : outcome.kind
        );
        const skip = findSuiteSkip(file.name, group.description, one.description);
        increment(perCause, skip?.cause ?? "UNRECORDED");
      }
    }
  }

  const entriesPerCause = new Map<string, number>();
  for (const skip of SUITE_SKIPS) increment(entriesPerCause, skip.cause);

  console.log("failure mode\tcases");
  for (const [mode, count] of [...perFailureMode].sort((a, b) => b[1] - a[1])) {
    console.log(`${mode}\t${count}`);
  }
  console.log("\ncause\tcases\tskip entries");
  for (const [cause, count] of [...perCause].sort((a, b) => b[1] - a[1])) {
    console.log(`${cause}\t${count}\t${entriesPerCause.get(cause) ?? 0}`);
  }
  console.log(`TOTAL\t${skipped}\t${SUITE_SKIPS.length}`);
}

run();
