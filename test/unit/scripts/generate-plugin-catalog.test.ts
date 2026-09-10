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
  it("builds a lock for no plugins, so the count gate is live from the start", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      const lock = buildPluginCatalogLock(root);
      expect(lock.pluginCount).toBe(0);
      expect(lock.plugins).toEqual([]);
      expect(lock.exportKeys).toHaveLength(10);
    });
  });

  it("derives the count from the catalog and writes it nowhere", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      const lock = buildPluginCatalogLock(root);
      expect(lock.pluginCount).toBe(lock.plugins.length);
      expect(lock.pluginCount).toBe(5);
    });
  });

  it("records the subpath, the directory and the tier", () => {
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

  it("includes the compatibility aliases among the export keys", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      const lock = buildPluginCatalogLock(root);
      expect(lock.exportKeys).toContain("./plugins/readOnlyWriteOnly");
      expect(lock.exportKeys).toHaveLength(10 + lock.pluginCount + 1);
    });
  });
});

describe("generatePluginCatalogLock", () => {
  it("writes JSON with a trailing newline", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(generatePluginCatalogLock(root)).toBe(true);
      expect(
        readSeedFile(root, PLUGIN_CATALOG_LOCK_OUTPUT).endsWith("\n")
      ).toBe(true);
      expect(readLock(root).pluginCount).toBe(5);
    });
  });

  it("reports no change on a second run", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(generatePluginCatalogLock(root)).toBe(true);
      expect(generatePluginCatalogLock(root)).toBe(false);
    });
  });

  it("moves the count when a plugin is added", () => {
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
