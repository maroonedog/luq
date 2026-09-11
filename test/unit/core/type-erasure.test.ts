import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  eraseAssembledRecord,
  eraseChainSurface,
  eraseSchemaValidator,
} from "../../../src/core/type-erasure";

const SOURCE_ROOT = path.join(__dirname, "..", "..", "..", "src");
const ERASURE_FILE = path.join("src", "core", "type-erasure.ts");

// A line that escapes the type system. `as const` and a mapped-type key
// remapping (`[K in keyof B as ...]`) are neither, and comment lines are text.
const SUPPRESSION =
  /@ts-(ignore|expect-error|nocheck)|eslint-disable|\bas\s+(unknown|any)\b|\bas\s+[A-Z]/;

function collectSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

function suppressionLines(file: string): string[] {
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return false;
      if (trimmed.includes(" in keyof ")) return false;
      return SUPPRESSION.test(trimmed);
    });
}

describe("the type-erasure boundary", () => {
  it("is the ONLY file in src/ that escapes the type system", () => {
    const offenders = collectSourceFiles(SOURCE_ROOT)
      .filter((file) => suppressionLines(file).length > 0)
      .map((file) => path.relative(path.join(SOURCE_ROOT, ".."), file));
    expect(offenders).toEqual([ERASURE_FILE]);
  });

  it("recognises a suppression when one is planted elsewhere", () => {
    // The detector above is worth nothing if it cannot see a violation, so
    // prove it on a file whose content we control. That copy lives in a scratch
    // directory and NEVER inside src/: rewriting a real source file races every
    // other jest worker compiling it, which made this suite fail intermittently
    // with "Test suite failed to run" and a TS6133 on the planted line.
    const clean = fs.readFileSync(
      path.join(SOURCE_ROOT, "chain", "create-chain-node.ts"),
      "utf8"
    );
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "luq-erasure-"));
    const planted = path.join(scratch, "create-chain-node.ts");
    try {
      fs.writeFileSync(planted, clean, "utf8");
      expect(suppressionLines(planted)).toHaveLength(0);
      fs.writeFileSync(
        planted,
        `const smuggled = {} as unknown as string;\n${clean}`,
        "utf8"
      );
      expect(suppressionLines(planted)).toHaveLength(1);
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });

  it("returns the very object it was handed", () => {
    const assembled = { alpha: 1 };
    expect(eraseChainSurface<{ alpha: number }>(assembled)).toBe(assembled);
    expect(eraseAssembledRecord<{ alpha: number }>(assembled)).toBe(assembled);
    expect(eraseSchemaValidator<{ alpha: number }>(assembled)).toBe(assembled);
  });

  it("names every escape hatch that exists, so a sixth cannot slip in", () => {
    // fromJsonSchema<T> used to put its declared type back on through an
    // OVERLOAD PAIR, which TypeScript accepts on lenient compatibility rules
    // and which no reviewer of this file would ever have seen. It is a call to
    // eraseSchemaValidator now; this list is what keeps the audit complete.
    //
    // eraseRuleDefineToBuilderSlots is the fifth, and it is listed here because
    // adding one is meant to be a decision rather than a side effect: useField
    // runs a rule's callback against the builder's slots, and the relation that
    // makes this safe — the builder carrying at least the rule's plugins — is
    // stated between two type parameters, where the value side cannot carry it.
    const source = fs.readFileSync(
      path.join(SOURCE_ROOT, "core", "type-erasure.ts"),
      "utf8"
    );
    const exported = [...source.matchAll(/export function (\w+)/g)].map(
      (match) => match[1]
    );
    expect(exported).toEqual([
      "eraseAssembledRecord",
      "eraseChainSurface",
      "eraseBuilderSurface",
      "eraseSchemaValidator",
      "eraseRuleDefineToBuilderSlots",
    ]);
  });
});
