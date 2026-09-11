import { Builder } from "../../../../src/index";
import { PluginArgumentError } from "../../../../src/plugin-kit/plugin-definition";
import { numberRangePlugin } from "../../../../src/plugins/number-range";

type Score = { readonly value: number };

const between = Builder()
  .use(numberRangePlugin)
  .for<Score>()
  .v("value", (b) => b.number.range(1, 10))
  .build();

describe("numberRange", () => {
  it("includes both ends", () => {
    expect(between.validate({ value: 1 }).valid).toBe(true);
    expect(between.validate({ value: 10 }).valid).toBe(true);
    expect(between.validate({ value: 5.5 }).valid).toBe(true);
  });

  it("rejects anything outside, with the default wording", () => {
    const validationResult = between.validate({ value: 11 });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toEqual([
      {
        path: "value",
        code: "numberRange",
        message: "Value must be between 1 and 10, but got 11",
        severity: "error",
      },
    ]);
    expect(between.validate({ value: 0 }).valid).toBe(false);
  });

  it("hands messageFactory the minimum, the maximum and the actual value", () => {
    const custom = Builder()
      .use(numberRangePlugin)
      .for<Score>()
      .v("value", (b) =>
        b.number.range(1, 10, {
          messageFactory: (context) =>
            `${String(context.min)}-${String(context.max)}:${String(context.actual)}`,
        })
      )
      .build();
    expect(custom.validate({ value: 42 }).issues[0]?.message).toBe("1-10:42");
  });

  // Carried to run time, min > max fails every value and shows a
  // configuration mistake to an end user. It fails at build time instead.
  it("fails min > max at build time, with PluginArgumentError", () => {
    expect(() =>
      Builder()
        .use(numberRangePlugin)
        .for<Score>()
        .v("value", (b) => b.number.range(5, 1))
        .build()
    ).toThrow(PluginArgumentError);
  });

  it("fails a NaN boundary at build time, with PluginArgumentError", () => {
    expect(() =>
      Builder()
        .use(numberRangePlugin)
        .for<Score>()
        .v("value", (b) => b.number.range(Number.NaN, 10))
        .build()
    ).toThrow(PluginArgumentError);
    expect(() =>
      Builder()
        .use(numberRangePlugin)
        .for<Score>()
        .v("value", (b) => b.number.range(1, Number.NaN))
        .build()
    ).toThrow(PluginArgumentError);
  });

  it("fails a boundary that is not a number at all at build time", () => {
    expect(() =>
      Builder()
        .use(numberRangePlugin)
        .for<Score>()
        .v("value", (b) => b.number.range("1" as unknown as number, 10))
        .build()
    ).toThrow(PluginArgumentError);
    expect(() =>
      Builder()
        .use(numberRangePlugin)
        .for<Score>()
        .v("value", (b) => b.number.range(1, "10" as unknown as number))
        .build()
    ).toThrow(PluginArgumentError);
  });

  it("accepts a single-point range where min equals max", () => {
    const exact = Builder()
      .use(numberRangePlugin)
      .for<Score>()
      .v("value", (b) => b.number.range(7, 7))
      .build();
    expect(exact.validate({ value: 7 }).valid).toBe(true);
    expect(exact.validate({ value: 8 }).valid).toBe(false);
  });
});
