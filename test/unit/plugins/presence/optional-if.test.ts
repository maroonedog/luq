// optionalIf は requiredIf の論理的双対。条件が偽なら空値を拒否する。
import { Builder } from "../../../../src/index";
import { optionalIfPlugin } from "../../../../src/plugins/optional-if";
import { requiredPlugin } from "../../../../src/plugins/required";
import { stringMinPlugin } from "../../../../src/plugins/string-min";

type Account = { isGuest: boolean; email: string };
type Roster = { isDraft: boolean; rows: { code: string }[] };

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

/** null を含む「型では作れない入力」を通すための入口。 */
function validateAccount(input: Record<string, unknown>) {
  return validateEmail.validate(input as unknown as Account);
}

// optionalIf も条件付き presence ルールであり、欠損と null に効く。
// CheckRule だった頃は presence ゲートの内側に届かず、空文字しか見えなかった。
describe("optionalIf: 欠損と null にも効く", () => {
  it("条件が真なら欠損を通す", () => {
    expect(validateAccount({ isGuest: true }).valid).toBe(true);
  });

  it("条件が真なら null を通す", () => {
    expect(validateAccount({ isGuest: true, email: null }).valid).toBe(true);
  });

  it("条件が偽なら欠損を拒否する", () => {
    const result = validateAccount({ isGuest: false });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues).toEqual([
      {
        path: "email",
        code: "optionalIf",
        message: "Field is optional when condition is met",
        severity: "error",
      },
    ]);
  });

  it("条件が偽なら null を拒否する", () => {
    const result = validateAccount({ isGuest: false, email: null });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues.map((issue) => issue.code)).toEqual(["optionalIf"]);
  });
});

// optionalIf は両側に意見を持つので、条件が真なら .required() を上書きする。
describe("optionalIf: .required() を条件付きで解除する", () => {
  const validator = Builder()
    .use(optionalIfPlugin)
    .use(requiredPlugin)
    .for<Account>()
    .v("email", (b) => b.string.required().optionalIf((root) => root.isGuest))
    .build();

  it("条件が真なら欠損を通す", () => {
    expect(validator.validate({ isGuest: true } as Account).valid).toBe(true);
  });

  it("条件が偽なら欠損を拒否する", () => {
    const result = validator.validate({ isGuest: false } as Account);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("optionalIf");
  });
});

// 条件が真でも空文字は「値がある」扱い。`.optional().min(3)` と同じ約束。
describe("optionalIf: 条件が真でも空文字は後続の検査に届く", () => {
  const validator = Builder()
    .use(optionalIfPlugin)
    .use(stringMinPlugin)
    .for<Account>()
    .v("email", (b) => b.string.optionalIf((root) => root.isGuest).min(3))
    .build();

  it("条件が真かつ欠損なら min は走らない", () => {
    expect(validator.validate({ isGuest: true } as Account).valid).toBe(true);
  });

  it("条件が真かつ空文字なら min が走る", () => {
    const result = validator.validate({ isGuest: true, email: "" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("stringMin");
  });
});

describe("optionalIf: 配列要素ごとの条件", () => {
  const validateRows = Builder()
    .use(optionalIfPlugin)
    .for<Roster>()
    .v("rows[*].code", (b) =>
      b.string.optionalIf((_root, item) => item?.index === 0)
    )
    .build();

  it("index 0 の欠損だけが許される", () => {
    const result = validateRows.validate(
      { isDraft: true, rows: [{}, {}] } as unknown as Roster,
      { abortEarly: false }
    );
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues.map((issue) => issue.path)).toEqual(["rows[1].code"]);
  });
});
