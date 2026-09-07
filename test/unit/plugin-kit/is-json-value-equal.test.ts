// ===========================================================================
// test/unit/plugin-kit/is-json-value-equal.test.ts
//
// The two tests this file replaces lived beside two DIFFERENT copies of the
// same function (src/plugins/array-unique/deep-equal.ts and
// src/plugins/array-includes/same-value-zero.ts). One definition, one test.
// ===========================================================================
import {
  isJsonValueEqual,
  isSameValueZero,
} from "../../../src/plugin-kit/is-json-value-equal";

describe("isSameValueZero", () => {
  it("is the equality Set and Array.prototype.includes use", () => {
    expect(isSameValueZero(Number.NaN, Number.NaN)).toBe(true);
    expect(isSameValueZero(0, -0)).toBe(true);
    expect(isSameValueZero(1, "1")).toBe(false);
    expect(isSameValueZero("a", "a")).toBe(true);
    expect(isSameValueZero(null, undefined)).toBe(false);
    expect(isSameValueZero({}, {})).toBe(false);
  });
});

describe("isJsonValueEqual", () => {
  it("ignores key order", () => {
    expect(isJsonValueEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("counts keys, so an explicit undefined is not an absent key", () => {
    expect(isJsonValueEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(isJsonValueEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it("recurses through arrays and objects", () => {
    expect(isJsonValueEqual([{ a: [1] }], [{ a: [1] }])).toBe(true);
    expect(isJsonValueEqual([{ a: [1] }], [{ a: [2] }])).toBe(false);
  });

  it("never calls an array equal to an object", () => {
    expect(isJsonValueEqual([], {})).toBe(false);
    expect(isJsonValueEqual({ 0: 1, length: 1 }, [1])).toBe(false);
  });

  it("compares a non-plain object by identity", () => {
    expect(isJsonValueEqual(new Date(0), new Date(0))).toBe(false);
    expect(isJsonValueEqual(/a/, /a/)).toBe(false);
    expect(isJsonValueEqual(new Map(), new Map())).toBe(false);
  });

  it("treats a null-prototype record as plain", () => {
    const bare: Record<string, unknown> = Object.create(null);
    bare.a = 1;
    expect(isJsonValueEqual(bare, { a: 1 })).toBe(true);
  });

  // The distinctions the JSON Schema `enum`/`const` suite cases turn on.
  it("does not conflate booleans with numbers", () => {
    expect(isJsonValueEqual([false], [0])).toBe(false);
    expect(isJsonValueEqual([true], [1])).toBe(false);
    expect(isJsonValueEqual({ a: false }, { a: 0 })).toBe(false);
    expect(isJsonValueEqual({ a: true }, { a: 1 })).toBe(false);
  });

  it("treats 1.0 and 1 as the same JSON number", () => {
    expect(isJsonValueEqual([1.0], [1])).toBe(true);
    expect(isJsonValueEqual([0.0], [0])).toBe(true);
  });
});
