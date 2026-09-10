import { Builder } from "../../../../src/index";
import { numberFinitePlugin } from "../../../../src/plugins/number-finite";

type Score = { readonly value: number };

const finite = Builder()
  .use(numberFinitePlugin)
  .for<Score>()
  .v("value", (b) => b.number.finite())
  .build();

describe("numberFinite", () => {
  it("accepts a finite number, decimals included", () => {
    expect(finite.validate({ value: 0 }).valid).toBe(true);
    expect(finite.validate({ value: -3.25 }).valid).toBe(true);
    expect(finite.validate({ value: Number.MAX_SAFE_INTEGER }).valid).toBe(
      true
    );
  });

  it("rejects Infinity", () => {
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

  it("rejects NaN", () => {
    expect(finite.validate({ value: Number.NaN }).valid).toBe(false);
  });

  // The difference from the integer check: a decimal is finite.
  it("accepts a decimal, unlike the integer check", () => {
    expect(finite.validate({ value: 1.5 }).valid).toBe(true);
  });
});
