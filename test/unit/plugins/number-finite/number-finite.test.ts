import { Builder } from "../../../../src/index";
import { numberFinitePlugin } from "../../../../src/plugins/number-finite";

type Score = { readonly value: number };

const finite = Builder()
  .use(numberFinitePlugin)
  .for<Score>()
  .v("value", (b) => b.number.finite())
  .build();

describe("numberFinite", () => {
  it("有限の数を通す (小数を含む)", () => {
    expect(finite.validate({ value: 0 }).valid).toBe(true);
    expect(finite.validate({ value: -3.25 }).valid).toBe(true);
    expect(finite.validate({ value: Number.MAX_SAFE_INTEGER }).valid).toBe(
      true
    );
  });

  it("Infinity を弾く", () => {
    const validationResult = finite.validate({
      value: Number.POSITIVE_INFINITY,
    });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toEqual([
      {
        path: "value",
        code: "numberFinite",
        message: "Value must be a finite number",
        severity: "error",
      },
    ]);
    expect(finite.validate({ value: Number.NEGATIVE_INFINITY }).valid).toBe(
      false
    );
  });

  it("NaN を弾く", () => {
    expect(finite.validate({ value: Number.NaN }).valid).toBe(false);
  });

  // numberInteger との違い: 小数は finite では通る。
  it("小数は integer とは違って通る", () => {
    expect(finite.validate({ value: 1.5 }).valid).toBe(true);
  });
});
