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

/** Takes the package.json generated from the seed tree. */
function recordGeneratedPackageJson(): string {
  return withSeedTree(SEED_PLUGIN_TREE, (root) => {
    generatePackageExports(root);
    return readSeedFile(root, "package.json");
  });
}

describe("parseExportCheckMode", () => {
  it("defaults to superset", () => {
    expect(parseExportCheckMode([])).toBe("superset");
  });

  it("accepts --mode=exact", () => {
    expect(parseExportCheckMode(["--mode=exact"])).toBe("exact");
    expect(parseExportCheckMode(["--mode=superset"])).toBe("superset");
  });

  it("fails on an unknown mode", () => {
    expect(() => parseExportCheckMode(["--mode=loose"])).toThrow(
      /must be superset or exact/
    );
  });
});

describe("findExportMismatches", () => {
  it("matches in both modes straight after generating", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      generatePackageExports(root);
      expect(findExportMismatches(root, "superset")).toEqual([]);
      expect(findExportMismatches(root, "exact")).toEqual([]);
    });
  });

  it("matches in both modes with no plugins at all", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      generatePackageExports(root);
      expect(findExportMismatches(root, "superset")).toEqual([]);
      expect(findExportMismatches(root, "exact")).toEqual([]);
    });
  });

  it("lets a plugin added on a branch pass superset and fail exact", () => {
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

  it("fails even superset when a published subpath is lost", () => {
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
        detail: "published but not generated from the catalog",
      });
      expect(findExportMismatches(root, "exact")).toHaveLength(1);
    });
  });

  it("fails when a published subpath starts pointing elsewhere", () => {
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

  it("checks a compatibility alias as part of the published surface", () => {
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
