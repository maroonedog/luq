import { Builder } from "../../../../src/index";
import { numberPositivePlugin } from "../../../../src/plugins/number-positive";

type Score = { readonly value: number };

const positive = Builder()
  .use(numberPositivePlugin)
  .for<Score>()
  .v("value", (b) => b.number.positive())
  .build();

describe("numberPositive", () => {
  it("accepts a positive number", () => {
    expect(positive.validate({ value: 1 }).valid).toBe(true);
    expect(positive.validate({ value: 0.0001 }).valid).toBe(true);
  });

  it("rejects 0, being strictly positive", () => {
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

  it("rejects -0 too", () => {
    expect(positive.validate({ value: -0 }).valid).toBe(false);
  });

  it("rejects a negative number", () => {
    expect(positive.validate({ value: -1 }).valid).toBe(false);
  });
});
