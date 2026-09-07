import * as fs from "fs";
import * as path from "path";
import {
  eraseAssembledRecord,
  eraseChainSurface,
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
    // prove it on a file whose content we control.
    const planted = path.join(SOURCE_ROOT, "chain", "create-chain-node.ts");
    const original = fs.readFileSync(planted, "utf8");
    try {
      fs.writeFileSync(
        planted,
        `const smuggled = {} as unknown as string;\n${original}`,
        "utf8"
      );
      expect(suppressionLines(planted)).toHaveLength(1);
    } finally {
      fs.writeFileSync(planted, original, "utf8");
    }
    expect(suppressionLines(planted)).toHaveLength(0);
  });

  it("returns the very object it was handed", () => {
    const assembled = { alpha: 1 };
    expect(eraseChainSurface<{ alpha: number }>(assembled)).toBe(assembled);
    expect(eraseAssembledRecord<{ alpha: number }>(assembled)).toBe(assembled);
  });
});
