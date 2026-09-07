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
    expect(validator.validate({ tags: 7 }).valid).toBe(true);
  });

  it("throws at BUILD time on a bound that is not a count", () => {
    expect(() =>
      Builder()
        .use(arrayMaxLengthPlugin)
        .for<Bag>()
        .v("tags", (b) => b.array.maxLength(Number.POSITIVE_INFINITY))
        .build()
    ).toThrow(PluginArgumentError);
  });
});
