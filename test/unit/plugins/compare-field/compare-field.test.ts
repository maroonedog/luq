// compareField を「利用者が書くとおり」に組み立てて実際に検証を走らせる。
// 型が通ることではなく valid / issues の中身を見る。
import { Builder } from "../../../../src/index";
import { compareFieldPlugin } from "../../../../src/plugins/compare-field/index";

interface Signup {
  password: string;
  confirm: string;
  minAge: number;
  age: number;
  profile: { nickname: string };
  handle: string;
}

function makeSignup(overrides: Partial<Signup> = {}): Signup {
  return {
    password: "hunter2",
    confirm: "hunter2",
    minAge: 18,
    age: 30,
    profile: { nickname: "ace" },
    handle: "ace",
    ...overrides,
  };
}

describe("compareField: 既定は厳密等価", () => {
  const validator = Builder()
    .use(compareFieldPlugin)
    .for<Signup>()
    .v("confirm", (b) => b.string.compareField("password"))
    .build();

  it("一致すれば通る", () => {
    expect(validator.validate(makeSignup()).valid).toBe(true);
  });

  it("不一致なら落ち、path と code と既定メッセージが出る", () => {
    const result = validator.validate(makeSignup({ confirm: "other" }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.path).toBe("confirm");
    expect(result.issues[0]?.code).toBe("compareField");
    expect(result.issues[0]?.message).toBe("Value must be equal to password");
    expect(result.issues[0]?.severity).toBe("error");
  });
});

describe("compareField: 混在マーカータプル (FieldRef + 後続の素の引数)", () => {
  const validator = Builder()
    .use(compareFieldPlugin)
    .for<Signup>()
    .v("age", (b) =>
      b.number.compareField(
        "minAge",
        (value, targetValue) =>
          typeof value === "number" &&
          typeof targetValue === "number" &&
          value >= targetValue
      )
    )
    .build();

  it("比較関数が真なら通る", () => {
    expect(validator.validate(makeSignup({ age: 18 })).valid).toBe(true);
  });

  it("比較関数が偽なら落ちる", () => {
    const result = validator.validate(makeSignup({ age: 17 }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.path).toBe("age");
  });
});

describe("compareField: ドット記法の参照先", () => {
  const validator = Builder()
    .use(compareFieldPlugin)
    .for<Signup>()
    .v("handle", (b) => b.string.compareField("profile.nickname"))
    .build();

  it("ネストした相手フィールドを読む", () => {
    expect(validator.validate(makeSignup()).valid).toBe(true);
    expect(validator.validate(makeSignup({ handle: "zzz" })).valid).toBe(false);
  });

  it("参照先が欠けていれば undefined として比較する", () => {
    const result = validator.validate({
      password: "p",
      confirm: "p",
      minAge: 1,
      age: 2,
      handle: "ace",
    } as unknown as Signup);
    expect(result.valid).toBe(false);
  });
});

describe("compareField: options.code と messageFactory", () => {
  const validator = Builder()
    .use(compareFieldPlugin)
    .for<Signup>()
    .v("confirm", (b) =>
      b.string.compareField("password", undefined, {
        code: "PASSWORD_MISMATCH",
        messageFactory: (msgCtx) =>
          `${msgCtx.path}: ${msgCtx.fieldPath} は ${String(
            msgCtx.targetValue
          )} (code=${msgCtx.code})`,
      })
    )
    .build();

  it("code を上書きし、messageFactory に fieldPath / targetValue を渡す", () => {
    const result = validator.validate(makeSignup({ confirm: "x" }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("PASSWORD_MISMATCH");
    expect(result.issues[0]?.message).toBe(
      "confirm: password は hunter2 (code=PASSWORD_MISMATCH)"
    );
  });
});

describe("compareField: severity の上書き", () => {
  const validator = Builder()
    .use(compareFieldPlugin)
    .for<Signup>()
    .v("confirm", (b) =>
      b.string.compareField("password", undefined, { severity: "warning" })
    )
    .build();

  it("warning は issue を出すが valid のまま", () => {
    const result = validator.validate(makeSignup({ confirm: "x" }));
    expect(result.valid).toBe(true);
    expect(result.issues[0]?.severity).toBe("warning");
  });
});
