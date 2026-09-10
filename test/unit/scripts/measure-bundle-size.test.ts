import { findSizeViolations } from "../../../scripts/measure-bundle-size";
import type {
  BundleMeasurement,
  SizeBudget,
} from "../../../scripts/bundle-size/size-budget.types";

// The judgement is a pure function, so it can be checked with seed data
// without bundling a real tree. The path that actually runs esbuild is
// exercised by npm run check:size over the whole repository.

const budget: SizeBudget = {
  budgets: [
    {
      id: "core-only",
      description: "the core alone",
      plugins: [],
      gzipCeilingBytes: 8000,
      recordedGzipBytes: 7420,
    },
    {
      id: "one-plugin",
      description: "the core plus one",
      plugins: ["required"],
      gzipCeilingBytes: 8250,
      recordedGzipBytes: 7638,
    },
    {
      id: "full-feature",
      description: "everything",
      plugins: "all",
      gzipCeilingBytes: 25600,
      recordedGzipBytes: 24040,
    },
  ],
  treeShaking: {
    orderedByPluginCount: ["core-only", "one-plugin", "full-feature"],
    minGzipBytesPerAddedPlugin: 50,
    maxCoreShareOfFullPercent: 35,
  },
  barrelEquivalence: { plugins: ["required"], maxDivergencePercent: 5 },
};

function measure(
  id: string,
  pluginCount: number,
  gzipBytes: number
): BundleMeasurement {
  return { id, pluginCount, rawBytes: gzipBytes * 3, gzipBytes };
}

const cleanMeasurements: readonly BundleMeasurement[] = [
  measure("core-only", 0, 7420),
  measure("one-plugin", 1, 7638),
  measure("full-feature", 76, 24040),
];

describe("findSizeViolations", () => {
  it("reports nothing when every measurement is inside its ceiling", () => {
    expect(findSizeViolations(budget, cleanMeasurements)).toEqual([]);
  });

  it("reports over-budget when a ceiling is exceeded by one byte", () => {
    const violations = findSizeViolations(budget, [
      measure("core-only", 0, 8001),
      measure("one-plugin", 1, 8100),
      measure("full-feature", 76, 24040),
    ]);
    expect(violations.map((one) => one.kind)).toContain("over-budget");
    expect(violations[0]?.detail).toContain("is 1 B over the 8000 B ceiling");
  });

  it("reports weak-increment when one plugin adds less than its floor", () => {
    const violations = findSizeViolations(budget, [
      measure("core-only", 0, 7420),
      measure("one-plugin", 1, 7429),
      measure("full-feature", 76, 24040),
    ]);
    expect(violations.map((one) => one.kind)).toEqual(["weak-increment"]);
    expect(violations[0]?.detail).toContain("gzip grew only 9 B");
  });

  it("scales the increment floor with the number of plugins added", () => {
    const barelyEnough = findSizeViolations(budget, [
      measure("core-only", 0, 7420),
      measure("one-plugin", 1, 7470),
      measure("full-feature", 76, 24040),
    ]);
    expect(barelyEnough).toEqual([]);
    const notEnoughForSeventyFive = findSizeViolations(budget, [
      measure("core-only", 0, 7420),
      measure("one-plugin", 1, 7470),
      measure("full-feature", 76, 11000),
    ]);
    expect(notEnoughForSeventyFive.map((one) => one.kind)).toContain(
      "weak-increment"
    );
  });

  it("reports core-share when the core dominates the everything build", () => {
    const violations = findSizeViolations(budget, [
      measure("core-only", 0, 7420),
      measure("one-plugin", 1, 7638),
      measure("full-feature", 76, 7900),
    ]);
    expect(violations.map((one) => one.kind)).toContain("core-share");
  });

  it("throws on a budget naming an unknown id", () => {
    expect(() =>
      findSizeViolations(budget, [measure("core-only", 0, 7420)])
    ).toThrow(/one-plugin/);
  });
});
