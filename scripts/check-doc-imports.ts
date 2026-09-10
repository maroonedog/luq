import * as fs from "fs";
import * as path from "path";
import { buildRepositoryExportMap } from "./catalog/build-repository-export-map";
import { toRepositoryRelativePosix } from "./catalog/collect-typescript-files";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { readFencedCodeBlocks } from "./catalog/read-fenced-code-blocks";
import { readImportSpecifiers } from "./catalog/read-import-specifiers";
import { readPackageName } from "./catalog/read-package-json";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

export interface DocImportViolation {
  readonly file: string;
  readonly startLine: number;
  readonly specifier: string;
}

const DEFAULT_DOC_ROOTS: readonly string[] = ["README.md", "docs"];

function collectMarkdownFiles(absolutePath: string): string[] {
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

/** "@scope/pkg/plugins/x" -> "./plugins/x"、"@scope/pkg" -> "." */
function toSubpathKey(specifier: string, packageName: string): string | null {
  if (specifier === packageName) return ".";
  if (!specifier.startsWith(`${packageName}/`)) return null;
  return `./${specifier.slice(packageName.length + 1)}`;
}

/**
 * Whether any documented example imports a subpath that is not published.
 * Imports of other packages are out of scope.
 */
export function findDocImportViolations(
  repositoryRoot: string,
  docRoots: readonly string[] = DEFAULT_DOC_ROOTS
): readonly DocImportViolation[] {
  const packageName = readPackageName(repositoryRoot);
  const exportKeys = new Set(
    Object.keys(buildRepositoryExportMap(repositoryRoot))
  );
  return docRoots
    .flatMap((docRoot) =>
      collectMarkdownFiles(path.join(repositoryRoot, docRoot))
    )
    .flatMap((absoluteFile) => {
      const file = toRepositoryRelativePosix(repositoryRoot, absoluteFile);
      const markdown = fs.readFileSync(absoluteFile, "utf8");
      return readFencedCodeBlocks(markdown).flatMap((block) =>
        readImportSpecifiers(block.code, `${file}#${block.startLine}`)
          .map((specifier) => ({
            file,
            startLine: block.startLine,
            specifier,
            key: toSubpathKey(specifier, packageName),
          }))
          .filter(
            (candidate) =>
              candidate.key !== null && !exportKeys.has(candidate.key)
          )
          .map(({ file: docFile, startLine, specifier }) => ({
            file: docFile,
            startLine,
            specifier,
          }))
      );
    });
}

if (require.main === module) {
  runCheckAndExit(() => {
    const violations = findDocImportViolations(REPOSITORY_ROOT);
    if (violations.length === 0) {
      console.error("Doc imports: no violations");
      return 0;
    }
    console.error(
      `${violations.length} examples import an unpublished subpath:`
    );
    for (const violation of violations) {
      console.error(
        `  ${violation.file}:${violation.startLine}: "${violation.specifier}"`
      );
    }
    return 1;
  });
}
