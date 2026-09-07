// ===========================================================================
// test/unit/json-schema/convert/compose-keyword.test.ts
//
// allOf / anyOf / oneOf / not / if-then-else, RUN. 1.x wrapped these in
// `chain.custom()` around a private recursive evaluator that understood `type`
// and `const`/`enum` and nothing else, so a sub-schema's `properties`,
// `minLength`, `format` and nested applicators were all silently ignored inside
// every one of them. Each test below therefore puts a constraint INSIDE the
// applicator that the private evaluator could not have seen.
// ===========================================================================
import { fromJsonSchema } from "../../../../src/json-schema/build-from-schema";
import { jsonSchemaBagFixture } from "./json-schema-bag-fixture";

const validateA = (subSchema: unknown, value: unknown): boolean =>
  fromJsonSchema(jsonSchemaBagFixture, {
    properties: { a: subSchema },
  }).validate({ a: value }).valid;

describe("allOf", () => {
  it("requires every arm", () => {
    const schema = { allOf: [{ minLength: 3 }, { maxLength: 5 }] };
    expect(validateA(schema, "abcd")).toBe(true);
    expect(validateA(schema, "ab")).toBe(false);
    expect(validateA(schema, "abcdef")).toBe(false);
  });

  it("applies an arm's `properties`, which 1.x dropped", () => {
    const schema = {
      allOf: [{ properties: { x: { type: "number" } } }, { required: ["y"] }],
    };
    expect(validateA(schema, { x: 1, y: 2 })).toBe(true);
    expect(validateA(schema, { x: "no", y: 2 })).toBe(false);
    expect(validateA(schema, { x: 1 })).toBe(false);
  });
});

describe("anyOf", () => {
  const schema = {
    anyOf: [{ type: "string", minLength: 3 }, { type: "number" }],
  };

  it("accepts a value matching one arm", () => {
    expect(validateA(schema, "abc")).toBe(true);
    expect(validateA(schema, 7)).toBe(true);
  });

  it("refuses a value matching none, and says why", () => {
    expect(validateA(schema, "ab")).toBe(false);
    expect(validateA(schema, true)).toBe(false);
  });

  it("carries every arm's issues as causes", () => {
    const outcome = fromJsonSchema(jsonSchemaBagFixture, {
      properties: { a: schema },
    }).validate({ a: true });
    expect(outcome.valid).toBe(false);
    if (outcome.valid) return;
    expect(outcome.issues[0]?.code).toBe("anyOf");
  });
});

describe("oneOf", () => {
  const schema = { oneOf: [{ multipleOf: 3 }, { multipleOf: 5 }] };

  it("accepts exactly one match", () => {
    expect(validateA(schema, 9)).toBe(true);
    expect(validateA(schema, 10)).toBe(true);
  });

  it("refuses none and refuses several", () => {
    expect(validateA(schema, 7)).toBe(false);
    expect(validateA(schema, 15)).toBe(false);
  });
});

describe("not", () => {
  it("negates the whole sub-schema, nested constraints included", () => {
    expect(validateA({ not: { type: "string" } }, 1)).toBe(true);
    expect(validateA({ not: { type: "string" } }, "x")).toBe(false);
    const nested = { not: { properties: { k: { const: 1 } } } };
    expect(validateA(nested, { k: 2 })).toBe(true);
    expect(validateA(nested, { k: 1 })).toBe(false);
  });

  it("composes with itself: `not` of `not` is the original", () => {
    const schema = { not: { not: { type: "string" } } };
    expect(validateA(schema, "x")).toBe(true);
    expect(validateA(schema, 1)).toBe(false);
  });
});

describe("if / then / else", () => {
  const schema = {
    if: { properties: { kind: { const: "card" } }, required: ["kind"] },
    then: { required: ["cardNumber"] },
    else: { required: ["iban"] },
  };

  it("takes `then` when the condition holds", () => {
    expect(validateA(schema, { kind: "card", cardNumber: "1" })).toBe(true);
    expect(validateA(schema, { kind: "card" })).toBe(false);
  });

  it("takes `else` when it does not", () => {
    expect(validateA(schema, { kind: "bank", iban: "x" })).toBe(true);
    expect(validateA(schema, { kind: "bank" })).toBe(false);
  });

  it("passes when the taken arm is absent", () => {
    const onlyThen = { if: { type: "number" }, then: { minimum: 3 } };
    expect(validateA(onlyThen, "text")).toBe(true);
    expect(validateA(onlyThen, 5)).toBe(true);
    expect(validateA(onlyThen, 1)).toBe(false);
  });

  it("ignores `then` / `else` with no `if` (Draft-07 §6.6.2)", () => {
    expect(validateA({ then: { type: "number" } }, "text")).toBe(true);
    expect(validateA({ else: { type: "number" } }, "text")).toBe(true);
  });
});

describe("applicators nest", () => {
  it("survives anyOf inside allOf inside not", () => {
    const schema = {
      not: {
        allOf: [
          { anyOf: [{ minLength: 4 }, { maxLength: 1 }] },
          { type: "string" },
        ],
      },
    };
    expect(validateA(schema, "abc")).toBe(true);
    expect(validateA(schema, "abcd")).toBe(false);
    expect(validateA(schema, "a")).toBe(false);
  });
});
