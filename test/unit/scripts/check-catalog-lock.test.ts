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

/** 先に SEED ツリーでロックを作り、その本文だけを持ち出す。 */
function recordSeedLock(): string {
  return withSeedTree(SEED_PLUGIN_TREE, (root) => {
    generatePluginCatalogLock(root);
    return readSeedFile(root, PLUGIN_CATALOG_LOCK_OUTPUT);
  });
}

describe("findCatalogLockMismatches", () => {
  it("生成直後のロックは一致する", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      generatePluginCatalogLock(root);
      expect(findCatalogLockMismatches(root)).toEqual([]);
    });
  });

  it("プラグイン0件のロックでも一致する", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      generatePluginCatalogLock(root);
      expect(findCatalogLockMismatches(root)).toEqual([]);
    });
  });

  it("ロックが無ければ落ちる", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      const mismatches = findCatalogLockMismatches(root);
      expect(mismatches).toHaveLength(1);
      expect(mismatches[0]?.kind).toBe("absent");
    });
  });

  it("ロックの形が壊れていれば落ちる", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      writeSeedFile(root, PLUGIN_CATALOG_LOCK_OUTPUT, '{ "pluginCount": 5 }\n');
      expect(findCatalogLockMismatches(root)[0]?.kind).toBe("absent");
    });
  });

  it("プラグインが増えたら数とリストの両方が不一致になる", () => {
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

  it("公開済みプラグインが消えたら落ちる", () => {
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

  it("数が同じでもディレクトリが入れ替われば落ちる", () => {
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

  it("ロックを手で書き換えたら落ちる", () => {
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
