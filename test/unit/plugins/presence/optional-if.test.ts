// optionalIf は requiredIf の論理的双対。条件が偽なら空値を拒否する。
import { Builder } from "../../../../src/index";
import { optionalIfPlugin } from "../../../../src/plugins/optional-if";

type Account = { isGuest: boolean; email: string };

const validateEmail = Builder()
  .use(optionalIfPlugin)
  .for<Account>()
  .v("email", (b) => b.string.optionalIf((root) => root.isGuest === true))
  .build();

describe("optionalIf", () => {
  it("条件が真かつ空値なら通す", () => {
    expect(validateEmail.validate({ isGuest: true, email: "" }).valid).toBe(
      true
    );
  });

  it("条件が偽かつ空値なら弾く (実質必須になる)", () => {
    const result = validateEmail.validate({ isGuest: false, email: "" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]).toEqual({
      path: "email",
      code: "optionalIf",
      message: "Field is optional when condition is met",
      severity: "error",
    });
  });

  it("値があれば条件に関わらず通す", () => {
    expect(
      validateEmail.validate({ isGuest: false, email: "a@example.com" }).valid
    ).toBe(true);
    expect(
      validateEmail.validate({ isGuest: true, email: "a@example.com" }).valid
    ).toBe(true);
  });

  // 旧実装は options.code をハードコードで捨て、messageFactory を一度も呼ばなかった
  // (legacy-spec/plugin-catalog-core.md「optionalIf's discarded options」)。
  it("options.code を尊重する (旧実装は無視していた)", () => {
    const validator = Builder()
      .use(optionalIfPlugin)
      .for<Account>()
      .v("email", (b) =>
        b.string.optionalIf((root) => root.isGuest, { code: "EMAIL_NEEDED" })
      )
      .build();
    const result = validator.validate({ isGuest: false, email: "" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("EMAIL_NEEDED");
  });

  it("options.messageFactory を実際に呼ぶ (旧実装は無視していた)", () => {
    const validator = Builder()
      .use(optionalIfPlugin)
      .for<Account>()
      .v("email", (b) =>
        b.string.optionalIf((root) => root.isGuest, {
          messageFactory: (context) =>
            `${context.path} condition=${String(context.condition)}`,
        })
      )
      .build();
    const result = validator.validate({ isGuest: false, email: "" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("email condition=false");
  });
});
