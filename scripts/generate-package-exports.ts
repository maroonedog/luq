import * as fs from "fs";
import * as path from "path";
import { buildRepositoryExportMap } from "./catalog/build-repository-export-map";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { readPackageJsonText } from "./catalog/read-package-json";
import {
  renderJsonValue,
  spliceJsonMember,
} from "./catalog/splice-json-member";
import type { PackageExportMap } from "./catalog/plugin-catalog.types";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

/**
 * package.json のうち #/exports の値だけを差し替えたテキストを返す。
 * 他のフィールドは1バイトも動かさない。
 */
export function renderPackageJsonWithExports(
  packageJsonText: string,
  exportMap: PackageExportMap
): string {
  return spliceJsonMember(
    packageJsonText,
    "exports",
    renderJsonValue(exportMap, 1)
  );
}

export function generatePackageExports(repositoryRoot: string): boolean {
  const packageJsonText = readPackageJsonText(repositoryRoot);
  const exportMap = buildRepositoryExportMap(repositoryRoot);
  const updated = renderPackageJsonWithExports(packageJsonText, exportMap);
  if (updated === packageJsonText) return false;
  fs.writeFileSync(path.join(repositoryRoot, "package.json"), updated, "utf8");
  return true;
}

if (require.main === module) {
  runCheckAndExit(() => {
    const changed = generatePackageExports(REPOSITORY_ROOT);
    console.error(
      `package.json#/exports: ${changed ? "更新しました" : "変更なし"}`
    );
    return 0;
  });
}
