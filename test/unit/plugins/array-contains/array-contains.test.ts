import { Builder } from "../../../../src/index";
import { PluginArgumentError } from "../../../../src/plugin-kit/plugin-definition";
import { arrayContainsPlugin } from "../../../../src/plugins/array-contains";
import { probeAtLeastPlugin } from "../../../support/probe-plugins";

type Bag = { readonly scores: readonly number[] };

const builderWith = (bounds?: { min?: number; max?: number }) =>
  Builder()
    .use(arrayContainsPlugin)
    .use(probeAtLeastPlugin)
    .for<Bag>()
    .v("scores", (b) =>
      bounds === undefined
        ? b.array.contains((eb) => eb.number.atLeast(60))
        : b.array.contains((eb) => eb.number.atLeast(60), bounds)
    )
    .build();

describe("arrayContains", () => {
  const validator = builderWith();

  it("defaults to at least one matching element", () => {
    expect(validator.validate({ scores: [10, 70] }).valid).toBe(true);
    expect(validator.validate({ scores: [10, 20] }).valid).toBe(false);
    expect(validator.validate({ scores: [] }).valid).toBe(false);
  });

  it("reports its own code and how many matched", () => {
    const result = validator.validate({ scores: [10] });
    expect(result.issues.map((issue) => issue.code)).toEqual(["arrayContains"]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Array must contain at least 1 matching element(s), but got 0",
    ]);
  });

  it("counts matches against min", () => {
    const atLeastTwo = builderWith({ min: 2 });
    expect(atLeastTwo.validate({ scores: [70, 80] }).valid).toBe(true);
    expect(atLeastTwo.validate({ scores: [70, 10] }).valid).toBe(false);
  });

  it("counts matches against max", () => {
    const atMostTwo = builderWith({ min: 1, max: 2 });
    expect(atMostTwo.validate({ scores: [70, 80] }).valid).toBe(true);
    expect(atMostTwo.validate({ scores: [70, 80, 90] }).valid).toBe(false);
  });

  it("allows zero matches when min is 0", () => {
    expect(builderWith({ min: 0 }).validate({ scores: [1] }).valid).toBe(true);
  });

  // LEGACY BUG: arrayContains was the one array plugin that returned false for
  // a non-array, breaking the catalogue-wide pass-through rule.
  it("passes a non-array through like every other array plugin", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      validator.validate({ scores: "nope" }).issues.map((issue) => issue.code)
    ).toEqual(["arrayType"]);
    expect(validator.validate({}).valid).toBe(true);
  });

  it("exposes the matched count to a message factory", () => {
    const custom = Builder()
      .use(arrayContainsPlugin)
      .use(probeAtLeastPlugin)
      .for<Bag>()
      .v("scores", (b) =>
        b.array.contains(
          (eb) => eb.number.atLeast(60),
          { min: 2 },
          {
            messageFactory: (context) =>
              `${String(context.matched)}/${String(context.min)}`,
          }
        )
      )
      .build();
    expect(
      custom.validate({ scores: [70, 1] }).issues.map((issue) => issue.message)
    ).toEqual(["1/2"]);
  });

  // The tuple slot brings no type guard of its own, so whatever this plugin
  // answers for a non-array is the entire answer the caller gets.
  it("holds a non-array against nobody when no slot guards it", () => {
    const unguarded = Builder()
      .use(arrayContainsPlugin)
      .use(probeAtLeastPlugin)
      .for<Bag>()
      .v("scores", (b) => b.tuple.contains((eb) => eb.number.atLeast(60)))
      .build();
    const result = unguarded.validate({ scores: "nope" });
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("throws at BUILD time when max is below min", () => {
    expect(() => builderWith({ min: 3, max: 1 })).toThrow(PluginArgumentError);
  });

  it("throws at BUILD time on a min that is not a count", () => {
    expect(() => builderWith({ min: -1 })).toThrow(PluginArgumentError);
    expect(() => builderWith({ min: Number.NaN })).toThrow(PluginArgumentError);
  });
});
