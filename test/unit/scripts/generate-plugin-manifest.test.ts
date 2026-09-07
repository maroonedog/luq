import * as fs from "fs";
import * as path from "path";
import { buildPluginCatalog } from "../../../scripts/catalog/build-plugin-catalog";
import { PLUGIN_MANIFEST_OUTPUT } from "../../../scripts/catalog/plugin-source-roots";
import {
  generatePluginManifest,
  renderPluginManifest,
} from "../../../scripts/generate-plugin-manifest";
import {
  EMPTY_PLUGIN_TREE,
  SEED_PLUGIN_TREE,
} from "../../type/fixtures/seed-plugins/seed-plugin-tree";
import {
  withSeedTree,
  writeSeedFile,
} from "../../type/fixtures/seed-plugins/write-seed-tree";

function readManifest(root: string): string {
  return fs.readFileSync(path.join(root, PLUGIN_MANIFEST_OUTPUT), "utf8");
}

describe("renderPluginManifest", () => {
  it("プラグイン0件でも合法な TypeScript を出す", () => {
    const rendered = renderPluginManifest({ entries: [] });
    expect(rendered).toContain(
      "export const PLUGIN_MANIFEST: readonly PluginManifestEntry[] = [];"
    );
    expect(rendered.endsWith("\n")).toBe(true);
  });

  it("1エントリ1行なので71件でも200行に収まる", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      const catalog = buildPluginCatalog(root);
      const inflated = {
        entries: Array.from({ length: 71 }, (_unused, index) => ({
          ...catalog.entries[0],
          directoryName: `plugin-${index}`,
          subpathName: `plugin${index}`,
          directory: `src/plugins/plugin-${index}`,
          entryFile: `src/plugins/plugin-${index}/index.ts`,
          tier: "isolated" as const,
          exportedSymbols: [`plugin${index}Plugin`],
        })),
      };
      expect(renderPluginManifest(inflated).split("\n").length).toBeLessThan(
        200
      );
    });
  });
});

describe("generatePluginManifest", () => {
  it("プラグイン本体を import しない (L7 から上への import を作らない)", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      generatePluginManifest(root);
      const manifest = readManifest(root);
      expect(manifest).not.toContain("import ");
      expect(manifest).not.toContain(" from ");
    });
  });

  it("全プラグインを段つきで記録する", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      generatePluginManifest(root);
      const manifest = readManifest(root);
      expect(manifest).toContain('subpathName: "stringMin"');
      expect(manifest).toContain('exportedSymbols: ["stringMinPlugin"]');
      expect(manifest).toContain('subpathName: "jsonSchema"');
      expect(manifest).toContain('tier: "extension"');
      expect(manifest).toContain(
        'entryFile: "src/json-schema/extensions/json-schema/index.ts"'
      );
    });
  });

  it("空のカタログでも生成できる", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      expect(generatePluginManifest(root)).toBe(true);
      expect(readManifest(root)).toContain("PLUGIN_MANIFEST");
    });
  });

  it("内容が同じなら書き直さない", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(generatePluginManifest(root)).toBe(true);
      expect(generatePluginManifest(root)).toBe(false);
    });
  });

  it("プラグインが増えたら次の生成で自動的に拾う", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      generatePluginManifest(root);
      expect(readManifest(root)).not.toContain("required");
      writeSeedFile(
        root,
        "src/plugins/required/index.ts",
        "export const requiredPlugin = {};\n"
      );
      expect(generatePluginManifest(root)).toBe(true);
      expect(readManifest(root)).toContain('subpathName: "required"');
    });
  });
});
