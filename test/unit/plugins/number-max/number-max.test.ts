import { Builder } from "../../../../src/index";
import { PluginArgumentError } from "../../../../src/plugin-kit/plugin-definition";
import { numberMaxPlugin } from "../../../../src/plugins/number-max";

type Score = { readonly value: number };

const inclusive = Builder()
  .use(numberMaxPlugin)
  .for<Score>()
  .v("value", (b) => b.number.max(100))
  .build();

const exclusive = Builder()
  .use(numberMaxPlugin)
  .for<Score>()
  .v("value", (b) => b.number.max(100, true))
  .build();

describe("numberMax", () => {
  it("includes the boundary by default", () => {
    expect(inclusive.validate({ value: 100 }).valid).toBe(true);
  });

  it("rejects a value above the boundary", () => {
    const validationResult = inclusive.validate({ value: 100.5 });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toEqual([
      {
        path: "value",
        code: "numberMax",
        message: "Value must be at most 100, but got 100.5",
        severity: "error",
      },
    ]);
  });

  it("rejects the boundary itself under exclusive, wording included", () => {
    const validationResult = exclusive.validate({ value: 100 });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues[0]?.message).toBe(
      "Value must be less than 100, but got 100"
    );
    expect(exclusive.validate({ value: 99.9 }).valid).toBe(true);
  });

  it("hands messageFactory the maximum, the actual value and the exclusive flag", () => {
    const custom = Builder()
      .use(numberMaxPlugin)
      .for<Score>()
      .v("value", (b) =>
        b.number.max(5, false, {
          messageFactory: (context) =>
            `${String(context.max)}/${String(context.actual)}/${String(
              context.exclusive
            )}`,
        })
      )
      .build();
    expect(custom.validate({ value: 9 }).issues[0]?.message).toBe("5/9/false");
  });

  it("fails a NaN maximum at build time, with PluginArgumentError", () => {
    expect(() =>
      Builder()
        .use(numberMaxPlugin)
        .for<Score>()
        .v("value", (b) => b.number.max(Number.NaN))
        .build()
    ).toThrow(PluginArgumentError);
  });
});
