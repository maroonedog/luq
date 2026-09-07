// ===========================================================================
// scripts/doc-examples/read-astro-examples.ts
//
// docs-site の .astro ページからコード例を取り出し、Markdown のコード例と
// まったく同じ DocExample として返す。以降の扱い（exports マップ越しの型検査、
// must-fail の突き合わせ）は Markdown と共通の経路に乗る。
//
// これが要るのは、docs-site が check:docs の外に置かれていたからである。
// 1.x のサイトは `result.isValid()` を 31 箇所、`result.errors` を 16 箇所
// 載せたまま緑だった。誰も読まなかったのではなく、読む仕組みが無かった。
//
// 対象は「フロントマターで宣言され」かつ「typescript として CodeBlock に
// 渡されている」定数だけ。bash や json の例、どこからも表示されない定数は
// 落とす。期待値の書き方は read-astro-directives.ts にある。
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

/** 走査対象の .astro を集める。ファイル直指定もディレクトリも受ける。 */
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
 * `with` が指す定数のコードを、指された順に連ねる。指した先がさらに `with`
 * を持つ場合はそれも先に置く。同じ定数を2度は置かない（前置きが重複すると
 * 再宣言でコンパイルが落ちる）。
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

/** 1つの .astro からコード例を取り出す。 */
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
        detail: `luq-example: with が指す定数がこのファイルに無い: ${missing.join(", ")}`,
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
      // 補間を含む例は、表示されるコードがビルド時にしか決まらないので静的に
      // は検査できない。黙って落とさず skip として数え、報告に残す。
      expectation: constant.hasInterpolation ? "skip" : directives.expectation,
      reason: directives.reason,
      code:
        prelude.length === 0 ? constant.code : `${prelude}\n${constant.code}`,
      preludeLineCount: prelude.length === 0 ? 0 : countLines(prelude) + 1,
    });
  }

  return { examples, violations };
}

/** 走査根 (docs-site/src) をまとめて読む。 */
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
