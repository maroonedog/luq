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

describe("compose-keyword: an applicator with no arms at all", () => {
  // Draft-07 §6.7 gives allOf / anyOf / oneOf a NON-EMPTY array, so an empty one
  // is a document nobody should write — but the converter still has to answer
  // for it, and "no arms" means "no constraint". Building a composite anyway
  // would answer the opposite for two of the three: with zero branches there is
  // no arm that accepts, so `anyOf: []` would refuse every value, and no arm
  // that is THE one, so `oneOf: []` would refuse every value too.
  it("constrains nothing, whichever of the three keywords it is", () => {
    expect(validateA({ allOf: [] }, "anything")).toBe(true);
    expect(validateA({ anyOf: [] }, "anything")).toBe(true);
    expect(validateA({ oneOf: [] }, "anything")).toBe(true);
    expect(validateA({ anyOf: [] }, 0)).toBe(true);
    expect(validateA({ oneOf: [] }, { nested: true })).toBe(true);
  });

  it("reports no issue under the keyword's own code", () => {
    // Both aborts are switched off because each of them ends a field at its
    // first issue: the failing `minLength` would otherwise mask anything the
    // empty applicators added after it, and what they add is the whole point.
    // The sibling is there so the field fails for a reason we can name, which
    // is what makes the reported code list an assertion and not an empty set.
    const outcome = fromJsonSchema(jsonSchemaBagFixture, {
      properties: { a: { allOf: [], anyOf: [], oneOf: [], minLength: 3 } },
    }).validate(
      { a: "ab" },
      { abortEarly: false, abortEarlyOnEachField: false }
    );
    expect(outcome.valid).toBe(false);
    if (outcome.valid) return;
    expect(outcome.issues.map((issue) => issue.code)).toEqual(["stringMin"]);
  });

  it("leaves the sibling keywords of the same schema alone", () => {
    expect(validateA({ anyOf: [], minLength: 3 }, "abc")).toBe(true);
    expect(validateA({ anyOf: [], minLength: 3 }, "ab")).toBe(false);
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
