// ===========================================================================
// test/unit/json-schema/convert/converter-invariants.test.ts
//
// The three claims about the converter that are only true if nobody ever
// writes the tempting line:
//   1. CSP-SAFE. `eval` and `new Function` are the reason fromJsonSchema exists
//      at all — AJV generates code at run time and cannot run under a Content
//      Security Policy. A single `new Function` anywhere in src would retire
//      the feature's whole justification.
//   2. ONE schema interpreter. 1.x shipped two engines that disagreed.
//   3. Every converter module under 200 lines (the repo's own rule, asserted
//      here because eslint's max-lines does not run on a merge of two branches
//      that each added ten lines).
// ===========================================================================
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SOURCE_ROOT = join(__dirname, "..", "..", "..", "..", "src");
const CONVERTER_ROOT = join(SOURCE_ROOT, "json-schema");

function listTypeScriptFiles(directory: string): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...listTypeScriptFiles(path));
      continue;
    }
    if (entry.name.endsWith(".ts")) found.push(path);
  }
  return found;
}

const sourceFiles = listTypeScriptFiles(SOURCE_ROOT);
const converterFiles = listTypeScriptFiles(CONVERTER_ROOT);

describe("CSP safety", () => {
  it("finds no dynamic code construction anywhere in src", () => {
    const offenders = sourceFiles.filter((path) => {
      const text = readFileSync(path, "utf8");
      return (
        /\bnew\s+Function\s*\(/.test(text) ||
        /(^|[^.\w])eval\s*\(/.test(text) ||
        /\bnew\s+GeneratorFunction\b/.test(text)
      );
    });
    expect(offenders).toEqual([]);
  });

  it("scans a non-empty set of files, so the check cannot pass vacuously", () => {
    expect(sourceFiles.length).toBeGreaterThan(100);
    expect(converterFiles.length).toBeGreaterThan(10);
  });
});

describe("one schema interpreter", () => {
  it("has no second recursive schema evaluator left in src", () => {
    // CODE only: the three names still appear in prose, in the headers that
    // record what was retired and why.
    const legacyEngine =
      /validateValueAgainstSchema|getDetailedValidationErrors|evaluateSchema/;
    const isComment = (line: string): boolean =>
      /^\s*(\/\/|\*|\/\*)/.test(line);
    const offenders = sourceFiles.filter((path) =>
      readFileSync(path, "utf8")
        .split("\n")
        .some((line) => !isComment(line) && legacyEngine.test(line))
    );
    expect(offenders).toEqual([]);
  });

  it("still finds the retired names in prose, so the filter is not vacuous", () => {
    const mentions = sourceFiles.filter((path) =>
      /evaluateSchema/.test(readFileSync(path, "utf8"))
    );
    expect(mentions.length).toBeGreaterThan(0);
  });

  it("keeps format grammars out of the converter", () => {
    // format-map.ts points at the plugins and holds no regex of its own; the
    // ONE RegExp the converter builds is the `pattern` keyword's, in
    // keyword-map-string.ts, from the document's own source string.
    const constructions = converterFiles.filter((path) =>
      /new RegExp\(/.test(readFileSync(path, "utf8"))
    );
    expect(constructions.map((path) => path.split(/[\\/]/).pop())).toEqual([
      "keyword-map-string.ts",
    ]);
  });
});

describe("module size", () => {
  it.each(converterFiles.map((path) => [path.split(/[\\/]/).pop(), path]))(
    "%s is under 200 lines",
    (_name, path) => {
      expect(readFileSync(path, "utf8").split("\n").length).toBeLessThanOrEqual(
        200
      );
    }
  );
});
