import {
  isDeepEqual,
  isSameValueZero,
} from "../../../../src/plugins/array-unique/deep-equal";

describe("isSameValueZero", () => {
  it("calls NaN equal to itself and +0 equal to -0", () => {
    expect(isSameValueZero(Number.NaN, Number.NaN)).toBe(true);
    expect(isSameValueZero(0, -0)).toBe(true);
    expect(isSameValueZero(1, "1")).toBe(false);
  });
});

describe("isDeepEqual", () => {
  it("ignores key order", () => {
    expect(isDeepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("requires the same key set", () => {
    expect(isDeepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(isDeepEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it("recurses through arrays and objects", () => {
    expect(isDeepEqual([{ a: [1] }], [{ a: [1] }])).toBe(true);
    expect(isDeepEqual([{ a: [1] }], [{ a: [2] }])).toBe(false);
  });

  it("keeps arrays and objects distinct", () => {
    expect(isDeepEqual([], {})).toBe(false);
    expect(isDeepEqual({ 0: 1, length: 1 }, [1])).toBe(false);
  });

  it("compares a Date, a RegExp and a class instance by identity", () => {
    expect(isDeepEqual(new Date(0), new Date(0))).toBe(false);
    expect(isDeepEqual(/a/, /a/)).toBe(false);
    expect(isDeepEqual(new Map(), new Map())).toBe(false);
  });

  it("handles a null prototype object structurally", () => {
    const bare: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    bare.a = 1;
    expect(isDeepEqual(bare, { a: 1 })).toBe(true);
  });
});
