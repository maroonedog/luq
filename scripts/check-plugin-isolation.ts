import * as fs from "fs";
import * as path from "path";
import { buildPluginCatalog } from "./catalog/build-plugin-catalog";
import {
  classifyPluginImport,
  isAllowedArea,
  type ImportArea,
} from "./catalog/classify-plugin-import";
import {
  collectTypeScriptFiles,
  toRepositoryRelativePosix,
} from "./catalog/collect-typescript-files";
import type { PluginTier } from "./catalog/plugin-catalog.types";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { readImportSpecifiers } from "./catalog/read-import-specifiers";
import { readPackageName } from "./catalog/read-package-json";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

export interface IsolationViolation {
  readonly file: string;
  readonly specifier: string;
  readonly area: ImportArea;
  readonly tier: PluginTier;
}

/**
 * プラグインの import を段ごとの閉じた許可集合に照らす。
 * 走査根は PLUGIN_SOURCE_ROOTS だけなので、src/json-schema/** のうち
 * extensions/ の外はそもそもプラグインディレクトリとして扱われない。
 */
export function findIsolationViolations(
  repositoryRoot: string
): readonly IsolationViolation[] {
  const packageName = readPackageName(repositoryRoot);
  const catalog = buildPluginCatalog(repositoryRoot);
  return catalog.entries.flatMap((entry) => {
    const absoluteDirectory = path.join(repositoryRoot, entry.directory);
    return collectTypeScriptFiles(absoluteDirectory).flatMap((absoluteFile) => {
      const importingFile = toRepositoryRelativePosix(
        repositoryRoot,
        absoluteFile
      );
      const sourceText = fs.readFileSync(absoluteFile, "utf8");
      return readImportSpecifiers(sourceText, importingFile)
        .map((specifier) => ({
          file: importingFile,
          specifier,
          tier: entry.tier,
          area: classifyPluginImport({
            repositoryRoot,
            importingFile,
            pluginDirectory: entry.directory,
            specifier,
            packageName,
          }),
        }))
        .filter((candidate) => !isAllowedArea(candidate.tier, candidate.area));
    });
  });
}

export function reportIsolationViolations(
  violations: readonly IsolationViolation[]
): void {
  if (violations.length === 0) {
    console.error("プラグイン隔離: 違反なし");
    return;
  }
  console.error(`プラグイン隔離違反 ${violations.length} 件:`);
  for (const violation of violations) {
    console.error(
      `  ${violation.file}: "${violation.specifier}" は領域 ${violation.area}` +
        ` で、${violation.tier} 段では許可されていません`
    );
  }
}

if (require.main === module) {
  runCheckAndExit(() => {
    const violations = findIsolationViolations(REPOSITORY_ROOT);
    reportIsolationViolations(violations);
    return violations.length === 0 ? 0 : 1;
  });
}
