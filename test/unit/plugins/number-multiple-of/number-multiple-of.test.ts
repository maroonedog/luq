import { Builder } from "../../../../src/index";
import { PluginArgumentError } from "../../../../src/plugin-kit/plugin-definition";
import { numberMultipleOfPlugin } from "../../../../src/plugins/number-multiple-of";

type Score = { readonly value: number };

const byThree = Builder()
  .use(numberMultipleOfPlugin)
  .for<Score>()
  .v("value", (b) => b.number.multipleOf(3))
  .build();

const byTenth = Builder()
  .use(numberMultipleOfPlugin)
  .for<Score>()
  .v("value", (b) => b.number.multipleOf(0.1))
  .build();

describe("numberMultipleOf", () => {
  it("accepts an integer multiple and rejects anything else", () => {
    expect(byThree.validate({ value: 9 }).valid).toBe(true);
    expect(byThree.validate({ value: 0 }).valid).toBe(true);
    const validationResult = byThree.validate({ value: 10 });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toEqual([
      {
        path: "value",
        code: "numberMultipleOf",
        message: "Value must be a multiple of 3",
        severity: "error",
      },
    ]);
  });

  // A naive floating-point modulo gets this wrong.
  it("has multipleOf(0.1) accept 0.3", () => {
    expect(byTenth.validate({ value: 0.3 }).valid).toBe(true);
    expect(byTenth.validate({ value: 0.7 }).valid).toBe(true);
    expect(byTenth.validate({ value: 2.4 }).valid).toBe(true);
  });

  it("has multipleOf(0.1) reject 0.35, absorbing no more error than it must", () => {
    expect(byTenth.validate({ value: 0.35 }).valid).toBe(false);
  });

  it("hands messageFactory the divisor", () => {
    const custom = Builder()
      .use(numberMultipleOfPlugin)
      .for<Score>()
      .v("value", (b) =>
        b.number.multipleOf(0.25, {
          messageFactory: (context) => `divisor=${String(context.divisor)}`,
        })
      )
      .build();
    expect(custom.validate({ value: 0.3 }).issues[0]?.message).toBe(
      "divisor=0.25"
    );
  });

  it("fails a divisor of 0, NaN or Infinity at build time, with PluginArgumentError", () => {
    const buildWith =
      (divisor: number): (() => unknown) =>
      () =>
        Builder()
          .use(numberMultipleOfPlugin)
          .for<Score>()
          .v("value", (b) => b.number.multipleOf(divisor))
          .build();
    expect(buildWith(0)).toThrow(PluginArgumentError);
    expect(buildWith(Number.NaN)).toThrow(PluginArgumentError);
    expect(buildWith(Number.POSITIVE_INFINITY)).toThrow(PluginArgumentError);
  });
});
