/**
 * カタログ機構の語彙。型のみ。
 *
 * 「プラグインカタログ」は src のディレクトリ構造から導出される唯一の真実であり、
 * manifest / barrel / package.json#exports / catalog lock の4つの派生物は
 * すべてこの型を入力に取る。二重管理を作らないための中心。
 */

/**
 * isolated: src/plugins/<dir>。plugin-kit / types / path / 自ディレクトリのみ import 可。
 * extension: src/json-schema/extensions/<dir>。加えて json-schema 層と
 *            プラグインの ENTRY ファイルを import 可。
 */
export type PluginTier = "isolated" | "extension";

export interface PluginSourceRoot {
  readonly tier: PluginTier;
  /** リポジトリルートからの posix 相対パス。例 "src/plugins" */
  readonly directory: string;
}

export interface PluginCatalogEntry {
  /** ディレクトリ名 (kebab-case)。例 "string-min" */
  readonly directoryName: string;
  /** 公開サブパス名 (camelCase)。例 "stringMin" */
  readonly subpathName: string;
  readonly tier: PluginTier;
  /** リポジトリルートからの posix 相対パス。例 "src/plugins/string-min" */
  readonly directory: string;
  /** エントリファイルの posix 相対パス。例 "src/plugins/string-min/index.ts" */
  readonly entryFile: string;
  /** エントリが export するプラグインシンボル。例 ["stringMinPlugin"] */
  readonly exportedSymbols: readonly string[];
}

export interface PluginCatalog {
  readonly entries: readonly PluginCatalogEntry[];
}

/** ディレクトリを持たない互換サブパス (1.x で公開済みの名前を落とさないため)。 */
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
