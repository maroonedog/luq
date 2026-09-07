import * as fs from "fs";
import * as path from "path";
import { DIST_DIRECTORY, listFilesRecursively } from "./dist-layout";

export interface DynamicCodeFinding {
  /** dist-relative posix path. */
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly text: string;
}

interface DynamicCodeRule {
  readonly rule: string;
  readonly pattern: RegExp;
}

/**
 * Every way a JavaScript artifact can turn a string into code.
 *
 * This is the ONLY mechanical guarantee behind the CSP-safe claim, so the list
 * is deliberately wider than `eval` and `new Function`: indirect eval, the
 * Function constructor called without `new`, the two hidden constructors
 * reachable from a generator or an async function, the string forms of the
 * timers, and `vm`. 1.x carried a live `new Function` in src that happened not
 * to reach the bundle; a gate that only looked for two spellings would have
 * missed a rename.
 */
const DYNAMIC_CODE_RULES: readonly DynamicCodeRule[] = [
  { rule: "eval-call", pattern: /\beval\s*\(/ },
  { rule: "indirect-eval", pattern: /\(\s*0\s*,\s*eval\s*\)/ },
  { rule: "new-function", pattern: /\bnew\s+Function\s*\(/ },
  { rule: "function-constructor", pattern: /(?<![\w$.])Function\s*\(/ },
  { rule: "async-function-constructor", pattern: /\bAsyncFunction\s*\(/ },
  {
    rule: "generator-function-constructor",
    pattern: /\bGeneratorFunction\s*\(/,
  },
  {
    rule: "string-timer",
    pattern: /\b(?:setTimeout|setInterval)\s*\(\s*['"`]/,
  },
  { rule: "vm-module", pattern: /['"](?:node:)?vm['"]/ },
  {
    rule: "dynamic-global-lookup",
    pattern: /\bglobalThis\s*\[\s*['"](?:eval|Function)['"]\s*\]/,
  },
];

/** .js, .mjs and .d.ts — everything the package ships that a runtime reads. */
function isShippedScript(file: string): boolean {
  return file.endsWith(".js") || file.endsWith(".mjs");
}

export function findDynamicCodeInText(
  file: string,
  text: string
): readonly DynamicCodeFinding[] {
  return text.split("\n").flatMap((lineText, index) =>
    DYNAMIC_CODE_RULES.filter((rule) => rule.pattern.test(lineText)).map(
      (rule) => ({
        file,
        line: index + 1,
        rule: rule.rule,
        text: lineText.trim().slice(0, 120),
      })
    )
  );
}

export interface DynamicCodeReport {
  readonly scannedFileCount: number;
  readonly findings: readonly DynamicCodeFinding[];
}

export function findDynamicCode(distRoot: string): DynamicCodeReport {
  const files = listFilesRecursively(distRoot).filter(isShippedScript);
  const findings = files.flatMap((file) =>
    findDynamicCodeInText(
      file,
      fs.readFileSync(path.join(distRoot, file), "utf8")
    )
  );
  return { scannedFileCount: files.length, findings };
}

export function resolveDistRoot(repositoryRoot: string): string {
  return path.join(repositoryRoot, DIST_DIRECTORY);
}
