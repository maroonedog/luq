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
 * Checks a plugin's imports against the closed set its tier permits.
 *
 * Only the plugin source roots are scanned, so a module of the JSON Schema
 * layer outside the extensions directory is never treated as a plugin at all.
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
    console.error("Plugin isolation: no violations");
    return;
  }
  console.error(`Plugin isolation: ${violations.length} violations:`);
  for (const violation of violations) {
    console.error(
      `  ${violation.file}: "${violation.specifier}" is in area ${violation.area},` +
        ` which the ${violation.tier} tier does not permit`
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
