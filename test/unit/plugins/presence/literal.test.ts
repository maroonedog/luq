// literal is strict equality, with one exception: an expected NaN matches NaN.
import { Builder } from "../../../../src/index";
import { literalPlugin } from "../../../../src/plugins/literal";

type Doc = { kind: string; version: number; active: boolean };

function buildKind(expected: string) {
  return Builder()
    .use(literalPlugin)
    .for<Doc>()
    .v("kind", (b) => b.string.literal(expected))
    .build();
}

describe("literal", () => {
  it("accepts a match", () => {
    const result = buildKind("user").validate({
      kind: "user",
      version: 1,
      active: true,
    });
    expect(result.valid).toBe(true);
  });

  it("shows the expected value in double quotes in the default message", () => {
    const result = buildKind("user").validate({
      kind: "admin",
      version: 1,
      active: true,
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]).toEqual({
      path: "kind",
      code: "literal",
      message: 'Value must be "user"',
      severity: "error",
    });
  });

  it("shows a number or a boolean without quotes", () => {
    const numberValidator = Builder()
      .use(literalPlugin)
      .for<Doc>()
      .v("version", (b) => b.number.literal(3))
      .build();
    const result = numberValidator.validate({
      kind: "k",
      version: 2,
      active: true,
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("Value must be 3");

    const booleanValidator = Builder()
      .use(literalPlugin)
      .for<Doc>()
      .v("active", (b) => b.boolean.literal(true))
      .build();
    const booleanResult = booleanValidator.validate({
      kind: "k",
      version: 1,
      active: false,
    });
    expect(booleanResult.valid).toBe(false);
    if (booleanResult.valid) return;
    expect(booleanResult.issues[0]?.message).toBe("Value must be true");
  });

  // The NaN exception is inherited as it was. Under === NaN does not equal
  // itself.
  it("counts NaN as matching when NaN is expected", () => {
    const validator = Builder()
      .use(literalPlugin)
      .for<Doc>()
      .v("version", (b) => b.number.literal(Number.NaN))
      .build();
    expect(
      validator.validate({ kind: "k", version: Number.NaN, active: true }).valid
    ).toBe(true);
    expect(
      validator.validate({ kind: "k", version: 1, active: true }).valid
    ).toBe(false);
  });

  it("honours options.code", () => {
    const validator = Builder()
      .use(literalPlugin)
      .for<Doc>()
      .v("kind", (b) => b.string.literal("user", { code: "WRONG_KIND" }))
      .build();
    const result = validator.validate({
      kind: "admin",
      version: 1,
      active: true,
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("WRONG_KIND");
  });
});
