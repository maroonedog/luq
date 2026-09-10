import { readExportedPluginSymbols } from "../../../../scripts/catalog/read-exported-plugin-symbols";

describe("readExportedPluginSymbols", () => {
  it("collects a Plugin symbol from an export const", () => {
    expect(
      readExportedPluginSymbols("export const stringMinPlugin = {};\n")
    ).toEqual(["stringMinPlugin"]);
  });

  it("collects a Plugin symbol from a re-export", () => {
    expect(
      readExportedPluginSymbols(
        'export { readOnlyPlugin, writeOnlyPlugin } from "./read-only";\n'
      )
    ).toEqual(["readOnlyPlugin", "writeOnlyPlugin"]);
  });

  it("collects no export whose name does not end in Plugin", () => {
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

  it("collects no declaration that is not exported", () => {
    expect(readExportedPluginSymbols("const hiddenPlugin = {};\n")).toEqual([]);
  });

  it("collects nothing from export * from, which names nothing", () => {
    expect(
      readExportedPluginSymbols('export * from "./string-min";\n')
    ).toEqual([]);
  });

  it("orders the result deterministically", () => {
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
