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
  it("固定キーは6件で、この順に出る", () => {
    expect(FIXED_EXPORT_KEYS).toEqual([
      ".",
      "./package.json",
      "./result",
      "./plugin-kit",
      "./async",
      "./plugins",
    ]);
  });

  it("カタログが空なら固定キー6件だけ", () => {
    const exportMap = buildPackageExportMap({ entries: [] }, []);
    expect(Object.keys(exportMap)).toEqual([...FIXED_EXPORT_KEYS]);
  });

  it("./package.json だけは条件オブジェクトではなく直接指す", () => {
    const exportMap = buildPackageExportMap({ entries: [] }, []);
    expect(exportMap["./package.json"]).toBe("./package.json");
    expect(exportMap["."]).toEqual(toDistConditions("index"));
    expect(exportMap["./plugins"]).toEqual(toDistConditions("plugins/index"));
  });

  it("プラグインごとに ./plugins/<camel> を1件ずつ足す", () => {
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
  it("互換エイリアスは転送先モジュールが実在するときだけ公開される", () => {
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

  it("エイリアスはプラグイン群の後ろに並ぶ", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      const keys = Object.keys(buildRepositoryExportMap(root));
      expect(keys[keys.length - 1]).toBe("./plugins/readOnlyWriteOnly");
    });
  });
});
