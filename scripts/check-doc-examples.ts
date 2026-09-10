// ===========================================================================
// scripts/check-doc-examples.ts
//
// Type-checks the code examples in the documentation against the built
// package, for real.
//
// It exists because of a real incident. The previous major's Quick Start was
// broken in three places at once: it called build() as a function, read a
// property the result does not have, and imported a subpath the exports map
// does not publish. All three were the kind of mistake anyone would catch by
// reading, and nobody read them. Short of having the compiler read them, there
// is no way to stop that happening again.
//
// The judgement runs both ways:
//   - by default, an example must compile
//   - an example marked `<!-- luq-example: must-fail reason -->` must NOT.
//     The migration guide's "how it used to be written" is exactly that, and
//     an example that compiles means the description of the breaking change
//     is untrue, which fails CI just as loudly.
// ===========================================================================
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import { findDocImportViolations } from "./check-doc-imports";
import type {
  DocExample,
  DocExampleViolation,
} from "./doc-examples/doc-example.types";
import { findBrokenLinks } from "./doc-examples/find-broken-links";
import { readAllAstroExamples } from "./doc-examples/read-astro-examples";
import { readAllDocExamples } from "./doc-examples/read-doc-examples";
import {
  typecheckDocExamples,
  type ExampleDiagnostic,
} from "./doc-examples/typecheck-doc-examples";

/** What gets type-checked. The legacy spec is a record of the old major, so it is out. */
export const CHECKED_DOC_ROOTS: readonly string[] = [
  "README.md",
  "docs/guide",
  "docs/migration",
];

/**
 * The site's examples go through the same check. They live as template
 * literals in .astro frontmatter, so only the reading differs from Markdown.
 * While the site was outside this check, it advertised a method from the
 * previous major and every build stayed green.
 */
export const CHECKED_ASTRO_ROOTS: readonly string[] = ["docs-site/src"];

function groupByExample(
  diagnostics: readonly ExampleDiagnostic[]
): ReadonlyMap<number, readonly ExampleDiagnostic[]> {
  const grouped = new Map<number, ExampleDiagnostic[]>();
  for (const diagnostic of diagnostics) {
    const bucket = grouped.get(diagnostic.exampleIndex) ?? [];
    bucket.push(diagnostic);
    grouped.set(diagnostic.exampleIndex, bucket);
  }
  return grouped;
}

function describeDiagnostics(
  example: DocExample,
  diagnostics: readonly ExampleDiagnostic[]
): string {
  const preludeLineCount = example.preludeLineCount ?? 0;
  return diagnostics
    .map(
      (diagnostic) =>
        `${example.file}:${String(
          example.startLine + diagnostic.line - preludeLineCount
        )}: ` + diagnostic.message
    )
    .join("\n      ");
}

/** Compares the expectation with the compiler's answer. Either direction is a violation. */
export function findExpectationViolations(
  examples: readonly DocExample[],
  diagnostics: readonly ExampleDiagnostic[]
): readonly DocExampleViolation[] {
  const grouped = groupByExample(diagnostics);
  return examples.flatMap((example, index): readonly DocExampleViolation[] => {
    const found = grouped.get(index) ?? [];
    if (example.expectation === "compiles" && found.length > 0) {
      return [
        {
          file: example.file,
          startLine: example.startLine,
          kind: "didNotCompile" as const,
          detail: describeDiagnostics(example, found),
        },
      ];
    }
    if (example.expectation === "must-fail" && found.length === 0) {
      return [
        {
          file: example.file,
          startLine: example.startLine,
          kind: "compiledButMustFail" as const,
          detail: `declared must-fail but compiled: ${example.reason}`,
        },
      ];
    }
    return [];
  });
}

export interface DocExampleReport {
  readonly checkedCount: number;
  readonly mustFailCount: number;
  readonly skippedCount: number;
  readonly violations: readonly DocExampleViolation[];
  readonly unmappedOutput: string;
}

/** Scan, check imports, type-check, compare. Both the CLI and the tests go through here. */
export function checkDocExamples(
  repositoryRoot: string,
  docRoots: readonly string[] = CHECKED_DOC_ROOTS,
  astroRoots: readonly string[] = CHECKED_ASTRO_ROOTS
): DocExampleReport {
  const markdown = readAllDocExamples(repositoryRoot, docRoots);
  const astro = readAllAstroExamples(repositoryRoot, astroRoots);
  const scan = {
    examples: [...markdown.examples, ...astro.examples],
    violations: [...markdown.violations, ...astro.violations],
  };
  const importViolations: readonly DocExampleViolation[] =
    findDocImportViolations(repositoryRoot, docRoots).map((violation) => ({
      file: violation.file,
      startLine: violation.startLine,
      kind: "unpublishedImport" as const,
      detail: `subpath not in package.json#exports: "${violation.specifier}"`,
    }));
  const compiled = scan.examples.filter(
    (example) => example.expectation !== "skip"
  );
  const outcome = typecheckDocExamples(repositoryRoot, compiled);
  return {
    checkedCount: compiled.filter((one) => one.expectation === "compiles")
      .length,
    mustFailCount: compiled.filter((one) => one.expectation === "must-fail")
      .length,
    skippedCount: scan.examples.length - compiled.length,
    violations: [
      ...scan.violations,
      ...importViolations,
      ...findBrokenLinks(repositoryRoot, docRoots),
      ...findExpectationViolations(compiled, outcome.diagnostics),
    ],
    unmappedOutput: outcome.unmappedOutput,
  };
}

function reportAndExit(report: DocExampleReport): number {
  console.error(
    `Doc examples type-checked: ${String(report.checkedCount)} examples, ` +
      `${String(report.mustFailCount)} required to fail, ` +
      `${String(report.skippedCount)} skipped`
  );
  if (report.unmappedOutput.length > 0) {
    console.error(`Unrecognised compiler output:\n${report.unmappedOutput}`);
    return 1;
  }
  if (report.violations.length === 0) {
    console.error("No violations");
    return 0;
  }
  console.error(`${String(report.violations.length)} violations:`);
  for (const violation of report.violations) {
    console.error(
      `  ${violation.file}:${String(violation.startLine)} [${violation.kind}]\n` +
        `      ${violation.detail}`
    );
  }
  return 1;
}

if (require.main === module) {
  runCheckAndExit(() => reportAndExit(checkDocExamples(REPOSITORY_ROOT)));
}
