import * as fs from "fs";
import * as path from "path";
import { toRepositoryRelativePosix } from "../catalog/collect-typescript-files";
import type {
  DocExample,
  DocExampleExpectation,
  DocExampleViolation,
} from "./doc-example.types";

const FENCE = /^```([A-Za-z0-9]*)\s*$/;
const CLOSING_FENCE = /^```\s*$/;
/** `<!-- luq-example: skip — 断片なので単体ではコンパイルできない -->` */
const DIRECTIVE = /^<!--\s*luq-example:\s*([A-Za-z-]+)\s*(.*?)\s*-->\s*$/;

const CHECKED_LANGUAGES = new Set(["ts", "tsx", "typescript"]);
const KNOWN_EXPECTATIONS = new Set(["skip", "must-fail"]);

export interface DocExampleScan {
  readonly examples: readonly DocExample[];
  readonly violations: readonly DocExampleViolation[];
}

/** 走査対象の .md を集める。ファイル直指定 (README.md) もディレクトリも受ける。 */
export function collectMarkdownFiles(absolutePath: string): string[] {
  if (!fs.existsSync(absolutePath)) return [];
  if (!fs.statSync(absolutePath).isDirectory()) {
    return absolutePath.endsWith(".md") ? [absolutePath] : [];
  }
  return fs
    .readdirSync(absolutePath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) =>
      collectMarkdownFiles(path.join(absolutePath, entry.name))
    );
}

function toExpectation(directive: string): DocExampleExpectation | null {
  if (directive === "skip") return "skip";
  if (directive === "must-fail") return "must-fail";
  return null;
}

interface PendingDirective {
  readonly expectation: DocExampleExpectation;
  readonly reason: string;
}

/**
 * 1つの Markdown からコード例を取り出す。
 * ts/tsx/typescript のフェンスだけを対象にし、直前の行にディレクティブが
 * あればその期待値を採る。理由の無いディレクティブは違反として返す。
 */
export function readDocExamples(
  repositoryRoot: string,
  absoluteFile: string
): DocExampleScan {
  const file = toRepositoryRelativePosix(repositoryRoot, absoluteFile);
  const lines = fs.readFileSync(absoluteFile, "utf8").split(/\r?\n/);
  const examples: DocExample[] = [];
  const violations: DocExampleViolation[] = [];
  let pending: PendingDirective | null = null;
  let openedAt = 0;
  let language = "";
  let body: string[] = [];
  let isOpen = false;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (isOpen) {
      if (CLOSING_FENCE.test(line)) {
        isOpen = false;
        if (CHECKED_LANGUAGES.has(language)) {
          examples.push({
            file,
            startLine: openedAt,
            language,
            expectation: pending?.expectation ?? "compiles",
            reason: pending?.reason ?? "",
            code: body.join("\n"),
          });
        }
        pending = null;
        return;
      }
      body.push(line);
      return;
    }
    const directive = DIRECTIVE.exec(line);
    if (directive !== null) {
      const expectation = toExpectation(directive[1] ?? "");
      if (expectation === null) {
        violations.push({
          file,
          startLine: lineNumber,
          kind: "unknownDirective",
          detail: `未知のディレクティブ "${directive[1] ?? ""}"。使えるのは ${[
            ...KNOWN_EXPECTATIONS,
          ].join(" / ")}`,
        });
        return;
      }
      const reason = directive[2] ?? "";
      if (reason.length === 0) {
        violations.push({
          file,
          startLine: lineNumber,
          kind: "directiveWithoutReason",
          detail: `luq-example: ${expectation} には理由を書くこと`,
        });
        return;
      }
      pending = { expectation, reason };
      return;
    }
    const fence = FENCE.exec(line);
    if (fence === null) {
      if (line.trim().length > 0) pending = null;
      return;
    }
    isOpen = true;
    openedAt = lineNumber;
    language = (fence[1] ?? "").toLowerCase();
    body = [];
  });

  return { examples, violations };
}

/** 走査根 (README.md や docs/guide) をまとめて読む。 */
export function readAllDocExamples(
  repositoryRoot: string,
  docRoots: readonly string[]
): DocExampleScan {
  const scans = docRoots
    .flatMap((docRoot) =>
      collectMarkdownFiles(path.join(repositoryRoot, docRoot))
    )
    .map((absoluteFile) => readDocExamples(repositoryRoot, absoluteFile));
  return {
    examples: scans.flatMap((scan) => scan.examples),
    violations: scans.flatMap((scan) => scan.violations),
  };
}
