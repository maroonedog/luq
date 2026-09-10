// orFail is a negative gate: a true condition fails whatever the value is.
import { Builder } from "../../../../src/index";
import { orFailPlugin } from "../../../../src/plugins/or-fail";

type Payload = { env: string; debugToken: string };

const validatePayload = Builder()
  .use(orFailPlugin)
  .for<Payload>()
  .v("debugToken", (b) => b.string.orFail((root) => root.env === "production"))
  .build();

describe("orFail", () => {
  it("fails on a present value alone when the condition is true", () => {
    const result = validatePayload.validate({
      env: "production",
      debugToken: "t",
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]).toEqual({
      path: "debugToken",
      code: "orFail",
      message: "Validation failed",
      severity: "error",
    });
  });

  it("does nothing when the condition is false", () => {
    expect(
      validatePayload.validate({ env: "dev", debugToken: "t" }).valid
    ).toBe(true);
  });

  it("never looks at the value's contents", () => {
    expect(
      validatePayload.validate({ env: "production", debugToken: "" }).valid
    ).toBe(false);
  });

  it("lets options.messageFactory replace the fixed wording", () => {
    const validator = Builder()
      .use(orFailPlugin)
      .for<Payload>()
      .v("debugToken", (b) =>
        b.string.orFail((root) => root.env === "production", {
          code: "DEBUG_FIELD_FORBIDDEN",
          messageFactory: (context) =>
            `${context.path} cannot be used in production`,
        })
      )
      .build();
    const result = validator.validate({ env: "production", debugToken: "t" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("DEBUG_FIELD_FORBIDDEN");
    expect(result.issues[0]?.message).toBe(
      "debugToken cannot be used in production"
    );
  });
});
