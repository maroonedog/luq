import { buildPluginCatalog } from "./build-plugin-catalog";
import { buildPackageExportMap } from "./package-export-map";
import type { PackageExportMap } from "./plugin-catalog.types";
import { readSubpathAliases } from "./read-subpath-aliases";

/** Builds exactly one published export map from the repository's current state. */
export function buildRepositoryExportMap(
  repositoryRoot: string
): PackageExportMap {
  return buildPackageExportMap(
    buildPluginCatalog(repositoryRoot),
    readSubpathAliases(repositoryRoot)
  );
}
