import { readImportSpecifiers } from "../../../../scripts/catalog/read-import-specifiers";

describe("readImportSpecifiers", () => {
  it("collects static, default and namespace imports", () => {
    const source = [
      'import { a } from "./a";',
      'import b from "./b";',
      'import * as c from "./c";',
      'import "./d";',
    ].join("\n");
    expect(readImportSpecifiers(source)).toEqual(["./a", "./b", "./c", "./d"]);
  });

  it("counts a type import too, isolation applying to types as well", () => {
    const source = [
      'import type { A } from "./a";',
      'import { type B } from "./b";',
    ].join("\n");
    expect(readImportSpecifiers(source)).toEqual(["./a", "./b"]);
  });

  it("collects export ... from and not an export without a from", () => {
    const source = [
      'export { a } from "./a";',
      'export * from "./b";',
      'export * as c from "./c";',
      "const d = 1;",
      "export { d };",
    ].join("\n");
    expect(readImportSpecifiers(source)).toEqual(["./a", "./b", "./c"]);
  });

  it("collects dynamic imports and requires", () => {
    const source = [
      'const a = await import("./a");',
      'const b = require("./b");',
      'import c = require("./c");',
    ].join("\n");
    expect(readImportSpecifiers(source)).toEqual(["./a", "./b", "./c"]);
  });

  it("collects an import hidden inside a function", () => {
    const source = [
      "export function load() {",
      '  return import("../../runtime/run-plan");',
      "}",
    ].join("\n");
    expect(readImportSpecifiers(source)).toEqual(["../../runtime/run-plan"]);
  });

  it("collects a string literal only when it is an import", () => {
    expect(readImportSpecifiers('const name = "./not-an-import";')).toEqual([]);
  });
});
