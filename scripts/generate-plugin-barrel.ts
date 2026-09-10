import * as path from "path";
import { buildPluginCatalog } from "./catalog/build-plugin-catalog";
import type {
  PluginCatalog,
  PluginCatalogEntry,
} from "./catalog/plugin-catalog.types";
import {
  PLUGIN_BARREL_OUTPUT,
  REPOSITORY_ROOT,
} from "./catalog/plugin-source-roots";
import {
  GENERATED_BANNER,
  writeGeneratedFile,
} from "./catalog/write-generated-file";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

const BARREL_DIRECTORY = path.posix.dirname(PLUGIN_BARREL_OUTPUT);

function toRelativeSpecifier(entry: PluginCatalogEntry): string {
  const relative = path.posix.relative(BARREL_DIRECTORY, entry.directory);
  return relative.startsWith(".") ? relative : `./${relative}`;
}

/**
 * The barrel re-exporting every plugin from one place, behind the "./plugins"
 * subpath.
 *
 * The names are only the symbols the catalog actually read from the entry
 * files, so a symbol that does not exist cannot be written. That is what
 * closes the gap the previous major had between what its barrel named and what
 * its exports map published.
 */
export function renderPluginBarrel(catalog: PluginCatalog): string {
  if (catalog.entries.length === 0) {
    return [GENERATED_BANNER, "", "export {};", ""].join("\n");
  }
  const lines = catalog.entries.flatMap((entry) =>
    entry.exportedSymbols.map(
      (symbol) => `export { ${symbol} } from "${toRelativeSpecifier(entry)}";`
    )
  );
  return [GENERATED_BANNER, "", ...lines, ""].join("\n");
}

export function generatePluginBarrel(repositoryRoot: string): boolean {
  return writeGeneratedFile(
    repositoryRoot,
    PLUGIN_BARREL_OUTPUT,
    renderPluginBarrel(buildPluginCatalog(repositoryRoot))
  );
}

if (require.main === module) {
  runCheckAndExit(() => {
    const changed = generatePluginBarrel(REPOSITORY_ROOT);
    console.error(
      `${PLUGIN_BARREL_OUTPUT}: ${changed ? "updated" : "unchanged"}`
    );
    return 0;
  });
}
