// ===========================================================================
// test/json-schema/read-suite-corpus.ts — the JSON-Schema-Test-Suite corpus as
// data, plus the digest that PINS it.
//
// The corpus is a git submodule (docs/design/test-strategy.md). If it is not
// checked out there is nothing to measure, and a conformance number measured
// against an absent corpus would be a fabricated one — so readSuiteCorpus()
// throws rather than returning an empty list.
//
// Only tests/draft7/*.json is read. tests/draft7/optional/ is excluded on
// purpose: the suite marks those cases optional for a reason, and including
// them would inflate the denominator with cases no implementation is required
// to pass. That choice is recorded in config/json-schema-suite.json as
// includesOptionalDirectory:false, so the published rate says what it counted.
// ===========================================================================
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export interface SuiteCase {
  readonly description: string;
  readonly data: unknown;
  readonly valid: boolean;
}

export interface SuiteGroup {
  readonly description: string;
  readonly schema: unknown;
  readonly tests: readonly SuiteCase[];
}

export interface SuiteFile {
  readonly name: string;
  readonly groups: readonly SuiteGroup[];
}

export interface SuiteCorpus {
  readonly files: readonly SuiteFile[];
  readonly groupCount: number;
  readonly caseCount: number;
  /** sha256 over every file name and its bytes, in sorted order. */
  readonly contentDigest: string;
}

export const SUITE_CONFIG_PATH = "config/json-schema-suite.json";

export interface SuitePin {
  readonly repository: string;
  readonly submodulePath: string;
  readonly commit: string;
  readonly corpusDirectory: string;
  readonly fileCount: number;
  readonly groupCount: number;
  readonly caseCount: number;
  readonly contentDigest: string;
  readonly skipEntryCount: number;
  readonly skippedCases: number;
  readonly passingCases: number;
  readonly validCases: number;
  readonly invalidCases: number;
  readonly passingValidCases: number;
  readonly passingInvalidCases: number;
}

export function repositoryRoot(): string {
  return path.join(__dirname, "..", "..");
}

export function readSuitePin(): SuitePin {
  const text = fs.readFileSync(
    path.join(repositoryRoot(), SUITE_CONFIG_PATH),
    "utf8"
  );
  return JSON.parse(text) as SuitePin;
}

function corpusDirectory(pin: SuitePin): string {
  return path.join(repositoryRoot(), pin.submodulePath, pin.corpusDirectory);
}

export function isCorpusPresent(pin: SuitePin): boolean {
  const directory = corpusDirectory(pin);
  return fs.existsSync(directory) && fs.readdirSync(directory).length > 0;
}

/**
 * The submodule sits outside this repository's .gitattributes, so what gets
 * checked out is platform-dependent: CRLF on Windows, LF on a Linux runner.
 * Hashing the raw bytes therefore changes the digest for one commit, and the
 * pin check reports "the corpus moved" when nothing did. Line endings are
 * normalised before hashing so that only a change in content shows.
 */
function normalizeLineEndings(text: string): string {
  return text.split("\r\n").join("\n");
}

export function readSuiteCorpus(pin: SuitePin): SuiteCorpus {
  const directory = corpusDirectory(pin);
  if (!isCorpusPresent(pin)) {
    throw new Error(
      `The JSON-Schema-Test-Suite corpus is missing at ${directory}. It is a ` +
        `git submodule; run \`git submodule update --init --recursive\`. The ` +
        `conformance number is measured, so it cannot be reported without it.`
    );
  }
  const names = fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort();
  const digest = crypto.createHash("sha256");
  const files: SuiteFile[] = [];
  let groupCount = 0;
  let caseCount = 0;
  for (const name of names) {
    const text = normalizeLineEndings(
      fs.readFileSync(path.join(directory, name), "utf8")
    );
    digest.update(name);
    digest.update("\0");
    digest.update(text);
    digest.update("\0");
    const groups = JSON.parse(text) as SuiteGroup[];
    groupCount += groups.length;
    for (const group of groups) caseCount += group.tests.length;
    files.push({ name, groups });
  }
  return {
    files,
    groupCount,
    caseCount,
    contentDigest: `sha256:${digest.digest("hex")}`,
  };
}
