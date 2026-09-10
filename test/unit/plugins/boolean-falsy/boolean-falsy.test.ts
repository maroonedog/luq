import { Builder } from "../../../../src/index";
import { booleanFalsyPlugin } from "../../../../src/plugins/boolean-falsy";

type Flags = { readonly archived: boolean };

const falsy = Builder()
  .use(booleanFalsyPlugin)
  .for<Flags>()
  .v("archived", (b) => b.boolean.falsy())
  .build();

describe("booleanFalsy", () => {
  it("accepts false", () => {
    expect(falsy.validate({ archived: false }).valid).toBe(true);
  });

  it("rejects true, with the default wording", () => {
    const validationResult = falsy.validate({ archived: true });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toEqual([
      {
        path: "archived",
        code: "booleanFalsy",
        message: "Value must be falsy",
        severity: "error",
      },
    ]);
  });

  // Inherited behaviour: null, undefined and a missing value all pass.
  it("passes anything that is not a boolean straight through", () => {
    const loose = falsy as unknown as {
      validate(input: unknown): {
        valid: boolean;
        issues: readonly { code: string }[];
      };
    };
    const codes = (input: unknown): readonly string[] =>
      loose.validate(input).issues.map((issue) => issue.code);

    // Absence and null belong to the presence rules, and neither is declared
    // here, so both still pass untouched.
    expect(loose.validate({}).valid).toBe(true);
    expect(loose.validate({ archived: null }).valid).toBe(true);

    // The plugin objects to neither; the slot reports the type once.
    expect(codes({ archived: 1 })).toEqual(["booleanType"]);
    expect(codes({ archived: "yes" })).toEqual(["booleanType"]);
  });

  it("lets an option lower the severity", () => {
    const warning = Builder()
      .use(booleanFalsyPlugin)
      .for<Flags>()
      .v("archived", (b) => b.boolean.falsy({ severity: "warning" }))
      .build();
    expect(warning.validate({ archived: true }).issues[0]?.severity).toBe(
      "warning"
    );
  });
});
