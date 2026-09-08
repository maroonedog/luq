// ===========================================================================
// test/integration/json-schema-suite.test.ts — THE CONFORMANCE NUMBER.
//
// Three gates, and the number is what falls out of them:
//   1. THE PIN. config/json-schema-suite.json records the submodule commit, the
//      corpus counts and a sha256 over the corpus bytes. If the submodule
//      moves, the digest and the counts stop matching and the build fails until
//      the file is re-measured — which is what makes a suite bump a reviewed
//      commit rather than a silent change to the published rate.
//   2. EVERY NON-SKIPPED CASE PASSES. The typed skip list is the only permitted
//      exclusion, and the pass rate counts a skipped case as a FAILURE, so
//      adding a skip changes what the build reports and never the number.
//   3. NO STALE SKIP. Every skipped case is run anyway; a skipped case that
//      PASSES fails the build. That is what stops the list becoming a place to
//      hide a regression.
//
// The measured rate is asserted against config/json-schema-suite.json exactly,
// in BOTH directions: a regression fails, and so does an unrecorded
// improvement. The number is never rounded up to a target.
// ===========================================================================
import {
  SUITE_SKIPS,
  findSuiteSkip,
  type SuiteSkip,
} from "../json-schema/suite-skip-list";
import {
  isCorpusPresent,
  readSuiteCorpus,
  readSuitePin,
  type SuiteCorpus,
} from "../json-schema/read-suite-corpus";
import {
  runSuiteCase,
  tryBuildSuiteValidator,
} from "../json-schema/build-suite-validator";

interface CaseResult {
  readonly file: string;
  readonly group: string;
  readonly test: string;
  readonly passed: boolean;
  /** スイートがそのケースに期待する答え。有効/無効の内訳を数えるのに使う。 */
  readonly expected: boolean;
  readonly skip: SuiteSkip | undefined;
  readonly detail: string;
}

function runCorpus(corpus: SuiteCorpus): readonly CaseResult[] {
  const results: CaseResult[] = [];
  for (const file of corpus.files) {
    for (const group of file.groups) {
      const built = tryBuildSuiteValidator(group.schema);
      for (const one of group.tests) {
        const outcome = runSuiteCase(
          built.validator,
          built.buildError,
          one.data
        );
        const passed =
          outcome.kind === "verdict" && outcome.valid === one.valid;
        results.push({
          file: file.name,
          group: group.description,
          test: one.description,
          passed,
          expected: one.valid,
          skip: findSuiteSkip(file.name, group.description, one.description),
          detail:
            outcome.kind === "verdict"
              ? `answered ${outcome.valid}, expected ${one.valid}`
              : `${outcome.kind}: ${outcome.detail}`,
        });
      }
    }
  }
  return results;
}

/** A skipped case that now passes. Non-empty means the list is out of date. */
function findStaleSkips(results: readonly CaseResult[]): readonly string[] {
  return results
    .filter((result) => result.skip !== undefined && result.passed)
    .map(
      (result) =>
        `${result.file} | ${result.group} | ${result.test} ` +
        `(skipped as "${result.skip?.cause ?? ""}", expiresWith ` +
        `"${result.skip?.expiresWith ?? ""}") NOW PASSES — delete the entry`
    );
}

function render(results: readonly CaseResult[], limit: number): string {
  return results
    .slice(0, limit)
    .map((r) => `  ${r.file} | ${r.group} | ${r.test}: ${r.detail}`)
    .join("\n");
}

const pin = readSuitePin();
const present = isCorpusPresent(pin);

// The corpus is a submodule. A run without it must be LOUD, never a green
// suite that measured nothing — that is exactly how a fabricated number gets
// published — so the single failing test below is the whole file's answer.
const describeCorpus = present ? describe : describe.skip;

if (!present) {
  it("the JSON Schema conformance corpus is checked out", () => {
    throw new Error(
      `${pin.submodulePath}/${pin.corpusDirectory} is empty. Run ` +
        "`git submodule update --init --recursive`. No conformance number " +
        "can be reported without the corpus."
    );
  });
}

describeCorpus("JSON-Schema-Test-Suite draft7 conformance", () => {
  const corpus = readSuiteCorpus(pin);
  const results = runCorpus(corpus);
  const passing = results.filter((r) => r.passed);
  const failing = results.filter((r) => !r.passed);

  describe("the pin", () => {
    it("matches the recorded corpus digest", () => {
      expect(corpus.contentDigest).toBe(pin.contentDigest);
    });

    it("matches the recorded corpus shape", () => {
      expect({
        fileCount: corpus.files.length,
        groupCount: corpus.groupCount,
        caseCount: corpus.caseCount,
      }).toEqual({
        fileCount: pin.fileCount,
        groupCount: pin.groupCount,
        caseCount: pin.caseCount,
      });
    });

    it("records the same number of skip entries the list holds", () => {
      expect(SUITE_SKIPS.length).toBe(pin.skipEntryCount);
    });
  });

  describe("the skip list", () => {
    it("excludes exactly the recorded number of cases", () => {
      const skipped = results.filter((r) => r.skip !== undefined);
      expect(skipped.length).toBe(pin.skippedCases);
    });

    it("holds no stale entry: a skipped case that passes fails the build", () => {
      const stale = findStaleSkips(results);
      expect(stale.join("\n")).toBe("");
    });

    it("names no case the corpus does not contain", () => {
      const known = new Set(
        results.flatMap((r) => [
          `${r.file}||${r.group}`,
          `${r.file}||${r.group}||${r.test}`,
        ])
      );
      const unknown = SUITE_SKIPS.filter(
        (skip) =>
          !known.has(
            skip.test === undefined
              ? `${skip.file}||${skip.group}`
              : `${skip.file}||${skip.group}||${skip.test}`
          )
      ).map((skip) => `${skip.file} | ${skip.group} | ${skip.test ?? "*"}`);
      expect(unknown.join("\n")).toBe("");
    });

    it("gives every entry a cause, a reason and an expiry", () => {
      // `cause` and `expiresWith` are `never` while the list is empty, so
      // they are read through String(): the check has to keep compiling for
      // the day a skip comes back, and emptying the union must not quietly
      // delete the rule that makes a skip explain itself.
      const incomplete = SUITE_SKIPS.filter(
        (skip) =>
          skip.reason.trim().length === 0 ||
          String(skip.cause).length === 0 ||
          String(skip.expiresWith).length === 0
      );
      expect(incomplete).toEqual([]);
    });
  });

  describe("the corpus", () => {
    it("passes every case that is not skipped", () => {
      const unexpected = failing.filter((r) => r.skip === undefined);
      expect(render(unexpected, 40)).toBe("");
    });

    it("reports the recorded pass count, exactly", () => {
      expect(passing.length).toBe(pin.passingCases);
    });

    // 適合率は「何を渡しても true を返す検証器」の下限と比べて初めて意味を
    // 持つ。その比較表を docs と docs-site が載せているので、内訳もピンに
    // 記録して、片方だけ古くなることを防ぐ。
    it("reports the recorded valid/invalid breakdown, exactly", () => {
      expect({
        validCases: results.filter((r) => r.expected).length,
        invalidCases: results.filter((r) => !r.expected).length,
        passingValidCases: passing.filter((r) => r.expected).length,
        passingInvalidCases: passing.filter((r) => !r.expected).length,
      }).toEqual({
        validCases: pin.validCases,
        invalidCases: pin.invalidCases,
        passingValidCases: pin.passingValidCases,
        passingInvalidCases: pin.passingInvalidCases,
      });
    });

    it("counts every case as passing, skipped or failing exactly once", () => {
      expect(passing.length + failing.length).toBe(corpus.caseCount);
      expect(failing.every((r) => r.skip !== undefined)).toBe(true);
    });
  });
});
