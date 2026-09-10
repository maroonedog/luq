import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
import { PLUGIN_BARREL_OUTPUT } from "../../../scripts/catalog/plugin-source-roots";
import { readExportedPluginSymbols } from "../../../scripts/catalog/read-exported-plugin-symbols";
import { readImportSpecifiers } from "../../../scripts/catalog/read-import-specifiers";
import {
  generatePluginBarrel,
  renderPluginBarrel,
} from "../../../scripts/generate-plugin-barrel";
import {
  EMPTY_PLUGIN_TREE,
  SEED_PLUGIN_TREE,
} from "../../type/fixtures/seed-plugins/seed-plugin-tree";
import {
  withSeedTree,
  writeSeedFile,
} from "../../type/fixtures/seed-plugins/write-seed-tree";

function readBarrel(root: string): string {
  return fs.readFileSync(path.join(root, PLUGIN_BARREL_OUTPUT), "utf8");
}

function countSyntaxErrors(sourceText: string): number {
  const transpiled = ts.transpileModule(sourceText, {
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  });
  return (transpiled.diagnostics ?? []).length;
}

describe("generatePluginBarrel", () => {
  it("emits a valid module for no plugins at all", () => {
    const rendered = renderPluginBarrel({ entries: [] });
    expect(rendered).toContain("export {};");
    expect(countSyntaxErrors(rendered)).toBe(0);
  });

  it("re-exports every plugin from one place", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      generatePluginBarrel(root);
      const barrel = readBarrel(root);
      expect(countSyntaxErrors(barrel)).toBe(0);
      expect(readExportedPluginSymbols(barrel)).toEqual([
        "jsonSchemaFullFeaturePlugin",
        "jsonSchemaPlugin",
        "readOnlyPlugin",
        "stringMinPlugin",
        "uuidPlugin",
      ]);
    });
  });

  it("points every re-export at a plugin directory and nowhere else", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      generatePluginBarrel(root);
      expect([...readImportSpecifiers(readBarrel(root))].sort()).toEqual([
        "../json-schema/extensions/json-schema",
        "../json-schema/extensions/json-schema-full-feature",
        "./read-only",
        "./string-min",
        "./uuid",
      ]);
    });
  });

  it("keeps the barrel's export count equal to the published subpath count", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      generatePluginBarrel(root);
      expect(readImportSpecifiers(readBarrel(root))).toHaveLength(5);
    });
  });

  it("writes no name an entry does not actually export", () => {
    withSeedTree(EMPTY_PLUGIN_TREE, (root) => {
      writeSeedFile(
        root,
        "src/plugins/two-symbols/index.ts",
        [
          "export const twoSymbolsPlugin = {};",
          "export const twoSymbolsExtraPlugin = {};",
          "export const notAPluginSymbol = {};",
          "",
        ].join("\n")
      );
      generatePluginBarrel(root);
      const barrel = readBarrel(root);
      expect(barrel).toContain("export { twoSymbolsPlugin }");
      expect(barrel).toContain("export { twoSymbolsExtraPlugin }");
      expect(barrel).not.toContain("notAPluginSymbol");
    });
  });

  it("does not rewrite when the content is unchanged", () => {
    withSeedTree(SEED_PLUGIN_TREE, (root) => {
      expect(generatePluginBarrel(root)).toBe(true);
      expect(generatePluginBarrel(root)).toBe(false);
    });
  });
});
