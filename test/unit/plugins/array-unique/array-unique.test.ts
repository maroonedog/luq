import { Builder } from "../../../../src/index";
import { arrayUniquePlugin } from "../../../../src/plugins/array-unique";

type Bag = { readonly rows: readonly unknown[] };

const validator = Builder()
  .use(arrayUniquePlugin)
  .for<Bag>()
  .v("rows", (b) => b.array.unique())
  .build();

const isValid = (rows: readonly unknown[]): boolean =>
  validator.validate({ rows }).valid;

describe("arrayUnique", () => {
  it("accepts distinct primitives and rejects repeats", () => {
    expect(isValid(["a", "b", "c"])).toBe(true);
    expect(isValid([1, 2, 1])).toBe(false);
    expect(isValid([])).toBe(true);
  });

  it("reports the plugin's own code and the legacy message", () => {
    const result = validator.validate({ rows: ["a", "a"] });
    expect(result.issues.map((issue) => issue.code)).toEqual(["arrayUnique"]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Array must contain unique values",
    ]);
  });

  // LEGACY BUG: JSON.stringify keyed on key ORDER, so these two objects were
  // called distinct. They are the same value.
  it("treats objects with the same entries in a different order as equal", () => {
    expect(
      isValid([
        { a: 1, b: 2 },
        { b: 2, a: 1 },
      ])
    ).toBe(false);
    expect(
      isValid([
        { a: 1, b: 2 },
        { a: 1, b: 3 },
      ])
    ).toBe(true);
  });

  it("compares nested structures deeply", () => {
    expect(isValid([{ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }])).toBe(false);
    expect(isValid([{ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] }])).toBe(true);
    expect(
      isValid([
        [1, 2],
        [1, 2],
      ])
    ).toBe(false);
    expect(
      isValid([
        [1, 2],
        [2, 1],
      ])
    ).toBe(true);
  });

  // LEGACY BUG: the answer changed at length 11, where a `===` double loop was
  // swapped for a Set. One definition now, at every length.
  it("gives the same answer for NaN whatever the array length", () => {
    expect(isValid([Number.NaN, Number.NaN])).toBe(false);
    const long = [Number.NaN, ...Array.from({ length: 20 }, (_, i) => i)];
    expect(isValid(long)).toBe(true);
    expect(isValid([...long, Number.NaN])).toBe(false);
  });

  it("treats 0 and -0 as the same value, as SameValueZero says", () => {
    expect(isValid([0, -0])).toBe(false);
  });

  it("does not confuse a number with the string that prints the same", () => {
    expect(isValid([1, "1"])).toBe(true);
    expect(isValid([null, "null"])).toBe(true);
    expect(isValid([undefined, null])).toBe(true);
  });

  it("compares non-plain objects by identity", () => {
    const date = new Date(0);
    expect(isValid([date, date])).toBe(false);
    expect(isValid([new Date(0), new Date(0)])).toBe(true);
  });

  it("passes a non-array through", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      validator.validate({ rows: "abc" }).issues.map((issue) => issue.code)
    ).toEqual(["arrayType"]);
  });

  // The tuple slot brings no type guard of its own, so whatever this plugin
  // answers for a non-array is the entire answer the caller gets.
  it("holds a non-array against nobody when no slot guards it", () => {
    const unguarded = Builder()
      .use(arrayUniquePlugin)
      .for<Bag>()
      .v("rows", (b) => b.tuple.unique())
      .build();
    const result = unguarded.validate({ rows: "aab" });
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });
});
