import { buildPluginCatalog } from "./catalog/build-plugin-catalog";
import type {
  PluginCatalog,
  PluginCatalogEntry,
} from "./catalog/plugin-catalog.types";
import {
  PLUGIN_MANIFEST_OUTPUT,
  REPOSITORY_ROOT,
} from "./catalog/plugin-source-roots";
import {
  GENERATED_BANNER,
  writeGeneratedFile,
} from "./catalog/write-generated-file";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

const MANIFEST_ENTRY_TYPE = [
  "export interface PluginManifestEntry {",
  "  readonly directoryName: string;",
  "  readonly subpathName: string;",
  '  readonly tier: "isolated" | "extension";',
  "  readonly entryFile: string;",
  "  readonly exportedSymbols: readonly string[];",
  "}",
];

/** One line per entry, so the generated file stays inside the line limit. */
function renderEntry(entry: PluginCatalogEntry): string {
  const fields = [
    `directoryName: ${JSON.stringify(entry.directoryName)}`,
    `subpathName: ${JSON.stringify(entry.subpathName)}`,
    `tier: ${JSON.stringify(entry.tier)}`,
    `entryFile: ${JSON.stringify(entry.entryFile)}`,
    `exportedSymbols: ${JSON.stringify(entry.exportedSymbols)}`,
  ];
  return `  { ${fields.join(", ")} },`;
}

/**
 * Renders the plugin manifest.
 *
 * It holds data and imports no plugin: importing one would create an import
 * running outward from the plugin layer, which no layer may do.
 */
export function renderPluginManifest(catalog: PluginCatalog): string {
  const body =
    catalog.entries.length === 0
      ? ["export const PLUGIN_MANIFEST: readonly PluginManifestEntry[] = [];"]
      : [
          "export const PLUGIN_MANIFEST: readonly PluginManifestEntry[] = [",
          ...catalog.entries.map(renderEntry),
          "];",
        ];
  return [GENERATED_BANNER, "", ...MANIFEST_ENTRY_TYPE, "", ...body, ""].join(
    "\n"
  );
}

export function generatePluginManifest(repositoryRoot: string): boolean {
  return writeGeneratedFile(
    repositoryRoot,
    PLUGIN_MANIFEST_OUTPUT,
    renderPluginManifest(buildPluginCatalog(repositoryRoot))
  );
}

if (require.main === module) {
  runCheckAndExit(() => {
    const changed = generatePluginManifest(REPOSITORY_ROOT);
    console.error(
      `${PLUGIN_MANIFEST_OUTPUT}: ${changed ? "updated" : "unchanged"}`
    );
    return 0;
  });
}
