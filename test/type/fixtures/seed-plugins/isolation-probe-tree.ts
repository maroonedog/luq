import { SEED_PLUGIN_TREE, type SeedFileTree } from "./seed-plugin-tree";

/**
 * 隔離検査をわざと破るプラグイン。1ディレクトリ1違反にしてあるので、
 * 検出漏れがあれば「どの違反が消えたか」が名前で分かる。
 */
const LEAKY_PLUGINS: SeedFileTree = {
  "src/plugins/leaks-to-sibling/index.ts": [
    'import { uuidPlugin } from "../uuid";',
    "export const leaksToSiblingPlugin = { uuidPlugin };",
    "",
  ].join("\n"),
  "src/plugins/leaks-to-chain/index.ts": [
    'import type { FieldChain } from "../../chain/field-chain.types";',
    "export const leaksToChainPlugin = { chain: null as FieldChain | null };",
    "",
  ].join("\n"),
  "src/plugins/leaks-to-json-schema/index.ts": [
    'import { KEYWORD_MAP } from "../../json-schema/keyword-map";',
    "export const leaksToJsonSchemaPlugin = { KEYWORD_MAP };",
    "",
  ].join("\n"),
  "src/plugins/leaks-to-runtime/index.ts": [
    'import { runPlan } from "../../runtime/run-plan";',
    "export const leaksToRuntimePlugin = { runPlan };",
    "",
  ].join("\n"),
  "src/plugins/leaks-to-package/index.ts": [
    'import { KEYWORD_MAP } from "@maroonedog/luq/json-schema/keyword-map";',
    "export const leaksToPackagePlugin = { KEYWORD_MAP };",
    "",
  ].join("\n"),
  "src/plugins/leaks-to-external/index.ts": [
    'import { z } from "zod";',
    "export const leaksToExternalPlugin = { z };",
    "",
  ].join("\n"),
  "src/plugins/leaks-to-nowhere/index.ts": [
    'import { missing } from "./does-not-exist";',
    "export const leaksToNowherePlugin = { missing };",
    "",
  ].join("\n"),
};

/** 健全なツリーに違反プラグインを重ねたもの。 */
export const ISOLATION_PROBE_TREE: SeedFileTree = {
  ...SEED_PLUGIN_TREE,
  ...LEAKY_PLUGINS,
};

/** 違反プラグインのディレクトリ名。すべて検出されなければならない。 */
export const LEAKY_PLUGIN_DIRECTORIES: readonly string[] = [
  "src/plugins/leaks-to-chain",
  "src/plugins/leaks-to-external",
  "src/plugins/leaks-to-json-schema",
  "src/plugins/leaks-to-nowhere",
  "src/plugins/leaks-to-package",
  "src/plugins/leaks-to-runtime",
  "src/plugins/leaks-to-sibling",
];

/**
 * extension 段では許される import だけを持つプラグイン。
 * isolated 段で同じ import が落ちることの対照群になる。
 */
export const EXTENSION_ONLY_IMPORTS: readonly string[] = [
  "../../keyword-map",
  "../../../plugins/uuid",
];
