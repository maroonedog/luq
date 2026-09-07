import { Builder } from "../../../../src/index";
import { numberNegativePlugin } from "../../../../src/plugins/number-negative";

type Score = { readonly value: number };

const negative = Builder()
  .use(numberNegativePlugin)
  .for<Score>()
  .v("value", (b) => b.number.negative())
  .build();

describe("numberNegative", () => {
  it("負の数を通す", () => {
    expect(negative.validate({ value: -1 }).valid).toBe(true);
    expect(negative.validate({ value: -0.0001 }).valid).toBe(true);
  });

  it("0 を弾く (厳密に負)", () => {
    const validationResult = negative.validate({ value: 0 });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toEqual([
      {
        path: "value",
        code: "numberNegative",
        message: "Value must be negative",
        severity: "error",
      },
    ]);
  });

  it("-0 も弾く (-0 < 0 は false)", () => {
    expect(negative.validate({ value: -0 }).valid).toBe(false);
  });

  it("正の数を弾く", () => {
    expect(negative.validate({ value: 1 }).valid).toBe(false);
  });
});
