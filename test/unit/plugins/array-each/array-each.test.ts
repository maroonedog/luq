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

describe("arrayEach", () => {
  it("applies the element chain to every element", () => {
    expect(validator.validate({ scores: [0, 1, 2] }).valid).toBe(true);
    expect(validator.validate({ scores: [0, -1] }).valid).toBe(false);
  });

  it("never runs the element chain on an empty array", () => {
    expect(validator.validate({ scores: [] }).valid).toBe(true);
  });

  it("passes a non-array through", () => {
    expect(validator.validate({ scores: 3 }).valid).toBe(true);
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
