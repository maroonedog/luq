import {
  buildPluginCatalog,
  PluginCatalogError,
} from "../../../../scripts/catalog/build-plugin-catalog";
import { IrregularDirectoryNameError } from "../../../../scripts/catalog/subpath-name";
import {
  EMPTY_PLUGIN_TREE,
  IRREGULAR_DIRECTORY_TREE,
  MISSING_ENTRY_TREE,
  NO_PLUGIN_SYMBOL_TREE,
  SEED_PLUGIN_TREE,
  UNDECLARED_EXTENSION_TREE,
} from "../../../type/fixtures/seed-plugins/seed-plugin-tree";
import {
  withSeedTree,
  writeSeedFile,
} from "../../../type/fixtures/seed-plugins/write-seed-tree";

describe("buildPluginCatalog", () => {
  it("プラグインが1件も無くても空のカタログを返す", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      expect(buildPluginCatalog(root).entries).toEqual([]);
    });
  });

  it("src が丸ごと無くても落ちない", () => {
    withSeedTree({ "package.json": "{}\n" }, (root) => {
      expect(buildPluginCatalog(root).entries).toEqual([]);
    });
  });

  it("2つの走査根からプラグインを集め、サブパス名で並べる", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      const catalog = buildPluginCatalog(root);
      expect(catalog.entries.map((entry) => entry.subpathName)).toEqual([
        "jsonSchema",
        "jsonSchemaFullFeature",
        "readOnly",
        "stringMin",
        "uuid",
      ]);
      expect(catalog.entries.map((entry) => entry.tier)).toEqual([
        "extension",
        "extension",
        "isolated",
        "isolated",
        "isolated",
      ]);
    });
  });

  it("エントリが実際に export しているシンボルだけを記録する", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      const byName = new Map(
        buildPluginCatalog(root).entries.map((entry) => [
          entry.subpathName,
          entry,
        ])
      );
      expect(byName.get("stringMin")?.exportedSymbols).toEqual([
        "stringMinPlugin",
      ]);
      expect(byName.get("uuid")?.exportedSymbols).toEqual(["uuidPlugin"]);
      expect(byName.get("stringMin")?.entryFile).toBe(
        "src/plugins/string-min/index.ts"
      );
    });
  });

  it("src/json-schema/** のうち extensions/ の外はプラグインではない", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      const directories = buildPluginCatalog(root).entries.map(
        (entry) => entry.directory
      );
      expect(directories).not.toContain("src/json-schema");
      expect(directories).not.toContain("src/json-schema/keyword-map");
      expect(directories).toContain("src/json-schema/extensions/json-schema");
    });
  });

  it("src/subpath-aliases はプラグインディレクトリではない", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      const directories = buildPluginCatalog(root).entries.map(
        (entry) => entry.directory
      );
      expect(
        directories.filter((directory) =>
          directory.startsWith("src/subpath-aliases")
        )
      ).toEqual([]);
    });
  });

  it("index.ts の無いディレクトリは落ちる", () => {
    withSeedTree(MISSING_ENTRY_TREE, (root) => {
      expect(() => buildPluginCatalog(root)).toThrow(PluginCatalogError);
      expect(() => buildPluginCatalog(root)).toThrow(/no index\.ts/);
    });
  });

  it("Plugin シンボルを export しないエントリは落ちる", () => {
    withSeedTree(NO_PLUGIN_SYMBOL_TREE, (root) => {
      expect(() => buildPluginCatalog(root)).toThrow(PluginCatalogError);
    });
  });

  it("不正なディレクトリ名は落ちる", () => {
    withSeedTree(IRREGULAR_DIRECTORY_TREE, (root) => {
      expect(() => buildPluginCatalog(root)).toThrow(
        IrregularDirectoryNameError
      );
    });
  });

  it("上書き表に無い extension ディレクトリは落ちる", () => {
    withSeedTree(UNDECLARED_EXTENSION_TREE, (root) => {
      expect(() => buildPluginCatalog(root)).toThrow(
        IrregularDirectoryNameError
      );
    });
  });

  it("同じ公開サブパスが2つできたら落ちる", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      writeSeedFile(
        root,
        "src/json-schema/extensions/read-only-write-only/index.ts",
        "export const readOnlyWriteOnlyPlugin = {};\n"
      );
      writeSeedFile(
        root,
        "src/plugins/read-only-write-only/index.ts",
        "export const readOnlyWriteOnlyPlugin = {};\n"
      );
      expect(() => buildPluginCatalog(root)).toThrow(/is claimed by both/);
    });
  });
});
