import { Builder } from "../../../../src/index";
import { numberNegativePlugin } from "../../../../src/plugins/number-negative";

type Score = { readonly value: number };

const negative = Builder()
  .use(numberNegativePlugin)
  .for<Score>()
  .v("value", (b) => b.number.negative())
  .build();

describe("numberNegative", () => {
  it("accepts a negative number", () => {
    expect(negative.validate({ value: -1 }).valid).toBe(true);
    expect(negative.validate({ value: -0.0001 }).valid).toBe(true);
  });

  it("rejects 0, being strictly negative", () => {
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

  it("rejects -0 too, -0 < 0 being false", () => {
    expect(negative.validate({ value: -0 }).valid).toBe(false);
  });

  it("rejects a positive number", () => {
    expect(negative.validate({ value: 1 }).valid).toBe(false);
  });
});
