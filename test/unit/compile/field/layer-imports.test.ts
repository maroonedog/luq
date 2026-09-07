// ===========================================================================
// The layer direction, checked by reading the source.
//
// The design is ten layers with a one-way import direction. L4 (compile) may
// read L0-L3; it may NOT read L5 and above, because a compile step that could
// call the runtime would be a second traversal hiding inside build(). The port
// in branch-executor.port.ts exists precisely so that inversion stays an
// interface and never becomes an import.
//
// dependency-cruiser is not a dependency of this repository, so the check is
// written directly against the import specifiers.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";

const SOURCE_ROOT = path.join(__dirname, "..", "..", "..", "..", "src");
const IMPORT_SPECIFIER = /from\s+"([^"]+)"/g;

function readSpecifiers(directory: string): ReadonlyMap<string, string[]> {
  const byFile = new Map<string, string[]>();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() || !entry.name.endsWith(".ts")) continue;
    const source = fs.readFileSync(path.join(directory, entry.name), "utf8");
    const specifiers = [...source.matchAll(IMPORT_SPECIFIER)].map(
      (match) => match[1] ?? ""
    );
    byFile.set(entry.name, specifiers);
  }
  return byFile;
}

const compileImports = readSpecifiers(path.join(SOURCE_ROOT, "compile"));
const chainImports = readSpecifiers(path.join(SOURCE_ROOT, "chain"));

const FORBIDDEN_FOR_COMPILE: readonly string[] = [
  "../runtime",
  "../builder",
  "../plugins",
  "../async",
  "../json-schema",
  "../field-rule",
];

describe("the compile layer reads downward only", () => {
  it("found the compile sources at all", () => {
    expect(compileImports.size).toBeGreaterThanOrEqual(6);
    expect([...compileImports.keys()]).toContain("compile-field.ts");
  });

  it("imports nothing from L5 or above", () => {
    for (const [file, specifiers] of compileImports) {
      for (const specifier of specifiers) {
        const upward = FORBIDDEN_FOR_COMPILE.find((prefix) =>
          specifier.startsWith(prefix)
        );
        expect(`${file} -> ${String(upward)}`).toBe(`${file} -> undefined`);
      }
    }
  });

  it("only reaches for types, path, plugin-kit or its own directory", () => {
    const allowed = /^(\.\/|\.\.\/types|\.\.\/path\/|\.\.\/plugin-kit\/)/;
    for (const [file, specifiers] of compileImports) {
      for (const specifier of specifiers) {
        expect(`${file}: ${specifier}`).toMatch(
          new RegExp(
            `^${file}: (\\./|\\.\\./types|\\.\\./path/|\\.\\./plugin-kit/)`
          )
        );
        expect(allowed.test(specifier)).toBe(true);
      }
    }
  });
});

describe("the chain layer never imports compile", () => {
  it("found the chain sources at all", () => {
    expect(chainImports.size).toBeGreaterThanOrEqual(10);
  });

  it("has no specifier pointing at ../compile", () => {
    for (const [file, specifiers] of chainImports) {
      for (const specifier of specifiers) {
        expect(`${file}: ${specifier}`).not.toMatch(/\.\.\/compile/);
      }
    }
  });
});
