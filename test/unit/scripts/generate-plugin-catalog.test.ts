import { PLUGIN_CATALOG_LOCK_OUTPUT } from "../../../scripts/catalog/plugin-source-roots";
import type { PluginCatalogLock } from "../../../scripts/catalog/plugin-catalog.types";
import {
  buildPluginCatalogLock,
  generatePluginCatalogLock,
} from "../../../scripts/generate-plugin-catalog";
import {
  EMPTY_PLUGIN_TREE,
  SEED_PLUGIN_TREE,
} from "../../type/fixtures/seed-plugins/seed-plugin-tree";
import {
  readSeedFile,
  withSeedTree,
  writeSeedFile,
} from "../../type/fixtures/seed-plugins/write-seed-tree";

function readLock(root: string): PluginCatalogLock {
  return JSON.parse(
    readSeedFile(root, PLUGIN_CATALOG_LOCK_OUTPUT)
  ) as PluginCatalogLock;
}

describe("buildPluginCatalogLock", () => {
  it("プラグイン0件のロックが作れる (数のゲートが最初から生きる)", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      const lock = buildPluginCatalogLock(root);
      expect(lock.pluginCount).toBe(0);
      expect(lock.plugins).toEqual([]);
      expect(lock.exportKeys).toHaveLength(7);
    });
  });

  it("数はカタログから導出され、どこにも書かれていない", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      const lock = buildPluginCatalogLock(root);
      expect(lock.pluginCount).toBe(lock.plugins.length);
      expect(lock.pluginCount).toBe(5);
    });
  });

  it("サブパス / ディレクトリ / 段を記録する", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(buildPluginCatalogLock(root).plugins).toContainEqual({
        subpath: "./plugins/jsonSchema",
        directory: "src/json-schema/extensions/json-schema",
        tier: "extension",
      });
      expect(buildPluginCatalogLock(root).plugins).toContainEqual({
        subpath: "./plugins/uuid",
        directory: "src/plugins/uuid",
        tier: "isolated",
      });
    });
  });

  it("export キーには互換エイリアスも含まれる", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      const lock = buildPluginCatalogLock(root);
      expect(lock.exportKeys).toContain("./plugins/readOnlyWriteOnly");
      expect(lock.exportKeys).toHaveLength(7 + lock.pluginCount + 1);
    });
  });
});

describe("generatePluginCatalogLock", () => {
  it("末尾改行つきの JSON を書く", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(generatePluginCatalogLock(root)).toBe(true);
      expect(
        readSeedFile(root, PLUGIN_CATALOG_LOCK_OUTPUT).endsWith("\n")
      ).toBe(true);
      expect(readLock(root).pluginCount).toBe(5);
    });
  });

  it("2回目は変更なしになる", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(generatePluginCatalogLock(root)).toBe(true);
      expect(generatePluginCatalogLock(root)).toBe(false);
    });
  });

  it("プラグインが増えたら数が動く", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      generatePluginCatalogLock(root);
      writeSeedFile(
        root,
        "src/plugins/required/index.ts",
        "export const requiredPlugin = {};\n"
      );
      expect(generatePluginCatalogLock(root)).toBe(true);
      expect(readLock(root).pluginCount).toBe(6);
    });
  });
});
