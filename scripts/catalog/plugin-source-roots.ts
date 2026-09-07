import * as path from "path";
import type {
  PluginSourceRoot,
  SubpathAlias,
} from "./plugin-catalog.types";

/** scripts/catalog/ から2つ上がリポジトリルート。 */
export const REPOSITORY_ROOT = path.resolve(__dirname, "..", "..");

/**
 * プラグインディレクトリの走査対象。ここに無いものはプラグインではない。
 *
 * src/json-schema/** のうち extensions/ の外は「JSON Schema 層のモジュール」であって
 * プラグインディレクトリではない。走査根を extensions/ に限定することで、
 * それが構造的に保証される (設計の決着事項)。
 * src/subpath-aliases/ も同じ理由で走査されない。
 */
export const PLUGIN_SOURCE_ROOTS: readonly PluginSourceRoot[] = [
  { tier: "isolated", directory: "src/plugins" },
  { tier: "extension", directory: "src/json-schema/extensions" },
];

/** ディレクトリを持たない互換サブパス。1.x の ./plugins/readOnlyWriteOnly を残す。 */
export const SUBPATH_ALIASES: readonly SubpathAlias[] = [
  { subpathName: "readOnlyWriteOnly", moduleName: "read-only-write-only" },
];

/** プラグイン以外の固定 export キー。順序はそのまま package.json に出る。 */
export const FIXED_EXPORT_KEYS: readonly string[] = [
  ".",
  "./package.json",
  "./result",
  "./plugin-kit",
  "./async",
  "./plugins",
];

export const PLUGIN_MANIFEST_OUTPUT = "src/plugins/manifest.generated.ts";
export const PLUGIN_BARREL_OUTPUT = "src/plugins/index.generated.ts";
export const PLUGIN_CATALOG_LOCK_OUTPUT = "config/plugin-catalog.lock.json";
