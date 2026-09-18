import {
  inheritValidatorOrigin,
  readValidatorOrigin,
} from "../../../src/core/validator-origin";

describe("validator origins", () => {
  it("retains original identity through nested decorators without mutating objects", () => {
    const original = Object.freeze({});
    const first = Object.freeze({});
    const second = Object.freeze({});
    expect(readValidatorOrigin(original)).toBe(original);
    expect(inheritValidatorOrigin(original, first)).toBe(first);
    expect(inheritValidatorOrigin(first, second)).toBe(second);
    expect(readValidatorOrigin(first)).toBe(original);
    expect(readValidatorOrigin(second)).toBe(original);
    const unrelated = {};
    expect(readValidatorOrigin(unrelated)).toBe(unrelated);
    expect(Object.keys(first)).toEqual([]);
    expect(Object.keys(second)).toEqual([]);
  });
});
