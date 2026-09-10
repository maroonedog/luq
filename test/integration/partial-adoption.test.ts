// ===========================================================================
// test/integration/partial-adoption.test.ts
//
// The documentation claims an existing type can be patched partially. This
// pins that claim by running it. A claim with no gate behind it becomes a lie
// the moment the implementation changes, and that kind of overstatement is
// exactly what this repository decided not to inherit.
//
// Four things:
//   1. an undeclared path is not even READ (checked by installing a getter)
//   2. parse() returns an undeclared field unchanged
//   3. pick() judges one field and no more
//   4. the type definitions are untouched: .for<T>() takes T as it is
//
// The fourth is a statement about types and cannot ride on a run-time test;
// the negative type tests carry it. This file covers the first three.
// ===========================================================================
import { Builder } from "../../src/index";
import { requiredPlugin } from "../../src/plugins/required";
import { stringMinPlugin } from "../../src/plugins/string-min";

interface Order {
  id: string;
  customerNote: string;
  nested: { deep: number };
}

function buildPartialValidator() {
  return Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .for<Order>()
    .v("id", (b) => b.string.required().min(3))
    .build();
}

describe("a type may be covered one field at a time", () => {
  it("judges the declared field", () => {
    const validator = buildPartialValidator();
    expect(validator.validate({ id: "ab" } as Order).valid).toBe(false);
    expect(validator.validate({ id: "abc" } as Order).valid).toBe(true);
  });

  it("does not require the fields it was not given rules for", () => {
    // The claim: an undeclared path is neither validated nor made required.
    expect(buildPartialValidator().validate({ id: "abc" } as Order).valid).toBe(
      true
    );
  });

  it("does not even READ an undeclared field", () => {
    // "not read" is a stronger claim than "not validated", so the stronger
    // one is what gets measured: the getter records being touched, and the
    // list stays empty if it never is.
    const touched: string[] = [];
    const subject = {
      id: "abc",
      get customerNote(): string {
        touched.push("customerNote");
        return "anything";
      },
      get nested(): { deep: number } {
        touched.push("nested");
        return { deep: 1 };
      },
    };

    buildPartialValidator().validate(subject as unknown as Order);

    expect(touched).toEqual([]);
  });

  it("hands undeclared fields back from parse() untouched", () => {
    const outcome = buildPartialValidator().parse({
      id: "abc",
      customerNote: "keep me",
      nested: { deep: 7 },
    });
    expect(outcome.valid).toBe(true);
    if (!outcome.valid) return;
    expect(outcome.data.customerNote).toBe("keep me");
    expect(outcome.data.nested.deep).toBe(7);
  });
});

describe("pick() judges one field on its own", () => {
  it("takes the field's own value, not the whole subject", () => {
    const id = buildPartialValidator().pick("id");
    expect(id.validate("ab").valid).toBe(false);
    expect(id.validate("abc").valid).toBe(true);
  });

  it("ignores a sibling the caller did not pick", () => {
    const id = buildPartialValidator().pick("id");
    expect(id.validate("abc", { customerNote: "" } as Order).valid).toBe(true);
  });
});

describe("pickAll() judges a named subset", () => {
  it("reports only the paths it was asked for", () => {
    const subset = buildPartialValidator().pickAll(["id"]);
    const outcome = subset.validate({ id: "ab" } as Order);
    expect(outcome.valid).toBe(false);
    expect(outcome.issues.every((issue) => issue.path === "id")).toBe(true);
  });
});
