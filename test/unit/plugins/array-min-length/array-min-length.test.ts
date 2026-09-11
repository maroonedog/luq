// Runs the plugin: every expectation below is the result of an actual
// validate() call, never of a type that happened to compile.
import { Builder } from "../../../../src/index";
import { PluginArgumentError } from "../../../../src/plugin-kit/plugin-definition";
import { arrayMinLengthPlugin } from "../../../../src/plugins/array-min-length";

type Bag = { readonly tags: readonly string[] };

const validator = Builder()
  .use(arrayMinLengthPlugin)
  .for<Bag>()
  .v("tags", (b) => b.array.minLength(2))
  .build();

describe("arrayMinLength", () => {
  it("accepts an array at the bound and above it", () => {
    expect(validator.validate({ tags: ["a", "b"] }).valid).toBe(true);
    expect(validator.validate({ tags: ["a", "b", "c"] }).valid).toBe(true);
  });

  it("rejects a shorter array under the plugin's own code", () => {
    const result = validator.validate({ tags: ["a"] });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "arrayMinLength",
    ]);
    expect(result.issues.map((issue) => issue.path)).toEqual(["tags"]);
  });

  it("carries the legacy default message", () => {
    const result = validator.validate({ tags: [] });
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Array must have at least 2 elements, but got 0",
    ]);
  });

  it("passes a non-array through: the type slot owns type errors", () => {
    // The plugin itself objects to nothing; the slot reports the type.
    expect(
      validator
        .validate({ tags: "not an array" })
        .issues.map((issue) => issue.code)
    ).toEqual(["arrayType"]);
    expect(validator.validate({}).valid).toBe(true);
  });

  it("honours options.code and options.messageFactory", () => {
    const custom = Builder()
      .use(arrayMinLengthPlugin)
      .for<Bag>()
      .v("tags", (b) =>
        b.array.minLength(2, {
          code: "TOO_FEW",
          messageFactory: (context) =>
            `${context.path}: ${String(context.actual)} < ${String(context.min)}`,
        })
      )
      .build();
    const result = custom.validate({ tags: ["a"] });
    expect(result.issues.map((issue) => issue.code)).toEqual(["TOO_FEW"]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "tags: 1 < 2",
    ]);
  });

  it("throws at BUILD time on a bound that is not a count", () => {
    const build = (min: number): unknown =>
      Builder()
        .use(arrayMinLengthPlugin)
        .for<Bag>()
        .v("tags", (b) => b.array.minLength(min))
        .build();
    expect(() => build(-1)).toThrow(PluginArgumentError);
    expect(() => build(Number.NaN)).toThrow(PluginArgumentError);
    expect(() => build(Number.POSITIVE_INFINITY)).toThrow(PluginArgumentError);
  });
});
