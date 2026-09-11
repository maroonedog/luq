import { buildPluginCatalog } from "./catalog/build-plugin-catalog";
import { readPluginSurfaces } from "./catalog/read-plugin-surface";
import type {
  PluginCatalog,
  PluginCatalogEntry,
} from "./catalog/plugin-catalog.types";
import type { PluginSurface } from "./catalog/read-plugin-surface";
import {
  PACKAGE_NAME,
  PLUGIN_MANIFEST_OUTPUT,
  REPOSITORY_ROOT,
} from "./catalog/plugin-source-roots";
import {
  GENERATED_BANNER,
  writeGeneratedFile,
} from "./catalog/write-generated-file";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

const MANIFEST_ENTRY_TYPE = [
  "/** One plugin symbol: the method it adds, and the slots it adds it to. */",
  "export interface PluginSurface {",
  '  /** The symbol to pass to `.use()`, e.g. "stringMinPlugin". */',
  "  readonly symbol: string;",
  '  /** The chain method it adds, e.g. "min". */',
  "  readonly method: string;",
  '  /** The slots that method appears on, e.g. ["string"]. */',
  "  readonly slots: readonly string[];",
  "}",
  "",
  "export interface PluginManifestEntry {",
  "  readonly directoryName: string;",
  "  readonly subpathName: string;",
  '  readonly tier: "isolated" | "extension";',
  "  /**",
  "   * Where the plugin lives in the REPOSITORY. A source path, so it resolves",
  "   * only in a checkout; an installed package has no src directory. What a",
  "   * consumer writes instead is `entryPoint`.",
  "   */",
  "  readonly entryFile: string;",
  '  /** The specifier a consumer writes, e.g. "@maroonedog/luq/plugins/stringMin". */',
  "  readonly entryPoint: string;",
  "  readonly exportedSymbols: readonly string[];",
  "  /** One per exported symbol, in the same order. */",
  "  readonly surfaces: readonly PluginSurface[];",
  "}",
];

/** One line per entry, so the generated file stays inside the line limit. */
function renderEntry(
  entry: PluginCatalogEntry,
  surfaces: readonly PluginSurface[]
): string {
  const fields = [
    `directoryName: ${JSON.stringify(entry.directoryName)}`,
    `subpathName: ${JSON.stringify(entry.subpathName)}`,
    `tier: ${JSON.stringify(entry.tier)}`,
    `entryFile: ${JSON.stringify(entry.entryFile)}`,
    `entryPoint: ${JSON.stringify(`${PACKAGE_NAME}/plugins/${entry.subpathName}`)}`,
    `exportedSymbols: ${JSON.stringify(entry.exportedSymbols)}`,
    `surfaces: ${JSON.stringify(
      entry.exportedSymbols.map((symbol, index) => ({
        symbol,
        method: surfaces[index]?.method ?? "",
        slots: surfaces[index]?.slots ?? [],
      }))
    )}`,
  ];
  return `  { ${fields.join(", ")} },`;
}

/**
 * Renders the plugin manifest.
 *
 * It holds data and imports no plugin: importing one would create an import
 * running outward from the plugin layer, which no layer may do. The generator
 * does import them, to read the method and slots each one really adds rather
 * than what its source text appears to say.
 */
export function renderPluginManifest(
  catalog: PluginCatalog,
  surfacesOf: (entry: PluginCatalogEntry) => readonly PluginSurface[]
): string {
  const body =
    catalog.entries.length === 0
      ? ["export const PLUGIN_MANIFEST: readonly PluginManifestEntry[] = [];"]
      : [
          "export const PLUGIN_MANIFEST: readonly PluginManifestEntry[] = [",
          ...catalog.entries.map((entry) =>
            renderEntry(entry, surfacesOf(entry))
          ),
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
    renderPluginManifest(buildPluginCatalog(repositoryRoot), (entry) =>
      readPluginSurfaces(repositoryRoot, entry)
    )
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
