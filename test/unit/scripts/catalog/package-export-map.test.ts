import { buildPluginCatalog } from "../../../../scripts/catalog/build-plugin-catalog";
import { buildRepositoryExportMap } from "../../../../scripts/catalog/build-repository-export-map";
import {
  buildPackageExportMap,
  toDistConditions,
} from "../../../../scripts/catalog/package-export-map";
import { FIXED_EXPORT_KEYS } from "../../../../scripts/catalog/plugin-source-roots";
import {
  EMPTY_PLUGIN_TREE,
  SEED_PLUGIN_TREE,
} from "../../../type/fixtures/seed-plugins/seed-plugin-tree";
import { withSeedTree } from "../../../type/fixtures/seed-plugins/write-seed-tree";

describe("buildPackageExportMap", () => {
  it("emits the nine fixed keys, in this order", () => {
    expect(FIXED_EXPORT_KEYS).toEqual([
      ".",
      "./package.json",
      "./result",
      "./plugin-kit",
      "./field-rule",
      "./async",
      "./standard-schema",
      "./presets",
      "./plugins",
    ]);
  });

  it("emits the fixed keys alone for an empty catalog", () => {
    const exportMap = buildPackageExportMap({ entries: [] }, []);
    expect(Object.keys(exportMap)).toEqual([...FIXED_EXPORT_KEYS]);
  });

  it("points ./package.json straight at the file rather than at a conditions object", () => {
    const exportMap = buildPackageExportMap({ entries: [] }, []);
    expect(exportMap["./package.json"]).toBe("./package.json");
    expect(exportMap["."]).toEqual(toDistConditions("index"));
    expect(exportMap["./plugins"]).toEqual(toDistConditions("plugins/index"));
  });

  it("adds one ./plugins/<camel> per plugin", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      const exportMap = buildPackageExportMap(buildPluginCatalog(root), []);
      expect(Object.keys(exportMap)).toEqual([
        ...FIXED_EXPORT_KEYS,
        "./plugins/jsonSchema",
        "./plugins/jsonSchemaFullFeature",
        "./plugins/readOnly",
        "./plugins/stringMin",
        "./plugins/uuid",
      ]);
      expect(exportMap["./plugins/uuid"]).toEqual(
        toDistConditions("plugins/uuid")
      );
    });
  });
});

describe("buildRepositoryExportMap", () => {
  it("publishes a compatibility alias only when its target module exists", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(Object.keys(buildRepositoryExportMap(root))).toContain(
        "./plugins/readOnlyWriteOnly"
      );
    });
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      const keys = Object.keys(buildRepositoryExportMap(root));
      expect(keys).toEqual([...FIXED_EXPORT_KEYS]);
      expect(keys).not.toContain("./plugins/readOnlyWriteOnly");
    });
  });

  it("places the aliases after the plugins", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      const keys = Object.keys(buildRepositoryExportMap(root));
      expect(keys[keys.length - 1]).toBe("./plugins/readOnlyWriteOnly");
    });
  });
});
