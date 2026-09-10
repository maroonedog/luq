import { PLUGIN_CATALOG_LOCK_OUTPUT } from "../../../scripts/catalog/plugin-source-roots";
import { findCatalogLockMismatches } from "../../../scripts/check-catalog-lock";
import { generatePluginCatalogLock } from "../../../scripts/generate-plugin-catalog";
import {
  EMPTY_PLUGIN_TREE,
  omitSeedPaths,
  SEED_PLUGIN_TREE,
} from "../../type/fixtures/seed-plugins/seed-plugin-tree";
import {
  readSeedFile,
  withSeedTree,
  writeSeedFile,
} from "../../type/fixtures/seed-plugins/write-seed-tree";

/** Builds the lock from the seed tree first and takes only its text. */
function recordSeedLock(): string {
  return withSeedTree(SEED_PLUGIN_TREE, (root) => {
    generatePluginCatalogLock(root);
    return readSeedFile(root, PLUGIN_CATALOG_LOCK_OUTPUT);
  });
}

describe("findCatalogLockMismatches", () => {
  it("matches straight after generating", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      generatePluginCatalogLock(root);
      expect(findCatalogLockMismatches(root)).toEqual([]);
    });
  });

  it("matches for a lock covering no plugins at all", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      generatePluginCatalogLock(root);
      expect(findCatalogLockMismatches(root)).toEqual([]);
    });
  });

  it("fails when the lock is missing", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      const mismatches = findCatalogLockMismatches(root);
      expect(mismatches).toHaveLength(1);
      expect(mismatches[0]?.kind).toBe("absent");
    });
  });

  it("fails when the lock's shape is broken", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      writeSeedFile(root, PLUGIN_CATALOG_LOCK_OUTPUT, '{ "pluginCount": 5 }\n');
      expect(findCatalogLockMismatches(root)[0]?.kind).toBe("absent");
    });
  });

  it("disagrees on both the count and the list when a plugin is added", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      generatePluginCatalogLock(root);
      writeSeedFile(
        root,
        "src/plugins/required/index.ts",
        "export const requiredPlugin = {};\n"
      );
      const kinds = findCatalogLockMismatches(root).map(
        (mismatch) => mismatch.kind
      );
      expect(kinds).toContain("count");
      expect(kinds).toContain("plugins");
      expect(kinds).toContain("export-keys");
    });
  });

  it("fails when a published plugin disappears", () => {
    const lockText = recordSeedLock();
    const withoutUuid = {
      ...omitSeedPaths(SEED_PLUGIN_TREE, "src/plugins/uuid/"),
      [PLUGIN_CATALOG_LOCK_OUTPUT]: lockText,
    };
    withSeedTree(withoutUuid, (root) => {
      const kinds = findCatalogLockMismatches(root).map(
        (mismatch) => mismatch.kind
      );
      expect(kinds).toContain("count");
      expect(kinds).toContain("plugins");
    });
  });

  it("fails when the directories are swapped, count unchanged", () => {
    const lockText = recordSeedLock();
    const swapped = {
      ...omitSeedPaths(SEED_PLUGIN_TREE, "src/plugins/uuid/"),
      "src/plugins/literal/index.ts": "export const literalPlugin = {};\n",
      [PLUGIN_CATALOG_LOCK_OUTPUT]: lockText,
    };
    withSeedTree(swapped, (root) => {
      const kinds = findCatalogLockMismatches(root).map(
        (mismatch) => mismatch.kind
      );
      expect(kinds).not.toContain("count");
      expect(kinds).toContain("plugins");
      expect(kinds).toContain("export-keys");
    });
  });

  it("fails when the lock is edited by hand", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      generatePluginCatalogLock(root);
      const tampered = readSeedFile(root, PLUGIN_CATALOG_LOCK_OUTPUT).replace(
        '"pluginCount": 5',
        '"pluginCount": 71'
      );
      writeSeedFile(root, PLUGIN_CATALOG_LOCK_OUTPUT, tampered);
      expect(findCatalogLockMismatches(root)[0]?.kind).toBe("count");
    });
  });
});
