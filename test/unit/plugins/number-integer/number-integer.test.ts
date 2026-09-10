import { Builder } from "../../../../src/index";
import { numberIntegerPlugin } from "../../../../src/plugins/number-integer";

type Score = { readonly value: number };

const integer = Builder()
  .use(numberIntegerPlugin)
  .for<Score>()
  .v("value", (b) => b.number.integer())
  .build();

describe("numberInteger", () => {
  it("accepts an integer, 0 and negatives included", () => {
    expect(integer.validate({ value: 0 }).valid).toBe(true);
    expect(integer.validate({ value: 42 }).valid).toBe(true);
    expect(integer.validate({ value: -7 }).valid).toBe(true);
  });

  it("rejects a decimal", () => {
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

  it("rejects NaN and Infinity", () => {
    expect(integer.validate({ value: Number.NaN }).valid).toBe(false);
    expect(integer.validate({ value: Number.POSITIVE_INFINITY }).valid).toBe(
      false
    );
    expect(integer.validate({ value: Number.NEGATIVE_INFINITY }).valid).toBe(
      false
    );
  });
});
