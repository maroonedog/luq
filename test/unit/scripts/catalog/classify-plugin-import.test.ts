import {
  ALLOWED_AREAS_BY_TIER,
  classifyPluginImport,
  isAllowedArea,
  type ImportArea,
} from "../../../../scripts/catalog/classify-plugin-import";
import {
  SEED_PACKAGE_NAME,
  SEED_PLUGIN_TREE,
} from "../../../type/fixtures/seed-plugins/seed-plugin-tree";
import { withSeedTree } from "../../../type/fixtures/seed-plugins/write-seed-tree";

function classifyFromStringMin(
  repositoryRoot: string,
  specifier: string
): ImportArea {
  return classifyPluginImport({
    repositoryRoot,
    importingFile: "src/plugins/string-min/string-min.ts",
    pluginDirectory: "src/plugins/string-min",
    specifier,
    packageName: SEED_PACKAGE_NAME,
  });
}

function classifyFromExtension(
  repositoryRoot: string,
  specifier: string
): ImportArea {
  return classifyPluginImport({
    repositoryRoot,
    importingFile: "src/json-schema/extensions/json-schema/index.ts",
    pluginDirectory: "src/json-schema/extensions/json-schema",
    specifier,
    packageName: SEED_PACKAGE_NAME,
  });
}

describe("classifyPluginImport", () => {
  const isolatedCases: readonly (readonly [string, ImportArea])[] = [
    ["./describe-string-min", "own-directory"],
    ["./index", "own-directory"],
    ["../../plugin-kit", "plugin-kit"],
    ["../../types", "types"],
    ["../../path/field-path.types", "path"],
    ["../uuid", "plugin-entry"],
    ["../../json-schema/keyword-map", "json-schema"],
    ["../../chain/field-chain.types", "chain"],
    ["../../runtime/run-plan", "runtime"],
    ["../../subpath-aliases/read-only-write-only", "other-source"],
    ["zod", "external"],
    ["fs", "external"],
    ["./does-not-exist", "unresolved"],
    ["../../../outside-the-repo", "unresolved"],
  ];

  it.each(isolatedCases)("%s は %s に分類される", (specifier, area) => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(classifyFromStringMin(root, specifier)).toBe(area);
    });
  });

  it("自パッケージ名経由の import も src の領域に落ちる", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(
        classifyFromStringMin(root, "@maroonedog/luq/json-schema/keyword-map")
      ).toBe("json-schema");
      expect(classifyFromStringMin(root, "@maroonedog/luq/plugin-kit")).toBe(
        "plugin-kit"
      );
    });
  });

  it("他プラグインの内部ファイルはエントリと区別される", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(classifyFromStringMin(root, "../uuid")).toBe("plugin-entry");
      expect(
        classifyPluginImport({
          repositoryRoot: root,
          importingFile: "src/plugins/uuid/index.ts",
          pluginDirectory: "src/plugins/uuid",
          specifier: "../string-min/describe-string-min",
          packageName: SEED_PACKAGE_NAME,
        })
      ).toBe("plugin-internal");
    });
  });

  it("extension からは json-schema 層とプラグインエントリが見える", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(classifyFromExtension(root, "../../keyword-map")).toBe(
        "json-schema"
      );
      expect(classifyFromExtension(root, "../../../plugins/uuid")).toBe(
        "plugin-entry"
      );
      expect(classifyFromExtension(root, "../json-schema-full-feature")).toBe(
        "plugin-entry"
      );
    });
  });
});

describe("ALLOWED_AREAS_BY_TIER", () => {
  it("isolated の許可集合は plugin-kit / types / path / 自ディレクトリだけ", () => {
    expect([...ALLOWED_AREAS_BY_TIER.isolated].sort()).toEqual([
      "own-directory",
      "path",
      "plugin-kit",
      "types",
    ]);
  });

  it("extension は json-schema とプラグインエントリを加えるだけ", () => {
    expect([...ALLOWED_AREAS_BY_TIER.extension].sort()).toEqual([
      "json-schema",
      "own-directory",
      "path",
      "plugin-entry",
      "plugin-kit",
      "types",
    ]);
  });

  const forbiddenEverywhere: readonly ImportArea[] = [
    "chain",
    "compile",
    "runtime",
    "builder",
    "result",
    "async",
    "other-source",
    "external",
    "unresolved",
    "plugin-internal",
  ];

  it.each(forbiddenEverywhere)("%s はどちらの段でも禁止", (area) => {
    expect(isAllowedArea("isolated", area)).toBe(false);
    expect(isAllowedArea("extension", area)).toBe(false);
  });

  it("isolated では兄弟プラグインと json-schema が禁止", () => {
    expect(isAllowedArea("isolated", "plugin-entry")).toBe(false);
    expect(isAllowedArea("isolated", "json-schema")).toBe(false);
    expect(isAllowedArea("extension", "plugin-entry")).toBe(true);
    expect(isAllowedArea("extension", "json-schema")).toBe(true);
  });
});
