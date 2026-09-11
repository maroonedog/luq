import { Builder } from "../../../../src/index";
import { arrayEachPlugin } from "../../../../src/plugins/array-each";
import { probeAtLeastPlugin } from "../../../support/probe-plugins";

type Bag = { readonly scores: readonly number[] };
type Grid = { readonly grid: readonly (readonly number[])[] };

const validator = Builder()
  .use(arrayEachPlugin)
  .use(probeAtLeastPlugin)
  .for<Bag>()
  .v("scores", (b) => b.array.each((eb) => eb.number.atLeast(0)))
  .build();

// The tuple slot brings no type guard of its own, so whatever this plugin
// answers for a non-array is the entire answer the caller gets.
const unguarded = Builder()
  .use(arrayEachPlugin)
  .use(probeAtLeastPlugin)
  .for<Bag>()
  .v("scores", (b) => b.tuple.each((eb) => eb.number.atLeast(0)))
  .build();

describe("arrayEach", () => {
  it("applies the element chain to every element", () => {
    expect(validator.validate({ scores: [0, 1, 2] }).valid).toBe(true);
    expect(validator.validate({ scores: [0, -1] }).valid).toBe(false);
  });

  it("never runs the element chain on an empty array", () => {
    expect(validator.validate({ scores: [] }).valid).toBe(true);
  });

  it("passes a non-array through", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      validator.validate({ scores: 3 }).issues.map((issue) => issue.code)
    ).toEqual(["arrayType"]);
  });

  it("holds a non-array against nobody when no slot guards it", () => {
    const result = unguarded.validate({ scores: "ab" });
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("names the index of the element that failed", () => {
    const result = validator.validate({ scores: [0, 1, -1] });
    expect(result.issues.map((issue) => issue.code)).toEqual(["arrayEach"]);
    expect(result.issues.map((issue) => issue.path)).toEqual(["scores"]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Element 2 failed",
    ]);
  });

  it("reports the first element that failed, and only that one", () => {
    expect(
      validator
        .validate({ scores: [-1, -2] })
        .issues.map((issue) => issue.message)
    ).toEqual(["Element 0 failed"]);
  });

  it("nests: the inner each peels the second dimension", () => {
    const nested = Builder()
      .use(arrayEachPlugin)
      .use(probeAtLeastPlugin)
      .for<Grid>()
      .v("grid", (b) =>
        b.array.each((row) => row.array.each((cell) => cell.number.atLeast(0)))
      )
      .build();
    expect(nested.validate({ grid: [[1, 2], [3]] }).valid).toBe(true);
    expect(nested.validate({ grid: [[1, 2], [-3]] }).valid).toBe(false);
  });
});
