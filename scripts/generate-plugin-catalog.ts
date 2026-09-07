import { buildPluginCatalog } from "./catalog/build-plugin-catalog";
import { buildRepositoryExportMap } from "./catalog/build-repository-export-map";
import { toPluginSubpath } from "./catalog/package-export-map";
import type { PluginCatalogLock } from "./catalog/plugin-catalog.types";
import {
  PLUGIN_CATALOG_LOCK_OUTPUT,
  REPOSITORY_ROOT,
} from "./catalog/plugin-source-roots";
import { writeGeneratedFile } from "./catalog/write-generated-file";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

/**
 * config/plugin-catalog.lock.json の内容。
 * CI に散らばっていたプラグイン数のハードコードを、この1ファイルに集約する。
 */
export function buildPluginCatalogLock(
  repositoryRoot: string
): PluginCatalogLock {
  const catalog = buildPluginCatalog(repositoryRoot);
  return {
    pluginCount: catalog.entries.length,
    plugins: catalog.entries.map((entry) => ({
      subpath: toPluginSubpath(entry.subpathName),
      directory: entry.directory,
      tier: entry.tier,
    })),
    exportKeys: Object.keys(buildRepositoryExportMap(repositoryRoot)),
  };
}

export function renderPluginCatalogLock(repositoryRoot: string): string {
  return `${JSON.stringify(buildPluginCatalogLock(repositoryRoot), null, 2)}\n`;
}

export function generatePluginCatalogLock(repositoryRoot: string): boolean {
  return writeGeneratedFile(
    repositoryRoot,
    PLUGIN_CATALOG_LOCK_OUTPUT,
    renderPluginCatalogLock(repositoryRoot)
  );
}

if (require.main === module) {
  runCheckAndExit(() => {
    const changed = generatePluginCatalogLock(REPOSITORY_ROOT);
    console.error(
      `${PLUGIN_CATALOG_LOCK_OUTPUT}: ${changed ? "更新しました" : "変更なし"}`
    );
    return 0;
  });
}
