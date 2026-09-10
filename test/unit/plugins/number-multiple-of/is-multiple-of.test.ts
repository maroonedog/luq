import {
  countDecimalPlaces,
  isMultipleOf,
} from "../../../../src/plugins/number-multiple-of/is-multiple-of";

describe("countDecimalPlaces", () => {
  it("counts the decimal places of an ordinary literal", () => {
    expect(countDecimalPlaces(3)).toBe(0);
    expect(countDecimalPlaces(0.1)).toBe(1);
    expect(countDecimalPlaces(0.35)).toBe(2);
    expect(countDecimalPlaces(-2.125)).toBe(3);
  });

  it("reduces exponent notation to decimal places too", () => {
    expect(countDecimalPlaces(1e-7)).toBe(7);
    expect(countDecimalPlaces(1.5e-7)).toBe(8);
    expect(countDecimalPlaces(1e21)).toBe(0);
  });
});

describe("isMultipleOf", () => {
  // 0.3 % 0.1 is 0.09999999999999998, which is how 0.3 came to be rejected.
  it("judges 0.3 a multiple of 0.1, past the floating-point error", () => {
    expect(isMultipleOf(0.3, 0.1)).toBe(true);
    expect(isMultipleOf(0.7, 0.1)).toBe(true);
    expect(isMultipleOf(1.1, 0.1)).toBe(true);
  });

  // And does not absorb so much error that everything passes.
  it("rejects a decimal that is not a multiple", () => {
    expect(isMultipleOf(0.35, 0.1)).toBe(false);
    expect(isMultipleOf(0.05, 0.1)).toBe(false);
    expect(isMultipleOf(1.05, 0.1)).toBe(false);
  });

  it("judges two integers", () => {
    expect(isMultipleOf(10, 5)).toBe(true);
    expect(isMultipleOf(10, 3)).toBe(false);
    expect(isMultipleOf(0, 7)).toBe(true);
    expect(isMultipleOf(-0, 7)).toBe(true);
  });

  it("handles a negative value and a negative divisor", () => {
    expect(isMultipleOf(-0.3, 0.1)).toBe(true);
    expect(isMultipleOf(0.3, -0.1)).toBe(true);
    expect(isMultipleOf(-9, -3)).toBe(true);
    expect(isMultipleOf(-10, 3)).toBe(false);
  });

  it("handles decimals of different lengths, scaling by the longer", () => {
    expect(isMultipleOf(7.5, 2.5)).toBe(true);
    expect(isMultipleOf(1, 0.25)).toBe(true);
    expect(isMultipleOf(1.125, 0.125)).toBe(true);
    expect(isMultipleOf(1.2, 0.125)).toBe(false);
  });

  it("calls a non-finite value no multiple of anything", () => {
    expect(isMultipleOf(Number.POSITIVE_INFINITY, 2)).toBe(false);
    expect(isMultipleOf(Number.NaN, 2)).toBe(false);
  });

  it("does not break at a scale beyond the safe integer range", () => {
    expect(isMultipleOf(1e-8, 1e-8)).toBe(true);
    expect(isMultipleOf(3e-8, 1e-8)).toBe(true);
    expect(isMultipleOf(1e-20, 1e-20)).toBe(true);
    expect(isMultipleOf(1e20, 1e10)).toBe(true);
  });
});
