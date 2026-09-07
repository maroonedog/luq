import { Builder } from "../../../../src/index";
import { objectDependentRequiredPlugin } from "../../../../src/plugins/object-dependent-required";

type Bag = { readonly payment: Record<string, unknown> };

const validator = Builder()
  .use(objectDependentRequiredPlugin)
  .for<Bag>()
  .v("payment", (b) =>
    b.object.dependentRequired({
      card: ["holder", "cvc"],
      bank: ["iban"],
    })
  )
  .build();

describe("objectDependentRequired", () => {
  it("demands nothing while the trigger is absent", () => {
    expect(validator.validate({ payment: {} }).valid).toBe(true);
    expect(validator.validate({ payment: { iban: "x" } }).valid).toBe(true);
  });

  it("demands every dependant once the trigger is present", () => {
    expect(
      validator.validate({ payment: { card: "4242", holder: "A", cvc: "1" } })
        .valid
    ).toBe(true);
    expect(validator.validate({ payment: { card: "4242" } }).valid).toBe(false);
  });

  it("treats an explicit undefined as absent, on both sides", () => {
    expect(validator.validate({ payment: { card: undefined } }).valid).toBe(
      true
    );
    const result = validator.validate({
      payment: { card: "4242", holder: undefined, cvc: "1" },
    });
    expect(result.valid).toBe(false);
  });

  it("names every missing key in the legacy message", () => {
    const result = validator.validate({ payment: { card: "4242" } });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "objectDependentRequired",
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "When 'card' is present, the following properties are required: holder, cvc",
    ]);
  });

  it("joins several violations with '; ', as legacy did", () => {
    const result = validator.validate({ payment: { card: "4242", bank: "B" } });
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "When 'card' is present, the following properties are required: holder, cvc; " +
        "When 'bank' is present, the following properties are required: iban",
    ]);
  });

  it("passes a non-object through", () => {
    expect(validator.validate({ payment: ["card"] }).valid).toBe(true);
  });

  // Legacy hard-coded "DEPENDENT_REQUIRED" and accepted no options bag.
  it("honours options.code and the {violations} message context", () => {
    const custom = Builder()
      .use(objectDependentRequiredPlugin)
      .for<Bag>()
      .v("payment", (b) =>
        b.object.dependentRequired(
          { card: ["cvc"] },
          {
            code: "CARD_INCOMPLETE",
            messageFactory: (context) =>
              context.violations
                .map((violation) => violation.missing.join("+"))
                .join(","),
          }
        )
      )
      .build();
    const result = custom.validate({ payment: { card: "4242" } });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "CARD_INCOMPLETE",
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual(["cvc"]);
  });
});
