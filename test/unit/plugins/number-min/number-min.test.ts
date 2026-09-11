// Runs the validation and checks the verdict and the issues. Type-checking is
// not a pass.
import { Builder } from "../../../../src/index";
import { PluginArgumentError } from "../../../../src/plugin-kit/plugin-definition";
import { numberMinPlugin } from "../../../../src/plugins/number-min";

type Score = { readonly value: number };

const inclusive = Builder()
  .use(numberMinPlugin)
  .for<Score>()
  .v("value", (b) => b.number.min(10))
  .build();

const exclusive = Builder()
  .use(numberMinPlugin)
  .for<Score>()
  .v("value", (b) => b.number.min(10, true))
  .build();

describe("numberMin", () => {
  it("includes the boundary by default", () => {
    expect(inclusive.validate({ value: 10 }).valid).toBe(true);
  });

  it("rejects a value below the boundary", () => {
    const validationResult = inclusive.validate({ value: 9.999 });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toEqual([
      {
        path: "value",
        code: "numberMin",
        message: "Value must be at least 10, but got 9.999",
        severity: "error",
      },
    ]);
  });

  it("rejects the boundary itself under exclusive, wording included", () => {
    const validationResult = exclusive.validate({ value: 10 });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues[0]?.message).toBe(
      "Value must be greater than 10, but got 10"
    );
    expect(exclusive.validate({ value: 10.0001 }).valid).toBe(true);
  });

  it("lets an option override the code", () => {
    const renamed = Builder()
      .use(numberMinPlugin)
      .for<Score>()
      .v("value", (b) => b.number.min(10, false, { code: "TOO_SMALL" }))
      .build();
    const validationResult = renamed.validate({ value: 1 });
    expect(validationResult.issues[0]?.code).toBe("TOO_SMALL");
  });

  it("hands messageFactory the minimum, the actual value and the exclusive flag", () => {
    const custom = Builder()
      .use(numberMinPlugin)
      .for<Score>()
      .v("value", (b) =>
        b.number.min(10, true, {
          messageFactory: (context) =>
            `${context.path}:${String(context.min)}:${String(context.actual)}:${String(
              context.exclusive
            )}`,
        })
      )
      .build();
    expect(custom.validate({ value: 4 }).issues[0]?.message).toBe(
      "value:10:4:true"
    );
  });

  it("handles a negative minimum", () => {
    const belowZero = Builder()
      .use(numberMinPlugin)
      .for<Score>()
      .v("value", (b) => b.number.min(-5))
      .build();
    expect(belowZero.validate({ value: -5 }).valid).toBe(true);
    expect(belowZero.validate({ value: -6 }).valid).toBe(false);
  });

  it("fails a minimum that is not a number at all at build time", () => {
    expect(() =>
      Builder()
        .use(numberMinPlugin)
        .for<Score>()
        .v("value", (b) => b.number.min("10" as unknown as number))
        .build()
    ).toThrow(PluginArgumentError);
  });

  it("fails a NaN minimum at build time, with PluginArgumentError", () => {
    expect(() =>
      Builder()
        .use(numberMinPlugin)
        .for<Score>()
        .v("value", (b) => b.number.min(Number.NaN))
        .build()
    ).toThrow(PluginArgumentError);
  });
});
