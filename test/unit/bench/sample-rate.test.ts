// The harness's statistics are the sort of thing that keeps producing numbers
// when broken, so nobody notices. The rate estimate is the median of the
// FASTER HALF — neither the median nor the fastest — and the spread is the
// full range over the reported value, not a confidence interval. Both are easy
// to misread, so the intent is pinned by running it.
import {
  estimateRate,
  median,
  relativeSpreadPercent,
} from "../../../bench/sample-rate";

describe("median", () => {
  it("takes the middle value for an odd count", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("takes the mean of the middle two for an even count", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("answers 0 for nothing", () => {
    expect(median([])).toBe(0);
  });
});

describe("estimateRate", () => {
  it("takes the seventh smallest of nine, the median of the faster half", () => {
    const rates = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(estimateRate(rates)).toBe(7);
  });

  it("does not depend on the order", () => {
    expect(estimateRate([9, 1, 8, 2, 7, 3, 6, 4, 5])).toBe(7);
  });

  it("is unmoved by an outlier on the slow side, interference going one way only", () => {
    const clean = [100, 101, 102, 103, 104, 105, 106, 107, 108];
    const disturbed = [1, 101, 102, 103, 104, 105, 106, 107, 108];
    expect(estimateRate(disturbed)).toBe(estimateRate(clean));
  });

  it("is unmoved by the two fastest, only the middle of the faster half counting", () => {
    const clean = [100, 101, 102, 103, 104, 105, 106, 107, 108];
    const spiked = [100, 101, 102, 103, 104, 105, 106, 900, 901];
    expect(estimateRate(spiked)).toBe(estimateRate(clean));
  });

  it("moves when the middle of the faster half moves", () => {
    const clean = [100, 101, 102, 103, 104, 105, 106, 107, 108];
    const shifted = [100, 101, 102, 103, 104, 105, 200, 201, 202];
    expect(estimateRate(shifted)).toBe(200);
    expect(estimateRate(clean)).toBe(106);
  });
});

describe("relativeSpreadPercent", () => {
  it("is (max - min) over the reported value as a percentage, not a standard deviation", () => {
    expect(relativeSpreadPercent([90, 100, 110], 100)).toBeCloseTo(20, 10);
  });

  it("answers 0 for a reported value of 0, creating no division by zero", () => {
    expect(relativeSpreadPercent([1, 2], 0)).toBe(0);
  });

  it("answers 0 when there are no samples", () => {
    expect(relativeSpreadPercent([], 100)).toBe(0);
  });
});
