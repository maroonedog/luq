import {
  findExportMismatches,
  parseExportCheckMode,
} from "../../../scripts/check-exports";
import { generatePackageExports } from "../../../scripts/generate-package-exports";
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

/** SEED ツリーどおりに生成した package.json を持ち出す。 */
function recordGeneratedPackageJson(): string {
  return withSeedTree(SEED_PLUGIN_TREE, (root) => {
    generatePackageExports(root);
    return readSeedFile(root, "package.json");
  });
}

describe("parseExportCheckMode", () => {
  it("既定は superset", () => {
    expect(parseExportCheckMode([])).toBe("superset");
  });

  it("--mode=exact を受ける", () => {
    expect(parseExportCheckMode(["--mode=exact"])).toBe("exact");
    expect(parseExportCheckMode(["--mode=superset"])).toBe("superset");
  });

  it("知らないモードは落ちる", () => {
    expect(() => parseExportCheckMode(["--mode=loose"])).toThrow(
      /superset か exact/
    );
  });
});

describe("findExportMismatches", () => {
  it("生成直後は両モードとも一致する", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      generatePackageExports(root);
      expect(findExportMismatches(root, "superset")).toEqual([]);
      expect(findExportMismatches(root, "exact")).toEqual([]);
    });
  });

  it("プラグイン0件でも両モードとも一致する", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      generatePackageExports(root);
      expect(findExportMismatches(root, "superset")).toEqual([]);
      expect(findExportMismatches(root, "exact")).toEqual([]);
    });
  });

  it("ブランチ上で足したプラグインは superset を通り exact で落ちる", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      generatePackageExports(root);
      writeSeedFile(
        root,
        "src/plugins/required/index.ts",
        "export const requiredPlugin = {};\n"
      );
      expect(findExportMismatches(root, "superset")).toEqual([]);
      const exact = findExportMismatches(root, "exact");
      expect(exact).toHaveLength(1);
      expect(exact[0]?.kind).toBe("unpublished");
      expect(exact[0]?.subpath).toBe("./plugins/required");
    });
  });

  it("公開済みサブパスが失われたら superset でも落ちる", () => {
    const packageJsonText = recordGeneratedPackageJson();
    const withoutUuid = {
      ...omitSeedPaths(SEED_PLUGIN_TREE, "src/plugins/uuid/"),
      "package.json": packageJsonText,
    };
    withSeedTree(withoutUuid, (root) => {
      const superset = findExportMismatches(root, "superset");
      expect(superset).toHaveLength(1);
      expect(superset[0]).toEqual({
        kind: "missing",
        subpath: "./plugins/uuid",
        detail: "公開済みなのにカタログから生成されません",
      });
      expect(findExportMismatches(root, "exact")).toHaveLength(1);
    });
  });

  it("公開済みサブパスの指し先が変わったら落ちる", () => {
    const tampered = recordGeneratedPackageJson().replace(
      '"./dist/plugins/uuid.mjs"',
      '"./dist/plugins/uuid.esm.js"'
    );
    withSeedTree({ ...SEED_PLUGIN_TREE, "package.json": tampered }, (root) => {
      const superset = findExportMismatches(root, "superset");
      expect(superset).toHaveLength(1);
      expect(superset[0]?.kind).toBe("different");
      expect(superset[0]?.subpath).toBe("./plugins/uuid");
    });
  });

  it("互換エイリアスも公開面として検査される", () => {
    const packageJsonText = recordGeneratedPackageJson();
    const withoutAlias = {
      ...omitSeedPaths(SEED_PLUGIN_TREE, "src/subpath-aliases/"),
      "package.json": packageJsonText,
    };
    withSeedTree(withoutAlias, (root) => {
      expect(
        findExportMismatches(root, "superset").map(
          (mismatch) => mismatch.subpath
        )
      ).toEqual(["./plugins/readOnlyWriteOnly"]);
    });
  });
});
