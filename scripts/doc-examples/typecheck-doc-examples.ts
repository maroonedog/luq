import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { DocExample } from "./doc-example.types";

const TYPESCRIPT_COMPILER = require.resolve("typescript/lib/tsc.js");
/** The leading part of `example-3.ts(12,5): error TS2339: ...`. */
const DIAGNOSTIC = /^(example-\d+\.ts)\((\d+),(\d+)\):\s+(error .+)$/;

export interface ExampleDiagnostic {
  readonly exampleIndex: number;
  /** The line within the example, 1-based. Not the line in the document. */
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
 * Builds a scratch consumer that can see only the built package. The package
 * is linked into its node_modules, so what resolves is the exports map and the
 * declaration files in dist, never src. moduleResolution is node16, the one
 * setting that actually enforces an exports map.
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
    // The trailing `export {}` makes it a module. Being appended, it leaves
    // the diagnostics' line numbers equal to the example's own.
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
      // A line starting with whitespace continues the previous diagnostic.
      // Only standalone lines count as unrecognised.
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
 * Builds the scratch consumer, runs the compiler, and sorts the diagnostics
 * back to their examples.
 *
 * It sometimes runs twice, because the compiler computes no semantic
 * diagnostics at all if there is a single syntax error anywhere. Running once
 * without knowing that, one broken example made every other example's type
 * errors vanish. Dropping the examples that got a diagnostic and running again
 * guarantees the rest reach semantic analysis. An all-green first pass ends
 * there.
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
