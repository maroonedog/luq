// optionalIf is the logical dual of requiredIf: a false condition rejects an
// empty value.
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
  it("accepts an empty value when the condition is true", () => {
    expect(validateEmail.validate({ isGuest: true, email: "" }).valid).toBe(
      true
    );
  });

  it("rejects an empty value when the condition is false, making it required in effect", () => {
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

  it("accepts a present value whatever the condition says", () => {
    expect(
      validateEmail.validate({ isGuest: false, email: "a@example.com" }).valid
    ).toBe(true);
    expect(
      validateEmail.validate({ isGuest: true, email: "a@example.com" }).valid
    ).toBe(true);
  });

  // A previous release hard-coded the code away and never called the factory.
  // (legacy-spec/plugin-catalog-core.md「optionalIf's discarded options」)。
  it("honours options.code, which a previous release ignored", () => {
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

  it("actually calls options.messageFactory, which a previous release ignored", () => {
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

/** A way in for inputs the types cannot construct, null among them. */
function validateAccount(input: Record<string, unknown>) {
  return validateEmail.validate(input as unknown as Account);
}

// optionalIf is a conditional presence rule too, so it reaches missing values
// and null. As a check it stayed outside the presence gate and saw only the
// empty string.
describe("optionalIf: reaches missing values and null", () => {
  it("accepts a missing value when the condition is true", () => {
    expect(validateAccount({ isGuest: true }).valid).toBe(true);
  });

  it("accepts null when the condition is true", () => {
    expect(validateAccount({ isGuest: true, email: null }).valid).toBe(true);
  });

  it("rejects a missing value when the condition is false", () => {
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

  it("rejects null when the condition is false", () => {
    const result = validateAccount({ isGuest: false, email: null });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues.map((issue) => issue.code)).toEqual(["optionalIf"]);
  });
});

// optionalIf has an opinion either way, so a true condition overrides
// .required().
describe("optionalIf: lifts .required() conditionally", () => {
  const validator = Builder()
    .use(optionalIfPlugin)
    .use(requiredPlugin)
    .for<Account>()
    .v("email", (b) => b.string.required().optionalIf((root) => root.isGuest))
    .build();

  it("accepts a missing value when the condition is true", () => {
    expect(validator.validate({ isGuest: true } as Account).valid).toBe(true);
  });

  it("rejects a missing value when the condition is false", () => {
    const result = validator.validate({ isGuest: false } as Account);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("optionalIf");
  });
});

// Even with a true condition the empty string counts as present, the same
// promise `.optional().min(3)` makes.
describe("optionalIf: an empty string still reaches the later checks", () => {
  const validator = Builder()
    .use(optionalIfPlugin)
    .use(stringMinPlugin)
    .for<Account>()
    .v("email", (b) => b.string.optionalIf((root) => root.isGuest).min(3))
    .build();

  it("does not run min for a missing value when the condition is true", () => {
    expect(validator.validate({ isGuest: true } as Account).valid).toBe(true);
  });

  it("runs min for an empty string when the condition is true", () => {
    const result = validator.validate({ isGuest: true, email: "" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("stringMin");
  });
});

describe("optionalIf: a per-element condition", () => {
  const validateRows = Builder()
    .use(optionalIfPlugin)
    .for<Roster>()
    .v("rows[*].code", (b) =>
      b.string.optionalIf((_root, item) => item?.index === 0)
    )
    .build();

  it("permits a missing value only at index 0", () => {
    const result = validateRows.validate(
      { isDraft: true, rows: [{}, {}] } as unknown as Roster,
      { abortEarly: false }
    );
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues.map((issue) => issue.path)).toEqual(["rows[1].code"]);
  });
});
