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
  it("emits valid TypeScript for no plugins at all", () => {
    const rendered = renderPluginManifest({ entries: [] });
    expect(rendered).toContain(
      "export const PLUGIN_MANIFEST: readonly PluginManifestEntry[] = [];"
    );
    expect(rendered.endsWith("\n")).toBe(true);
  });

  it("stays inside the line limit, being one line per entry", () => {
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
  it("imports no plugin, creating no import running outward", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      generatePluginManifest(root);
      const manifest = readManifest(root);
      expect(manifest).not.toContain("import ");
      expect(manifest).not.toContain(" from ");
    });
  });

  it("records every plugin with its tier", () => {
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

  it("generates from an empty catalog", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      expect(generatePluginManifest(root)).toBe(true);
      expect(readManifest(root)).toContain("PLUGIN_MANIFEST");
    });
  });

  it("does not rewrite when the content is unchanged", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(generatePluginManifest(root)).toBe(true);
      expect(generatePluginManifest(root)).toBe(false);
    });
  });

  it("picks up an added plugin on the next generation", () => {
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
