// literal は厳密等価。ただし expected が NaN のときだけ NaN 同士を一致とみなす。
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
  it("一致すれば通す", () => {
    const result = buildKind("user").validate({
      kind: "user",
      version: 1,
      active: true,
    });
    expect(result.valid).toBe(true);
  });

  it("不一致なら既定メッセージで期待値を二重引用符付きで示す", () => {
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

  it("数値と真偽値は引用符なしで示す", () => {
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

  // 旧実装の NaN 特例をそのまま引き継ぐ。=== では NaN は自分自身と等しくない。
  it("expected が NaN なら NaN を一致とみなす", () => {
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

  it("options.code を尊重する", () => {
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
