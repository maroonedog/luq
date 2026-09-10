import { findSizeViolations } from "../../../scripts/measure-bundle-size";
import type {
  BundleMeasurement,
  SizeBudget,
} from "../../../scripts/bundle-size/size-budget.types";

// 判定は純関数なので、実ツリーを束ねずに種データだけで検査できる。
// esbuild を回す経路は npm run check:size がリポジトリ全体に対して回す。

const budget: SizeBudget = {
  budgets: [
    {
      id: "core-only",
      description: "中核のみ",
      plugins: [],
      gzipCeilingBytes: 8000,
      recordedGzipBytes: 7420,
    },
    {
      id: "one-plugin",
      description: "中核 + 1",
      plugins: ["required"],
      gzipCeilingBytes: 8250,
      recordedGzipBytes: 7638,
    },
    {
      id: "full-feature",
      description: "全部入り",
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
  it("実測が全て天井の内側なら違反なし", () => {
    expect(findSizeViolations(budget, cleanMeasurements)).toEqual([]);
  });

  it("天井を1バイト超えたら over-budget を出す", () => {
    const violations = findSizeViolations(budget, [
      measure("core-only", 0, 8001),
      measure("one-plugin", 1, 8100),
      measure("full-feature", 76, 24040),
    ]);
    expect(violations.map((one) => one.kind)).toContain("over-budget");
    expect(violations[0]?.detail).toContain("is 1 B over the 8000 B ceiling");
  });

  it("プラグイン1個の増分が下限を割ったら weak-increment を出す", () => {
    const violations = findSizeViolations(budget, [
      measure("core-only", 0, 7420),
      measure("one-plugin", 1, 7429),
      measure("full-feature", 76, 24040),
    ]);
    expect(violations.map((one) => one.kind)).toEqual(["weak-increment"]);
    expect(violations[0]?.detail).toContain("gzip grew only 9 B");
  });

  it("増分の下限は足したプラグイン数に比例する", () => {
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

  it("中核が全部入りの大半を占めたら core-share を出す", () => {
    const violations = findSizeViolations(budget, [
      measure("core-only", 0, 7420),
      measure("one-plugin", 1, 7638),
      measure("full-feature", 76, 7900),
    ]);
    expect(violations.map((one) => one.kind)).toContain("core-share");
  });

  it("知らない id を指した予算は例外で落ちる", () => {
    expect(() =>
      findSizeViolations(budget, [measure("core-only", 0, 7420)])
    ).toThrow(/one-plugin/);
  });
});
