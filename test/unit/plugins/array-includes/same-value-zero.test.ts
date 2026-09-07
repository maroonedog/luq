import { isSameValueZero } from "../../../../src/plugins/array-includes/same-value-zero";

describe("isSameValueZero", () => {
  it("matches what Array.prototype.includes does", () => {
    expect(isSameValueZero(Number.NaN, Number.NaN)).toBe(true);
    expect(isSameValueZero(0, -0)).toBe(true);
    expect(isSameValueZero("a", "a")).toBe(true);
    expect(isSameValueZero(null, undefined)).toBe(false);
    expect(isSameValueZero({}, {})).toBe(false);
  });
});
