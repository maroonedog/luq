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
  it("answers an empty catalog when there are no plugins", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      expect(buildPluginCatalog(root).entries).toEqual([]);
    });
  });

  it("does not fail when src is missing entirely", () => {
    withSeedTree({ "package.json": "{}\n" }, (root) => {
      expect(buildPluginCatalog(root).entries).toEqual([]);
    });
  });

  it("gathers plugins from both scan roots and orders them by subpath name", () => {
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

  it("records only the symbols an entry actually exports", () => {
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

  it("does not treat anything outside the extensions directory as a plugin", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      const directories = buildPluginCatalog(root).entries.map(
        (entry) => entry.directory
      );
      expect(directories).not.toContain("src/json-schema");
      expect(directories).not.toContain("src/json-schema/keyword-map");
      expect(directories).toContain("src/json-schema/extensions/json-schema");
    });
  });

  it("does not treat the subpath aliases as a plugin directory", () => {
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

  it("fails on a directory with no index.ts", () => {
    withSeedTree(MISSING_ENTRY_TREE, (root) => {
      expect(() => buildPluginCatalog(root)).toThrow(PluginCatalogError);
      expect(() => buildPluginCatalog(root)).toThrow(/no index\.ts/);
    });
  });

  it("fails on an entry exporting no Plugin symbol", () => {
    withSeedTree(NO_PLUGIN_SYMBOL_TREE, (root) => {
      expect(() => buildPluginCatalog(root)).toThrow(PluginCatalogError);
    });
  });

  it("fails on an invalid directory name", () => {
    withSeedTree(IRREGULAR_DIRECTORY_TREE, (root) => {
      expect(() => buildPluginCatalog(root)).toThrow(
        IrregularDirectoryNameError
      );
    });
  });

  it("fails on an extension directory missing from the override table", () => {
    withSeedTree(UNDECLARED_EXTENSION_TREE, (root) => {
      expect(() => buildPluginCatalog(root)).toThrow(
        IrregularDirectoryNameError
      );
    });
  });

  it("fails when two directories claim one published subpath", () => {
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
