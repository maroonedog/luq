import { readExportedPluginSymbols } from "../../../../scripts/catalog/read-exported-plugin-symbols";

describe("readExportedPluginSymbols", () => {
  it("export const の Plugin シンボルを拾う", () => {
    expect(
      readExportedPluginSymbols("export const stringMinPlugin = {};\n")
    ).toEqual(["stringMinPlugin"]);
  });

  it("再 export の Plugin シンボルを拾う", () => {
    expect(
      readExportedPluginSymbols(
        'export { readOnlyPlugin, writeOnlyPlugin } from "./read-only";\n'
      )
    ).toEqual(["readOnlyPlugin", "writeOnlyPlugin"]);
  });

  it("Plugin で終わらない export は拾わない", () => {
    const source = [
      "export const RECURSIVE_SELF = 1;",
      "export type PluginOptions = { a: 1 };",
      "export const objectRecursivelyPlugin = {};",
      "const notExported = 1;",
      "void notExported;",
    ].join("\n");
    expect(readExportedPluginSymbols(source)).toEqual([
      "objectRecursivelyPlugin",
    ]);
  });

  it("export の付いていない宣言は拾わない", () => {
    expect(readExportedPluginSymbols("const hiddenPlugin = {};\n")).toEqual([]);
  });

  it("export * from は名前を与えないので何も拾わない", () => {
    expect(
      readExportedPluginSymbols('export * from "./string-min";\n')
    ).toEqual([]);
  });

  it("結果は決定的に並ぶ", () => {
    const source = [
      "export const zzzPlugin = {};",
      "export const aaaPlugin = {};",
    ].join("\n");
    expect(readExportedPluginSymbols(source)).toEqual([
      "aaaPlugin",
      "zzzPlugin",
    ]);
  });
});
