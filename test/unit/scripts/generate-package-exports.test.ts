import { buildRepositoryExportMap } from "../../../scripts/catalog/build-repository-export-map";
import { readPublishedExportMap } from "../../../scripts/catalog/read-package-json";
import {
  generatePackageExports,
  renderPackageJsonWithExports,
} from "../../../scripts/generate-package-exports";
import {
  EMPTY_PLUGIN_TREE,
  SEED_PACKAGE_JSON,
  SEED_PLUGIN_TREE,
} from "../../type/fixtures/seed-plugins/seed-plugin-tree";
import {
  readSeedFile,
  withSeedTree,
  writeSeedFile,
} from "../../type/fixtures/seed-plugins/write-seed-tree";

const EXPORTS_KEY_TEXT = '"exports": ';
const PREFIX = SEED_PACKAGE_JSON.slice(
  0,
  SEED_PACKAGE_JSON.indexOf(EXPORTS_KEY_TEXT) + EXPORTS_KEY_TEXT.length
);
const SUFFIX = SEED_PACKAGE_JSON.slice(
  SEED_PACKAGE_JSON.indexOf(',\n  "sideEffects"')
);

describe("renderPackageJsonWithExports", () => {
  it("moves no byte of any field but exports", () => {
    const updated = renderPackageJsonWithExports(SEED_PACKAGE_JSON, {
      ".": "./dist/index.js",
    });
    expect(updated.startsWith(PREFIX)).toBe(true);
    expect(updated.endsWith(SUFFIX)).toBe(true);
    expect(updated).toContain('"version": "9.9.9-seed"');
    expect(updated).toContain(
      '"description": "seed fixture { with braces } and \\"quotes\\""'
    );
    expect(updated).toContain('"files": ["dist"]');
  });

  it("leaves the replaced JSON readable", () => {
    const updated = renderPackageJsonWithExports(SEED_PACKAGE_JSON, {
      "./plugins/uuid": {
        types: "./dist/plugins/uuid.d.ts",
        import: "./dist/plugins/uuid.mjs",
        require: "./dist/plugins/uuid.js",
      },
    });
    const parsed: unknown = JSON.parse(updated);
    expect(parsed).toMatchObject({
      name: "@maroonedog/luq",
      version: "9.9.9-seed",
      sideEffects: false,
    });
  });
});

describe("generatePackageExports", () => {
  it("writes the exports the catalog describes", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(generatePackageExports(root)).toBe(true);
      expect(readPublishedExportMap(root)).toEqual(
        buildRepositoryExportMap(root)
      );
    });
  });

  it("writes the nine fixed keys even with no plugins", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      generatePackageExports(root);
      expect(Object.keys(readPublishedExportMap(root))).toEqual([
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
  });

  it("reports no change on a second run, being idempotent", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(generatePackageExports(root)).toBe(true);
      const first = readSeedFile(root, "package.json");
      expect(generatePackageExports(root)).toBe(false);
      expect(readSeedFile(root, "package.json")).toBe(first);
    });
  });

  it("picks up an added plugin on the next generation", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      generatePackageExports(root);
      expect(
        readPublishedExportMap(root)["./plugins/required"]
      ).toBeUndefined();
      writeSeedFile(
        root,
        "src/plugins/required/index.ts",
        "export const requiredPlugin = {};\n"
      );
      expect(generatePackageExports(root)).toBe(true);
      expect(readPublishedExportMap(root)["./plugins/required"]).toEqual({
        types: "./dist/plugins/required.d.ts",
        import: "./dist/plugins/required.mjs",
        require: "./dist/plugins/required.js",
      });
    });
  });
});
