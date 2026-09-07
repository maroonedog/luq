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

/** 1エントリ1行。プラグインが71個に増えても max-lines 200 に収まる。 */
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
 * src/plugins/manifest.generated.ts をレンダリングする。
 * データだけを持ち、プラグイン本体を import しない
 * (manifest が実体を import すると L7 から L8 への上向き import が生まれる)。
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
      `${PLUGIN_MANIFEST_OUTPUT}: ${changed ? "更新しました" : "変更なし"}`
    );
    return 0;
  });
}
