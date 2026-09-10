// ===========================================================================
// scripts/doc-examples/read-astro-examples.ts
//
// Pulls the code examples out of the site's .astro pages and returns them as
// exactly the same DocExample a Markdown example produces, so everything after
// this — type-checking through the exports map, matching must-fail — runs on
// one shared path.
//
// It is needed because the site used to sit outside the documentation checks.
// The previous major's site advertised methods that no longer existed, in
// dozens of places, and every build stayed green. Nobody failed to read it;
// there was nothing that read it.
//
// Only constants declared in the frontmatter AND handed to a code block as
// typescript are taken. Shell and JSON examples, and constants nothing
// displays, are dropped. How expectations are written is in
// read-astro-directives.ts.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { toRepositoryRelativePosix } from "../catalog/collect-typescript-files";
import type { DocExample, DocExampleViolation } from "./doc-example.types";
import { findCodeBlockLanguages } from "./find-code-block-languages";
import {
  findTemplateLiteralConstants,
  type TemplateLiteralConstant,
} from "./find-template-literal-constants";
import { readAstroExampleDirectives } from "./read-astro-directives";
import type { DocExampleScan } from "./read-doc-examples";

const CHECKED_LANGUAGES = new Set(["ts", "tsx", "typescript"]);

/** Collects the .astro files to scan. Accepts a file or a directory. */
export function collectAstroFiles(absolutePath: string): string[] {
  if (!fs.existsSync(absolutePath)) return [];
  if (!fs.statSync(absolutePath).isDirectory()) {
    return absolutePath.endsWith(".astro") ? [absolutePath] : [];
  }
  return fs
    .readdirSync(absolutePath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => collectAstroFiles(path.join(absolutePath, entry.name)));
}

function countLines(text: string): number {
  return text.length === 0 ? 0 : text.split("\n").length;
}

/**
 * Concatenates the code of the constants `with` names, in the order named,
 * putting a constant's own `with` ahead of it. Never twice: a duplicated
 * prelude fails to compile on the redeclaration.
 */
function buildPrelude(
  lines: readonly string[],
  byName: ReadonlyMap<string, TemplateLiteralConstant>,
  names: readonly string[],
  placed: Set<string>
): string {
  const parts: string[] = [];
  for (const name of names) {
    const constant = byName.get(name);
    if (constant === undefined || placed.has(name)) continue;
    placed.add(name);
    const directives = readAstroExampleDirectives(lines, constant.startLine);
    const nested = buildPrelude(lines, byName, directives.preludeNames, placed);
    parts.push(
      nested.length === 0 ? constant.code : `${nested}\n${constant.code}`
    );
  }
  return parts.join("\n");
}

/** Extracts the code examples from one .astro file. */
export function readAstroExamples(
  repositoryRoot: string,
  absoluteFile: string
): DocExampleScan {
  const file = toRepositoryRelativePosix(repositoryRoot, absoluteFile);
  const text = fs.readFileSync(absoluteFile, "utf8");
  const lines = text.split(/\r?\n/);
  const languageByName = findCodeBlockLanguages(text);
  const constants = findTemplateLiteralConstants(text);
  const byName = new Map(constants.map((one) => [one.name, one]));
  const examples: DocExample[] = [];
  const violations: DocExampleViolation[] = [];

  for (const constant of constants) {
    const language = languageByName.get(constant.name);
    if (language === undefined || !CHECKED_LANGUAGES.has(language)) continue;
    const directives = readAstroExampleDirectives(lines, constant.startLine);
    if (directives.problems.length > 0) {
      for (const problem of directives.problems) {
        violations.push({
          file,
          startLine: problem.line,
          kind: problem.kind,
          detail: problem.detail,
        });
      }
      continue;
    }
    const missing = directives.preludeNames.filter((name) => !byName.has(name));
    if (missing.length > 0) {
      violations.push({
        file,
        startLine: constant.startLine,
        kind: "unknownDirective",
        detail: `luq-example: with names a constant this file does not have: ${missing.join(", ")}`,
      });
      continue;
    }
    const prelude = buildPrelude(
      lines,
      byName,
      directives.preludeNames,
      new Set([constant.name])
    );
    examples.push({
      file,
      startLine: constant.startLine,
      language,
      // An example with interpolation only settles at build time, so it
      // cannot be checked statically. Counted as skipped and reported, never
      // dropped in silence.
      expectation: constant.hasInterpolation ? "skip" : directives.expectation,
      reason: directives.reason,
      code:
        prelude.length === 0 ? constant.code : `${prelude}\n${constant.code}`,
      preludeLineCount: prelude.length === 0 ? 0 : countLines(prelude) + 1,
    });
  }

  return { examples, violations };
}

/** Reads the whole scan root at once. */
export function readAllAstroExamples(
  repositoryRoot: string,
  astroRoots: readonly string[]
): DocExampleScan {
  const scans = astroRoots
    .flatMap((astroRoot) =>
      collectAstroFiles(path.join(repositoryRoot, astroRoot))
    )
    .map((absoluteFile) => readAstroExamples(repositoryRoot, absoluteFile));
  return {
    examples: scans.flatMap((scan) => scan.examples),
    violations: scans.flatMap((scan) => scan.violations),
  };
}
