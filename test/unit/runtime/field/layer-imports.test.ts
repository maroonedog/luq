// ===========================================================================
// L5 reads downward only, and it does not read plugin code at all.
//
// The runtime is the ONE engine. If it could import plugin-kit or a plugin,
// "one engine" would stop being provable: a rule could be re-classified at
// validation time, and a plugin could be reached without going through the
// compiled plan. The rule is checked against the import specifiers, because
// dependency-cruiser is not a dependency of this repository.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";

const SOURCE_ROOT = path.join(__dirname, "..", "..", "..", "..", "src");
const IMPORT_SPECIFIER = /from\s+"([^"]+)"/g;

/** Prose quoting `from "…"` is not an import; only real code is scanned. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function readSpecifiers(directory: string): ReadonlyMap<string, string[]> {
  const byFile = new Map<string, string[]>();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() || !entry.name.endsWith(".ts")) continue;
    const code = withoutComments(
      fs.readFileSync(path.join(directory, entry.name), "utf8")
    );
    byFile.set(
      entry.name,
      [...code.matchAll(IMPORT_SPECIFIER)].map((match) => match[1] ?? "")
    );
  }
  return byFile;
}

const runtimeImports = readSpecifiers(path.join(SOURCE_ROOT, "runtime"));

const FORBIDDEN_FOR_RUNTIME: readonly string[] = [
  "../plugin-kit",
  "../plugins",
  "../builder",
  "../async",
  "../json-schema",
  "../field-rule",
  "../chain",
];

describe("the runtime layer", () => {
  it("found the runtime sources at all", () => {
    expect(runtimeImports.size).toBeGreaterThanOrEqual(4);
    expect([...runtimeImports.keys()]).toContain("run-field.ts");
  });

  it("imports nothing from plugin-kit, plugins or any layer above it", () => {
    for (const [file, specifiers] of runtimeImports) {
      for (const specifier of specifiers) {
        const upward = FORBIDDEN_FOR_RUNTIME.find((prefix) =>
          specifier.startsWith(prefix)
        );
        expect(`${file} -> ${String(upward)}`).toBe(`${file} -> undefined`);
      }
    }
  });

  it("only reaches for types, path, compile or its own directory", () => {
    const allowed = /^(\.\/|\.\.\/types|\.\.\/path\/|\.\.\/compile\/)/;
    for (const [file, specifiers] of runtimeImports) {
      for (const specifier of specifiers) {
        expect(`${file}: ${specifier}`).toMatch(
          new RegExp(
            `^${file}: (\\./|\\.\\./types|\\.\\./path/|\\.\\./compile/)`
          )
        );
        expect(allowed.test(specifier)).toBe(true);
      }
    }
  });

  it("uses neither eval nor new Function", () => {
    for (const file of runtimeImports.keys()) {
      const source = fs.readFileSync(
        path.join(SOURCE_ROOT, "runtime", file),
        "utf8"
      );
      expect(source).not.toMatch(/new Function\s*\(/);
      expect(source).not.toMatch(/\beval\s*\(/);
    }
  });
});
