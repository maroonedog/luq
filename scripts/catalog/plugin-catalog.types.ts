/**
 * The vocabulary of the catalog machinery. Types only.
 *
 * The plugin catalog is the one truth derived from the directory structure
 * under src, and every artefact built from it — the manifest, the barrel, the
 * exports map, the catalog lock — takes this type as its input. That is what
 * keeps any of them from being maintained separately.
 */

/**
 * isolated: under src/plugins. May import only plugin-kit, types, path and
 *           its own directory.
 * extension: under the JSON Schema extensions directory. May additionally
 *           import the JSON Schema layer and a plugin's ENTRY file.
 */
export type PluginTier = "isolated" | "extension";

export interface PluginSourceRoot {
  readonly tier: PluginTier;
  /** A posix path relative to the repository root, e.g. "src/plugins". */
  readonly directory: string;
}

export interface PluginCatalogEntry {
  /** The directory name, kebab-case, e.g. "string-min". */
  readonly directoryName: string;
  /** The published subpath name, camelCase, e.g. "stringMin". */
  readonly subpathName: string;
  readonly tier: PluginTier;
  /** A posix path relative to the repository root, e.g. "src/plugins/string-min". */
  readonly directory: string;
  /** The entry file's posix path, e.g. "src/plugins/string-min/index.ts". */
  readonly entryFile: string;
  /** The plugin symbols the entry exports, e.g. ["stringMinPlugin"]. */
  readonly exportedSymbols: readonly string[];
}

export interface PluginCatalog {
  readonly entries: readonly PluginCatalogEntry[];
}

/** A compatibility subpath with no directory, kept so a published name is not lost. */
export interface SubpathAlias {
  readonly subpathName: string;
  /** src/subpath-aliases/<moduleName>.ts */
  readonly moduleName: string;
}

export interface ExportConditions {
  readonly types: string;
  readonly import: string;
  readonly require: string;
}

export type ExportTarget = string | ExportConditions;

export type PackageExportMap = Readonly<Record<string, ExportTarget>>;

export interface PluginCatalogLockEntry {
  readonly subpath: string;
  readonly directory: string;
  readonly tier: PluginTier;
}

export interface PluginCatalogLock {
  readonly pluginCount: number;
  readonly plugins: readonly PluginCatalogLockEntry[];
  readonly exportKeys: readonly string[];
}
