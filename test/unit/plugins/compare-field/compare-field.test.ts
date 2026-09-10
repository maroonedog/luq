// Assembles compareField the way a user writes it and actually runs the
// validation, watching the verdict and the issues rather than whether it
// type-checks.
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

describe("compareField: strict equality by default", () => {
  const validator = Builder()
    .use(compareFieldPlugin)
    .for<Signup>()
    .v("confirm", (b) => b.string.compareField("password"))
    .build();

  it("passes when the two match", () => {
    expect(validator.validate(makeSignup()).valid).toBe(true);
  });

  it("fails when they do not, reporting the path, the code and the default message", () => {
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

describe("compareField: a tuple mixing a field reference with plain arguments", () => {
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

  it("passes when the comparison answers true", () => {
    expect(validator.validate(makeSignup({ age: 18 })).valid).toBe(true);
  });

  it("fails when it answers false", () => {
    const result = validator.validate(makeSignup({ age: 17 }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.path).toBe("age");
  });
});

describe("compareField: a dotted reference", () => {
  const validator = Builder()
    .use(compareFieldPlugin)
    .for<Signup>()
    .v("handle", (b) => b.string.compareField("profile.nickname"))
    .build();

  it("reads a nested counterpart field", () => {
    expect(validator.validate(makeSignup()).valid).toBe(true);
    expect(validator.validate(makeSignup({ handle: "zzz" })).valid).toBe(false);
  });

  it("compares against undefined when the counterpart is absent", () => {
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

describe("compareField: options.code and messageFactory", () => {
  const validator = Builder()
    .use(compareFieldPlugin)
    .for<Signup>()
    .v("confirm", (b) =>
      b.string.compareField("password", undefined, {
        code: "PASSWORD_MISMATCH",
        messageFactory: (msgCtx) =>
          `${msgCtx.path}: ${msgCtx.fieldPath} is ${String(
            msgCtx.targetValue
          )} (code=${msgCtx.code})`,
      })
    )
    .build();

  it("overrides the code and hands messageFactory the field path and target value", () => {
    const result = validator.validate(makeSignup({ confirm: "x" }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("PASSWORD_MISMATCH");
    expect(result.issues[0]?.message).toBe(
      "confirm: password is hunter2 (code=PASSWORD_MISMATCH)"
    );
  });
});

describe("compareField: overriding the severity", () => {
  const validator = Builder()
    .use(compareFieldPlugin)
    .for<Signup>()
    .v("confirm", (b) =>
      b.string.compareField("password", undefined, { severity: "warning" })
    )
    .build();

  it("has a warning report an issue while staying valid", () => {
    const result = validator.validate(makeSignup({ confirm: "x" }));
    expect(result.valid).toBe(true);
    expect(result.issues[0]?.severity).toBe("warning");
  });
});
