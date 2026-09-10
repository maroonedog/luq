import * as path from "path";
import {
  findUniquenessViolations,
  readPluginIdentities,
  type PluginIdentity,
} from "../../../scripts/check-plugin-uniqueness";
import { PLUGIN_MANIFEST } from "../../../src/plugins/manifest.generated";

const REPOSITORY_ROOT = path.join(__dirname, "..", "..", "..");

function identity(
  name: string,
  method: string,
  slots: readonly string[]
): PluginIdentity {
  return {
    symbol: `${name}Plugin`,
    directory: `src/plugins/${name}`,
    name,
    method,
    slots,
  };
}

describe("findUniquenessViolations", () => {
  it("reports nothing when there is no collision", () => {
    expect(
      findUniquenessViolations([
        identity("stringMin", "min", ["string"]),
        identity("numberMin", "min", ["number"]),
        identity("required", "required", ["string", "number"]),
      ])
    ).toEqual([]);
  });

  it("does not call the same method name on different slots a collision", () => {
    // .min() exists on both string and number. Calling that a collision
    // would leave no workable catalog.
    expect(
      findUniquenessViolations([
        identity("stringMin", "min", ["string"]),
        identity("numberMin", "min", ["number"]),
        identity("stringMax", "max", ["string"]),
        identity("numberMax", "max", ["number"]),
      ])
    ).toEqual([]);
  });

  it("catches a duplicated plugin name", () => {
    // Exactly the state of scaffolding left behind: one name in two places.
    const violations = findUniquenessViolations([
      identity("stringMin", "min", ["string"]),
      {
        ...identity("stringMin", "min", ["string"]),
        directory: "src/plugins/check-plugins",
      },
    ]);
    expect(violations.map((one) => one.kind)).toContain("duplicate-name");
    expect(violations[0]?.detail).toContain("stringMin");
    expect(violations[0]?.detail).toContain("src/plugins/check-plugins");
  });

  it("catches two plugins growing the same method on one slot", () => {
    const violations = findUniquenessViolations([
      identity("stringMin", "min", ["string"]),
      identity("stringMinimum", "min", ["string"]),
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.kind).toBe("duplicate-slot-method");
    expect(violations[0]?.detail).toContain("string.min");
  });

  it("catches an overlap on just one of several slots", () => {
    const violations = findUniquenessViolations([
      identity("arrayMinLength", "minLength", ["array", "tuple"]),
      identity("tupleMinLength", "minLength", ["tuple"]),
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.detail).toContain("tuple.minLength");
  });

  it("fails when there are two stitches", () => {
    // The state of three implementations of it coexisting.
    const violations = findUniquenessViolations([
      identity("stitch", "stitch", ["string"]),
      { ...identity("stitch", "stitch", ["string"]), symbol: "stitchTyped" },
      { ...identity("stitch", "stitch", ["string"]), symbol: "stitchSimple" },
    ]);
    expect(violations.map((one) => one.kind).sort()).toEqual([
      "duplicate-name",
      "duplicate-slot-method",
    ]);
  });
});

describe("readPluginIdentities against the real catalog", () => {
  const identities = readPluginIdentities(REPOSITORY_ROOT);

  it("reads as many real plugins as the manifest has symbols", () => {
    const symbolCount = PLUGIN_MANIFEST.reduce(
      (total, entry) => total + entry.exportedSymbols.length,
      0
    );
    expect(identities).toHaveLength(symbolCount);
  });

  it("finds no collision in the real catalog", () => {
    expect(findUniquenessViolations(identities)).toEqual([]);
  });

  it("finds exactly one stitch", () => {
    expect(identities.filter((one) => one.name === "stitch")).toHaveLength(1);
  });
});
