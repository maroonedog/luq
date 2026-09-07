import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { DocExample } from "./doc-example.types";

const TYPESCRIPT_COMPILER = require.resolve("typescript/lib/tsc.js");
/** `example-3.ts(12,5): error TS2339: ...` の先頭部分。 */
const DIAGNOSTIC = /^(example-\d+\.ts)\((\d+),(\d+)\):\s+(error .+)$/;

export interface ExampleDiagnostic {
  readonly exampleIndex: number;
  /** コード例の中での行 (1 始まり)。ドキュメント上の行ではない。 */
  readonly line: number;
  readonly message: string;
}

export interface TypecheckOutcome {
  readonly exitCode: number;
  readonly diagnostics: readonly ExampleDiagnostic[];
  readonly unmappedOutput: string;
}

function exampleFileName(index: number): string {
  return `example-${String(index)}.ts`;
}

function writeTsconfig(root: string, includedIndices: readonly number[]): void {
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          lib: ["ES2020", "DOM"],
          module: "node16",
          moduleResolution: "node16",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          esModuleInterop: true,
          forceConsistentCasingInFileNames: true,
        },
        include: includedIndices.map(exampleFileName),
      },
      null,
      2
    ),
    "utf8"
  );
}

/**
 * ビルド済みパッケージだけが見えるスクラッチ consumer を作る。
 * node_modules/@maroonedog/luq をリポジトリへのジャンクションにしてあるので、
 * 解決されるのは package.json#exports と dist/ の .d.ts であって src/ ではない。
 * moduleResolution は node16 — exports マップを実際に強制する唯一の設定。
 */
export function createScratchConsumer(
  repositoryRoot: string,
  examples: readonly DocExample[]
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "luq-doc-examples-"));
  const scope = path.join(root, "node_modules", "@maroonedog");
  fs.mkdirSync(scope, { recursive: true });
  fs.symlinkSync(repositoryRoot, path.join(scope, "luq"), "junction");
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "luq-doc-examples", version: "0.0.0" }, null, 2),
    "utf8"
  );
  examples.forEach((example, index) => {
    // 末尾の `export {}` はモジュール化のため。追記なので、診断の行番号は
    // コード例の行番号のまま使える。
    fs.writeFileSync(
      path.join(root, exampleFileName(index)),
      `${example.code}\nexport {};\n`,
      "utf8"
    );
  });
  writeTsconfig(
    root,
    examples.map((_, index) => index)
  );
  return root;
}

function runCompiler(root: string): { exitCode: number; output: string } {
  try {
    const output = execFileSync(
      process.execPath,
      [TYPESCRIPT_COMPILER, "-p", "tsconfig.json", "--pretty", "false"],
      { cwd: root, encoding: "utf8" }
    );
    return { exitCode: 0, output };
  } catch (thrown) {
    const failure = thrown as { status?: number; stdout?: string };
    return { exitCode: failure.status ?? 1, output: failure.stdout ?? "" };
  }
}

function readExampleIndex(fileName: string): number {
  return Number.parseInt(fileName.slice("example-".length), 10);
}

interface ParsedOutput {
  readonly diagnostics: readonly ExampleDiagnostic[];
  readonly unmapped: readonly string[];
}

function parseCompilerOutput(output: string): ParsedOutput {
  const diagnostics: ExampleDiagnostic[] = [];
  const unmapped: string[] = [];
  for (const line of output.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    const parsed = DIAGNOSTIC.exec(line);
    if (parsed === null) {
      // 行頭が空白の行は直前の診断の続き。独立した行だけを未対応と数える。
      if (!line.startsWith(" ")) unmapped.push(line);
      continue;
    }
    diagnostics.push({
      exampleIndex: readExampleIndex(parsed[1] ?? ""),
      line: Number.parseInt(parsed[2] ?? "0", 10),
      message: parsed[4] ?? "",
    });
  }
  return { diagnostics, unmapped };
}

/**
 * スクラッチ consumer を作り、tsc を回して診断を例ごとに振り分ける。
 *
 * 2回回すことがあるのは、tsc が「構文エラーが1つでもあれば意味解析の診断を
 * 一切計算しない」ためである。この性質を知らずに1回で済ませていたとき、
 * 壊れた例が1つあるだけで他の例の型エラーが全部消えた (実測で確認)。
 * 1回目で診断が付いた例を外してもう一度回すことで、残りは必ず意味解析まで
 * 到達する。1回目が全緑ならそこで終わる。
 */
export function typecheckDocExamples(
  repositoryRoot: string,
  examples: readonly DocExample[]
): TypecheckOutcome {
  if (examples.length === 0) {
    return { exitCode: 0, diagnostics: [], unmappedOutput: "" };
  }
  const root = createScratchConsumer(repositoryRoot, examples);
  try {
    const first = runCompiler(root);
    const firstParsed = parseCompilerOutput(first.output);
    if (first.exitCode === 0) {
      return {
        exitCode: 0,
        diagnostics: firstParsed.diagnostics,
        unmappedOutput: firstParsed.unmapped.join("\n"),
      };
    }
    const reported = new Set(
      firstParsed.diagnostics.map((one) => one.exampleIndex)
    );
    const remaining = examples
      .map((_, index) => index)
      .filter((index) => !reported.has(index));
    if (remaining.length === 0) {
      return {
        exitCode: first.exitCode,
        diagnostics: firstParsed.diagnostics,
        unmappedOutput: firstParsed.unmapped.join("\n"),
      };
    }
    writeTsconfig(root, remaining);
    const second = parseCompilerOutput(runCompiler(root).output);
    return {
      exitCode: first.exitCode,
      diagnostics: [...firstParsed.diagnostics, ...second.diagnostics],
      unmappedOutput: [...firstParsed.unmapped, ...second.unmapped].join("\n"),
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
