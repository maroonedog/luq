import { buildPluginCatalog } from "./build-plugin-catalog";
import { buildPackageExportMap } from "./package-export-map";
import type { PackageExportMap } from "./plugin-catalog.types";
import { readSubpathAliases } from "./read-subpath-aliases";

/** そのリポジトリの現在の状態から公開 export マップを1つだけ作る。 */
export function buildRepositoryExportMap(
  repositoryRoot: string
): PackageExportMap {
  return buildPackageExportMap(
    buildPluginCatalog(repositoryRoot),
    readSubpathAliases(repositoryRoot)
  );
}
