// fromContext reads the external context. In a previous release required:
// true always failed, and the real implementation was reached by no path.
import { Builder } from "../../../../src/index";
import { fromContextPlugin } from "../../../../src/plugins/from-context/index";

interface Signup {
  email: string;
}

const SIGNUP: Signup = { email: "ada@example.com" };

describe("fromContext: with an external context", () => {
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

  it("hands check the value and the external context, and passes", () => {
    const result = validator.validate(SIGNUP, {
      external: { takenEmails: "other@example.com" },
    });
    expect(result.valid).toBe(true);
  });

  it("reports check's own message when it answers false", () => {
    const result = validator.validate(SIGNUP, {
      external: { takenEmails: "ada@example.com" },
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.path).toBe("email");
    expect(result.issues[0]?.code).toBe("fromContext");
    expect(result.issues[0]?.message).toBe("Email already exists");
  });

  it("hands it the root as well", () => {
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

describe("fromContext: with no external context", () => {
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
          check: () => ({ valid: false, message: "must not be called" }),
          ...options,
        })
      )
      .build();
  }

  it("passes by default, with required false and fallbackToValid true", () => {
    expect(buildWith({}).validate(SIGNUP).valid).toBe(true);
  });

  it("fails when fallbackToValid is false", () => {
    const result = buildWith({ fallbackToValid: false }).validate(SIGNUP);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("Context validation failed");
  });

  it("fails with its own message when required is true", () => {
    const result = buildWith({ required: true }).validate(SIGNUP);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe(
      "Context data is required for validation"
    );
  });

  it("still runs check when required is true and a context is present", () => {
    const result = buildWith({ required: true }).validate(SIGNUP, {
      external: { anything: 1 },
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("must not be called");
  });

  it("lets errorMessage override the no-context message", () => {
    const result = buildWith({
      required: true,
      errorMessage: "pass a context",
    }).validate(SIGNUP);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("pass a context");
  });
});

describe("fromContext: when check throws", () => {
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

  it("fails and carries what was thrown, rather than passing in silence", () => {
    const result = validator.validate(SIGNUP, { external: { any: true } });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe(
      "Context validation error: Error: db down"
    );
  });
});

describe("fromContext: options.code and messageFactory", () => {
  const validator = Builder()
    .use(fromContextPlugin)
    .for<Signup>()
    .v("email", (b) =>
      b.string.fromContext(
        { check: () => ({ valid: false, message: "inner" }) },
        {
          code: "CONTEXT",
          messageFactory: (msgCtx) => `${msgCtx.code}/${msgCtx.message}`,
        }
      )
    )
    .build();

  it("gives messageFactory the message check returned, as context", () => {
    const result = validator.validate(SIGNUP, { external: { any: true } });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("CONTEXT");
    expect(result.issues[0]?.message).toBe("CONTEXT/inner");
  });
});
