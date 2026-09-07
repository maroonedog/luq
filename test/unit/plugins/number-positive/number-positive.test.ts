import { Builder } from "../../../../src/index";
import { numberPositivePlugin } from "../../../../src/plugins/number-positive";

type Score = { readonly value: number };

const positive = Builder()
  .use(numberPositivePlugin)
  .for<Score>()
  .v("value", (b) => b.number.positive())
  .build();

describe("numberPositive", () => {
  it("正の数を通す", () => {
    expect(positive.validate({ value: 1 }).valid).toBe(true);
    expect(positive.validate({ value: 0.0001 }).valid).toBe(true);
  });

  it("0 を弾く (厳密に正)", () => {
    const validationResult = positive.validate({ value: 0 });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toEqual([
      {
        path: "value",
        code: "numberPositive",
        message: "Value must be positive",
        severity: "error",
      },
    ]);
  });

  it("-0 も弾く", () => {
    expect(positive.validate({ value: -0 }).valid).toBe(false);
  });

  it("負の数を弾く", () => {
    expect(positive.validate({ value: -1 }).valid).toBe(false);
  });
});
