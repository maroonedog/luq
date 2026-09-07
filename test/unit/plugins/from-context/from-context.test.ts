// fromContext は RuleContext.external を読む。旧実装では required: true が
// 必ず失敗し、本当の実装はどの実行パスからも呼ばれていなかった。
import { Builder } from "../../../../src/index";
import { fromContextPlugin } from "../../../../src/plugins/from-context/index";

interface Signup {
  email: string;
}

const SIGNUP: Signup = { email: "ada@example.com" };

describe("fromContext: 外部コンテキストがある場合", () => {
  const validator = Builder()
    .use(fromContextPlugin)
    .for<Signup>()
    .v("email", (b) =>
      b.string.fromContext({
        check: (value, context) => ({
          valid: context["takenEmails"] !== value,
          message: "Email already exists",
        }),
      })
    )
    .build();

  it("check に value と external が渡り、通る", () => {
    const result = validator.validate(SIGNUP, {
      external: { takenEmails: "other@example.com" },
    });
    expect(result.valid).toBe(true);
  });

  it("check が偽なら、その message が出る", () => {
    const result = validator.validate(SIGNUP, {
      external: { takenEmails: "ada@example.com" },
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.path).toBe("email");
    expect(result.issues[0]?.code).toBe("fromContext");
    expect(result.issues[0]?.message).toBe("Email already exists");
  });

  it("root も渡る", () => {
    let seenRoot: unknown = null;
    const rootReader = Builder()
      .use(fromContextPlugin)
      .for<Signup>()
      .v("email", (b) =>
        b.string.fromContext({
          check: (_value, _context, root) => {
            seenRoot = root;
            return { valid: true };
          },
        })
      )
      .build();
    rootReader.validate(SIGNUP, { external: { any: true } });
    expect(seenRoot).toEqual(SIGNUP);
  });
});

describe("fromContext: 外部コンテキストが無い場合", () => {
  function buildWith(options: {
    required?: boolean;
    fallbackToValid?: boolean;
    errorMessage?: string;
  }) {
    return Builder()
      .use(fromContextPlugin)
      .for<Signup>()
      .v("email", (b) =>
        b.string.fromContext({
          check: () => ({ valid: false, message: "呼ばれないはず" }),
          ...options,
        })
      )
      .build();
  }

  it("既定 (required: false, fallbackToValid: true) では通る", () => {
    expect(buildWith({}).validate(SIGNUP).valid).toBe(true);
  });

  it("fallbackToValid: false なら落ちる", () => {
    const result = buildWith({ fallbackToValid: false }).validate(SIGNUP);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("Context validation failed");
  });

  it("required: true なら落ちて、専用のメッセージが出る", () => {
    const result = buildWith({ required: true }).validate(SIGNUP);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe(
      "Context data is required for validation"
    );
  });

  it("required: true でも external があれば check が走る (旧実装のバグ)", () => {
    const result = buildWith({ required: true }).validate(SIGNUP, {
      external: { anything: 1 },
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("呼ばれないはず");
  });

  it("errorMessage は無コンテキスト時のメッセージを上書きする", () => {
    const result = buildWith({
      required: true,
      errorMessage: "コンテキストを渡してください",
    }).validate(SIGNUP);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("コンテキストを渡してください");
  });
});

describe("fromContext: check が投げた場合", () => {
  const validator = Builder()
    .use(fromContextPlugin)
    .for<Signup>()
    .v("email", (b) =>
      b.string.fromContext({
        check: (): { valid: boolean } => {
          throw new Error("db down");
        },
      })
    )
    .build();

  it("黙って通さず、例外の内容を載せて失敗する", () => {
    const result = validator.validate(SIGNUP, { external: { any: true } });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe(
      "Context validation error: Error: db down"
    );
  });
});

describe("fromContext: options.code と messageFactory", () => {
  const validator = Builder()
    .use(fromContextPlugin)
    .for<Signup>()
    .v("email", (b) =>
      b.string.fromContext(
        { check: () => ({ valid: false, message: "内側" }) },
        {
          code: "CONTEXT",
          messageFactory: (msgCtx) => `${msgCtx.code}/${msgCtx.message}`,
        }
      )
    )
    .build();

  it("messageFactory は check が返した message を文脈で受け取る", () => {
    const result = validator.validate(SIGNUP, { external: { any: true } });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("CONTEXT");
    expect(result.issues[0]?.message).toBe("CONTEXT/内側");
  });
});
