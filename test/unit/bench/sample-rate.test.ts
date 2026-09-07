// ハーネスの統計は、壊れても数字が出るだけで誰も気づかない場所である。
// estimateRate は「速い方の半分の中央値」であって中央値でも最速値でもなく、
// relativeSpreadPercent は信頼区間ではなく全域の幅を報告値で割ったものである。
// どちらも読み違えやすいので、意図を実測で固定する。
import {
  estimateRate,
  median,
  relativeSpreadPercent,
} from "../../../bench/sample-rate";

describe("median", () => {
  it("奇数個なら中央の値", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("偶数個なら中央2つの平均", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("空なら 0", () => {
    expect(median([])).toBe(0);
  });
});

describe("estimateRate", () => {
  it("9サンプルなら小さい方から7番目を返す (速い方の半分の中央値)", () => {
    const rates = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(estimateRate(rates)).toBe(7);
  });

  it("順序に依らない", () => {
    expect(estimateRate([9, 1, 8, 2, 7, 3, 6, 4, 5])).toBe(7);
  });

  it("遅い側の外れ値は結果を動かさない — 干渉は一方向にしか効かないため", () => {
    const clean = [100, 101, 102, 103, 104, 105, 106, 107, 108];
    const disturbed = [1, 101, 102, 103, 104, 105, 106, 107, 108];
    expect(estimateRate(disturbed)).toBe(estimateRate(clean));
  });

  it("最速の2本も結果を動かさない — 9本のうち効くのは5〜7番目だけ", () => {
    const clean = [100, 101, 102, 103, 104, 105, 106, 107, 108];
    const spiked = [100, 101, 102, 103, 104, 105, 106, 900, 901];
    expect(estimateRate(spiked)).toBe(estimateRate(clean));
  });

  it("速い方の半分の真ん中が動けば結果も動く", () => {
    const clean = [100, 101, 102, 103, 104, 105, 106, 107, 108];
    const shifted = [100, 101, 102, 103, 104, 105, 200, 201, 202];
    expect(estimateRate(shifted)).toBe(200);
    expect(estimateRate(clean)).toBe(106);
  });
});

describe("relativeSpreadPercent", () => {
  it("(max - min) を報告値で割った百分率であって、標準偏差ではない", () => {
    expect(relativeSpreadPercent([90, 100, 110], 100)).toBeCloseTo(20, 10);
  });

  it("報告値が 0 なら 0 を返す (ゼロ除算を作らない)", () => {
    expect(relativeSpreadPercent([1, 2], 0)).toBe(0);
  });

  it("サンプルが無ければ 0 を返す", () => {
    expect(relativeSpreadPercent([], 100)).toBe(0);
  });
});
