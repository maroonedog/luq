import { Builder } from "../../../../src/index";
import { numberIntegerPlugin } from "../../../../src/plugins/number-integer";

type Score = { readonly value: number };

const integer = Builder()
  .use(numberIntegerPlugin)
  .for<Score>()
  .v("value", (b) => b.number.integer())
  .build();

describe("numberInteger", () => {
  it("整数を通す (0 と負の整数を含む)", () => {
    expect(integer.validate({ value: 0 }).valid).toBe(true);
    expect(integer.validate({ value: 42 }).valid).toBe(true);
    expect(integer.validate({ value: -7 }).valid).toBe(true);
  });

  it("小数を弾く", () => {
    const validationResult = integer.validate({ value: 1.5 });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toEqual([
      {
        path: "value",
        code: "numberInteger",
        message: "Value must be an integer",
        severity: "error",
      },
    ]);
  });

  it("NaN と Infinity を弾く", () => {
    expect(integer.validate({ value: Number.NaN }).valid).toBe(false);
    expect(integer.validate({ value: Number.POSITIVE_INFINITY }).valid).toBe(
      false
    );
    expect(integer.validate({ value: Number.NEGATIVE_INFINITY }).valid).toBe(
      false
    );
  });
});
