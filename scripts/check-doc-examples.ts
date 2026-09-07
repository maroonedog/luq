// ===========================================================================
// scripts/check-doc-examples.ts
//
// ドキュメントのコード例を、ビルド済みパッケージに対して実際に型検査する。
//
// これが存在する理由は具体的な事故である。1.x の README の Quick Start は
// 3箇所同時に壊れていた ─ build() を関数として呼び、Result に無い
// `result.issues` を読み、exports に無い "@maroonedog/luq/plugins" を import
// していた。3つとも「読めば分かる」種類の誤りで、誰も読まなかった。
// コンパイラに読ませる以外に、これを二度と起こさない方法は無い。
//
// 判定は両方向である:
//   - 既定 (ディレクティブ無し) の例はコンパイルできなければならない
//   - `<!-- luq-example: must-fail 理由 -->` を付けた例はコンパイルできては
//     ならない。移行ガイドの「1.x の書き方」がこれで、通ってしまったら
//     破壊的変更の説明が事実と違うということなので、同じように CI を落とす。
// ===========================================================================
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import { findDocImportViolations } from "./check-doc-imports";
import type {
  DocExample,
  DocExampleViolation,
} from "./doc-examples/doc-example.types";
import { findBrokenLinks } from "./doc-examples/find-broken-links";
import { readAllDocExamples } from "./doc-examples/read-doc-examples";
import {
  typecheckDocExamples,
  type ExampleDiagnostic,
} from "./doc-examples/typecheck-doc-examples";

/** 型検査の対象。legacy-spec は 1.x の記録なので入れない。 */
export const CHECKED_DOC_ROOTS: readonly string[] = [
  "README.md",
  "docs/guide",
  "docs/migration",
];

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
  return diagnostics
    .map(
      (diagnostic) =>
        `${example.file}:${String(example.startLine + diagnostic.line)}: ` +
        diagnostic.message
    )
    .join("\n      ");
}

/** 期待とコンパイラの答えを突き合わせる。両方向とも違反になる。 */
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
          detail: `must-fail と宣言されているのにコンパイルが通った: ${example.reason}`,
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

/** 走査 → import 検査 → 型検査 → 突き合わせ。CLI もテストもここを通る。 */
export function checkDocExamples(
  repositoryRoot: string,
  docRoots: readonly string[] = CHECKED_DOC_ROOTS
): DocExampleReport {
  const scan = readAllDocExamples(repositoryRoot, docRoots);
  const importViolations: readonly DocExampleViolation[] =
    findDocImportViolations(repositoryRoot, docRoots).map((violation) => ({
      file: violation.file,
      startLine: violation.startLine,
      kind: "unpublishedImport" as const,
      detail: `package.json#exports に無いサブパス: "${violation.specifier}"`,
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
    `ドキュメント例の型検査: ${String(report.checkedCount)} 件を検査、` +
      `${String(report.mustFailCount)} 件は失敗を要求、` +
      `${String(report.skippedCount)} 件は skip`
  );
  if (report.unmappedOutput.length > 0) {
    console.error(`tsc の未対応出力:\n${report.unmappedOutput}`);
    return 1;
  }
  if (report.violations.length === 0) {
    console.error("違反なし");
    return 0;
  }
  console.error(`違反 ${String(report.violations.length)} 件:`);
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
