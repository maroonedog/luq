import { Builder } from "../../../../src/index";
import { booleanTruthyPlugin } from "../../../../src/plugins/boolean-truthy";

type Flags = { readonly accepted: boolean };

const truthy = Builder()
  .use(booleanTruthyPlugin)
  .for<Flags>()
  .v("accepted", (b) => b.boolean.truthy())
  .build();

describe("booleanTruthy", () => {
  it("accepts true", () => {
    expect(truthy.validate({ accepted: true }).valid).toBe(true);
  });

  it("rejects false, with the default wording", () => {
    const validationResult = truthy.validate({ accepted: false });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toEqual([
      {
        path: "accepted",
        code: "booleanTruthy",
        message: "Value must be truthy",
        severity: "error",
      },
    ]);
  });

  // Despite the name this is === true and not JavaScript truthiness. Nothing
  // is coerced.
  it("passes anything that is not a boolean straight through", () => {
    const loose = truthy as unknown as {
      validate(input: unknown): { valid: boolean };
    };
    expect(loose.validate({}).valid).toBe(true);
    expect(loose.validate({ accepted: null }).valid).toBe(true);
    expect(loose.validate({ accepted: 0 }).valid).toBe(true);
    expect(loose.validate({ accepted: "" }).valid).toBe(true);
    expect(loose.validate({ accepted: 1 }).valid).toBe(true);
  });

  it("lets messageFactory replace the wording", () => {
    const custom = Builder()
      .use(booleanTruthyPlugin)
      .for<Flags>()
      .v("accepted", (b) =>
        b.boolean.truthy({
          messageFactory: (context) => `${context.path} must be checked`,
        })
      )
      .build();
    expect(custom.validate({ accepted: false }).issues[0]?.message).toBe(
      "accepted must be checked"
    );
  });
});
