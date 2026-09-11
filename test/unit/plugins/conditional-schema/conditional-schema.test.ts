import { Builder } from "../../../../src/index";
import { conditionalSchemaPlugin } from "../../../../src/plugins/conditional-schema";
import { probeMinCharsPlugin } from "../../../support/probe-plugins";

type Bag = { readonly plan: string };

const validator = Builder()
  .use(conditionalSchemaPlugin)
  .use(probeMinCharsPlugin)
  .for<Bag>()
  .v("plan", (b) =>
    b.string.conditionalSchema(
      (sb) => sb.string.minChars(3),
      (sb) => sb.string.minChars(6),
      (sb) => sb.string.minChars(2)
    )
  )
  .build();

describe("conditionalSchema", () => {
  it("applies `then` when the condition holds", () => {
    expect(validator.validate({ plan: "abcdef" }).valid).toBe(true);
    expect(validator.validate({ plan: "abcd" }).valid).toBe(false);
  });

  it("applies `else` when it does not", () => {
    expect(validator.validate({ plan: "ab" }).valid).toBe(true);
    expect(validator.validate({ plan: "a" }).valid).toBe(false);
  });

  it("names the arm that rejected the value", () => {
    const thenFailure = validator.validate({ plan: "abcd" });
    expect(thenFailure.issues.map((issue) => issue.code)).toEqual([
      "conditionalSchema",
    ]);
    expect(thenFailure.issues.map((issue) => issue.message)).toEqual([
      'Value must match the "then" schema',
    ]);
    expect(
      validator.validate({ plan: "a" }).issues.map((issue) => issue.message)
    ).toEqual(['Value must match the "else" schema']);
  });

  it("passes when the chosen arm was not given", () => {
    const thenOnly = Builder()
      .use(conditionalSchemaPlugin)
      .use(probeMinCharsPlugin)
      .for<Bag>()
      .v("plan", (b) =>
        b.string.conditionalSchema(
          (sb) => sb.string.minChars(3),
          (sb) => sb.string.minChars(6)
        )
      )
      .build();
    expect(thenOnly.validate({ plan: "a" }).valid).toBe(true);
    expect(thenOnly.validate({ plan: "abcd" }).valid).toBe(false);
  });

  // The arms are addressed by their position among the branches, and an
  // absent `then` shifts `else` one place along.
  it("applies `else` when it is the only arm given", () => {
    const elseOnly = Builder()
      .use(conditionalSchemaPlugin)
      .use(probeMinCharsPlugin)
      .for<Bag>()
      .v("plan", (b) =>
        b.string.conditionalSchema(
          (sb) => sb.string.minChars(3),
          undefined,
          (sb) => sb.string.minChars(2)
        )
      )
      .build();
    expect(elseOnly.validate({ plan: "abcdef" }).valid).toBe(true);
    expect(elseOnly.validate({ plan: "ab" }).valid).toBe(true);
    const rejection = elseOnly.validate({ plan: "a" });
    expect(rejection.valid).toBe(false);
    expect(rejection.issues.map((issue) => issue.message)).toEqual([
      'Value must match the "else" schema',
    ]);
  });

  it("never reports the `if` arm itself", () => {
    const ifOnly = Builder()
      .use(conditionalSchemaPlugin)
      .use(probeMinCharsPlugin)
      .for<Bag>()
      .v("plan", (b) =>
        b.string.conditionalSchema((sb) => sb.string.minChars(9))
      )
      .build();
    expect(ifOnly.validate({ plan: "a" }).valid).toBe(true);
  });

  it("exposes the taken arm to a message factory", () => {
    const custom = Builder()
      .use(conditionalSchemaPlugin)
      .use(probeMinCharsPlugin)
      .for<Bag>()
      .v("plan", (b) =>
        b.string.conditionalSchema(
          (sb) => sb.string.minChars(3),
          (sb) => sb.string.minChars(6),
          undefined,
          { messageFactory: (context) => `arm=${context.taken}` }
        )
      )
      .build();
    expect(
      custom.validate({ plan: "abcd" }).issues.map((issue) => issue.message)
    ).toEqual(["arm=then"]);
  });
});
