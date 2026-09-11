import { Builder } from "../../../../src/index";
import { PluginArgumentError } from "../../../../src/plugin-kit/plugin-definition";
import { arrayMaxLengthPlugin } from "../../../../src/plugins/array-max-length";

type Bag = { readonly tags: readonly string[] };

const validator = Builder()
  .use(arrayMaxLengthPlugin)
  .for<Bag>()
  .v("tags", (b) => b.array.maxLength(2))
  .build();

describe("arrayMaxLength", () => {
  it("accepts an array at the bound and below it", () => {
    expect(validator.validate({ tags: ["a", "b"] }).valid).toBe(true);
    expect(validator.validate({ tags: [] }).valid).toBe(true);
  });

  it("rejects a longer array with the legacy message", () => {
    const result = validator.validate({ tags: ["a", "b", "c"] });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "arrayMaxLength",
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Array must have at most 2 elements, but got 3",
    ]);
  });

  it("passes a non-array through", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      validator.validate({ tags: 7 }).issues.map((issue) => issue.code)
    ).toEqual(["arrayType"]);
  });

  it("throws at BUILD time on a bound that is not a count", () => {
    const build = (max: number): unknown =>
      Builder()
        .use(arrayMaxLengthPlugin)
        .for<Bag>()
        .v("tags", (b) => b.array.maxLength(max))
        .build();
    expect(() => build(Number.POSITIVE_INFINITY)).toThrow(PluginArgumentError);
    expect(() => build(-1)).toThrow(PluginArgumentError);
    expect(() => build(Number.NaN)).toThrow(PluginArgumentError);
  });
});
