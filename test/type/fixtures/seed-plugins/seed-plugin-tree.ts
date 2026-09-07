/**
 * カタログ機構を駆動する種プラグイン。
 *
 * ここはファイルの「内容」だけを持ち、実ファイルは write-seed-tree.ts が
 * 一時ディレクトリに書き出す。src/plugins を一切見ないので、プラグイン段の
 * エージェントが後で触るファイルとは決して衝突しない。
 * ツリーをデータで持つことで、空ディレクトリ (git が追跡できない) も
 * 「プラグイン0件」の状態として表現できる。
 */
export type SeedFileTree = Readonly<Record<string, string>>;

export const SEED_PACKAGE_NAME = "@maroonedog/luq";

/** わざと風変わりな整形。exports 差し替えが他バイトを動かさないことの証拠になる。 */
export const SEED_PACKAGE_JSON = [
  "{",
  '  "name": "@maroonedog/luq",',
  '  "version": "9.9.9-seed",',
  '  "description": "seed fixture { with braces } and \\"quotes\\"",',
  '  "exports": {},',
  '  "sideEffects": false,',
  '  "files": ["dist"]',
  "}",
  "",
].join("\n");

const CORE_SOURCES: SeedFileTree = {
  "src/types/index.ts": "export type TypeName = string;\n",
  "src/path/field-path.types.ts": "export type FieldPath = string;\n",
  "src/plugin-kit/index.ts": "export const definePlugin = () => null;\n",
  "src/chain/field-chain.types.ts": "export type FieldChain = never;\n",
  "src/runtime/run-plan.ts": "export const runPlan = () => null;\n",
  "src/json-schema/keyword-map.ts": "export const KEYWORD_MAP = {};\n",
};

/** ディレクトリを持たない互換サブパスの転送先。実在するときだけ公開される。 */
const SUBPATH_ALIAS_MODULE: SeedFileTree = {
  "src/subpath-aliases/read-only-write-only.ts":
    'export { readOnlyPlugin } from "../plugins/read-only";\n',
};

const STRING_MIN_ENTRY = 'export { stringMinPlugin } from "./string-min";\n';

const STRING_MIN_BODY = [
  'import { definePlugin } from "../../plugin-kit";',
  'import type { TypeName } from "../../types";',
  'import type { FieldPath } from "../../path/field-path.types";',
  'import { describeStringMin } from "./describe-string-min";',
  "",
  "export const stringMinPlugin = {",
  '  name: "stringMin",',
  "  slots: [] as TypeName[],",
  "  path: null as FieldPath | null,",
  "  describe: describeStringMin,",
  "  build: definePlugin,",
  "};",
  "",
].join("\n");

const JSON_SCHEMA_ENTRY = [
  'import { KEYWORD_MAP } from "../../keyword-map";',
  'import { uuidPlugin } from "../../../plugins/uuid";',
  "",
  "export const jsonSchemaPlugin = { map: KEYWORD_MAP, uses: [uuidPlugin] };",
  "",
].join("\n");

/** isolated 3 件 + extension 2 件 = 5 件を持つ健全なツリー。 */
export const SEED_PLUGIN_TREE: SeedFileTree = {
  ...CORE_SOURCES,
  ...SUBPATH_ALIAS_MODULE,
  "package.json": SEED_PACKAGE_JSON,
  "src/plugins/string-min/index.ts": STRING_MIN_ENTRY,
  "src/plugins/string-min/string-min.ts": STRING_MIN_BODY,
  "src/plugins/string-min/describe-string-min.ts":
    "export const describeStringMin = () => null;\n",
  "src/plugins/uuid/index.ts": "export const uuidPlugin = { name: 1 };\n",
  "src/plugins/read-only/index.ts":
    "export const readOnlyPlugin = { name: 2 };\n",
  "src/json-schema/extensions/json-schema/index.ts": JSON_SCHEMA_ENTRY,
  "src/json-schema/extensions/json-schema-full-feature/index.ts":
    "export const jsonSchemaFullFeaturePlugin = { name: 4 };\n",
};

/** プラグインが1件も無い状態。空でも全生成物が成立することの証拠。 */
export const EMPTY_PLUGIN_TREE: SeedFileTree = {
  ...CORE_SOURCES,
  "package.json": SEED_PACKAGE_JSON,
};

export const IRREGULAR_DIRECTORY_TREE: SeedFileTree = {
  ...EMPTY_PLUGIN_TREE,
  "src/plugins/not_kebab/index.ts": "export const notKebabPlugin = {};\n",
};

export const UNDECLARED_EXTENSION_TREE: SeedFileTree = {
  ...EMPTY_PLUGIN_TREE,
  "src/json-schema/extensions/open-api/index.ts":
    "export const openApiPlugin = {};\n",
};

export const MISSING_ENTRY_TREE: SeedFileTree = {
  ...EMPTY_PLUGIN_TREE,
  "src/plugins/no-entry/no-entry.ts": "export const noEntryPlugin = {};\n",
};

export const NO_PLUGIN_SYMBOL_TREE: SeedFileTree = {
  ...EMPTY_PLUGIN_TREE,
  "src/plugins/silent/index.ts": "export const silent = {};\n",
};

/**
 * 接頭辞に一致するファイルを落としたツリーを作る。
 * 「プラグインを1件取り下げた」状況を、ディレクトリ削除に頼らずに表現する。
 */
export function omitSeedPaths(
  tree: SeedFileTree,
  pathPrefix: string
): SeedFileTree {
  return Object.fromEntries(
    Object.entries(tree).filter(
      ([relativePath]) => !relativePath.startsWith(pathPrefix)
    )
  );
}
