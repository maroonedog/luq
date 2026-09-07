import { readImportSpecifiers } from "../../../../scripts/catalog/read-import-specifiers";

describe("readImportSpecifiers", () => {
  it("static import / default / namespace を拾う", () => {
    const source = [
      'import { a } from "./a";',
      'import b from "./b";',
      'import * as c from "./c";',
      'import "./d";',
    ].join("\n");
    expect(readImportSpecifiers(source)).toEqual(["./a", "./b", "./c", "./d"]);
  });

  it("import type も1件として数える (型 import も隔離の対象)", () => {
    const source = [
      'import type { A } from "./a";',
      'import { type B } from "./b";',
    ].join("\n");
    expect(readImportSpecifiers(source)).toEqual(["./a", "./b"]);
  });

  it("export ... from を拾い、from の無い export は拾わない", () => {
    const source = [
      'export { a } from "./a";',
      'export * from "./b";',
      'export * as c from "./c";',
      "const d = 1;",
      "export { d };",
    ].join("\n");
    expect(readImportSpecifiers(source)).toEqual(["./a", "./b", "./c"]);
  });

  it("dynamic import と require を拾う", () => {
    const source = [
      'const a = await import("./a");',
      'const b = require("./b");',
      'import c = require("./c");',
    ].join("\n");
    expect(readImportSpecifiers(source)).toEqual(["./a", "./b", "./c"]);
  });

  it("関数の中に隠された import も拾う", () => {
    const source = [
      "export function load() {",
      '  return import("../../runtime/run-plan");',
      "}",
    ].join("\n");
    expect(readImportSpecifiers(source)).toEqual(["../../runtime/run-plan"]);
  });

  it("文字列リテラルは import でなければ拾わない", () => {
    expect(readImportSpecifiers('const name = "./not-an-import";')).toEqual([]);
  });
});
