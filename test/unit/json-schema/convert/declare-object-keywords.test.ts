// ===========================================================================
// test/unit/json-schema/convert/declare-object-keywords.test.ts
//
// The object and array keywords, RUN. Each of these was either ignored by 1.x's
// converter or bound to a method that does not exist (`minItems`), so every
// assertion here is a regression that used to pass by accident.
// ===========================================================================
import { fromJsonSchema } from "../../../../src/json-schema/build-from-schema";
import { jsonSchemaBagFixture } from "./json-schema-bag-fixture";

const validateA = (subSchema: unknown, value: unknown): boolean =>
  fromJsonSchema(jsonSchemaBagFixture, {
    properties: { a: subSchema },
  }).validate({ a: value }).valid;

describe("array keywords", () => {
  it("binds minItems / maxItems to minLength / maxLength", () => {
    // The C2 regression: 1.x called `chain.minItems`, which does not exist.
    expect(validateA({ minItems: 2 }, [1])).toBe(false);
    expect(validateA({ minItems: 2 }, [1, 2])).toBe(true);
    expect(validateA({ maxItems: 1 }, [1, 2])).toBe(false);
    expect(validateA({ maxItems: 1 }, [1])).toBe(true);
  });

  it("applies uniqueItems only when it is true", () => {
    expect(validateA({ uniqueItems: true }, [1, 1])).toBe(false);
    expect(validateA({ uniqueItems: true }, [1, 2])).toBe(true);
    // §6.4.3: `false` imposes NOTHING, so it must not add a rule.
    expect(validateA({ uniqueItems: false }, [1, 1])).toBe(true);
  });

  it("constrains every element through the `[*]` declaration", () => {
    const schema = { items: { type: "string", minLength: 2 } };
    expect(validateA(schema, ["ab", "cd"])).toBe(true);
    expect(validateA(schema, ["ab", "c"])).toBe(false);
    expect(validateA(schema, ["ab", 3])).toBe(false);
  });

  it("constrains element i by position in the tuple form", () => {
    const schema = { items: [{ type: "string" }, { type: "number" }] };
    expect(validateA(schema, ["x", 1])).toBe(true);
    expect(validateA(schema, [1, 1])).toBe(false);
    expect(validateA(schema, ["x", "y"])).toBe(false);
  });

  it("permits a short array and extra elements, unlike tupleBuilder", () => {
    const schema = { items: [{ type: "string" }] };
    expect(validateA(schema, [])).toBe(true);
    expect(validateA(schema, ["x"])).toBe(true);
    expect(validateA(schema, ["x", 99, true])).toBe(true);
    expect(validateA(schema, "not an array")).toBe(true);
  });

  it("judges the extras with additionalItems", () => {
    const closed = { items: [{ type: "string" }], additionalItems: false };
    expect(closed).toBeDefined();
    expect(validateA(closed, ["x"])).toBe(true);
    expect(validateA(closed, ["x", 1])).toBe(false);
    const typed = {
      items: [{ type: "string" }],
      additionalItems: { type: "number" },
    };
    expect(validateA(typed, ["x", 1, 2])).toBe(true);
    expect(validateA(typed, ["x", 1, "y"])).toBe(false);
  });

  it("applies `contains` existentially", () => {
    const schema = { contains: { type: "number", minimum: 5 } };
    expect(validateA(schema, ["a", 7])).toBe(true);
    expect(validateA(schema, ["a", 1])).toBe(false);
    expect(validateA(schema, "not an array")).toBe(true);
  });
});

describe("object keywords", () => {
  it("binds minProperties / maxProperties", () => {
    expect(validateA({ minProperties: 2 }, { x: 1 })).toBe(false);
    expect(validateA({ minProperties: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(validateA({ maxProperties: 1 }, { x: 1, y: 2 })).toBe(false);
  });

  it("closes the object with additionalProperties: false", () => {
    const schema = {
      type: "object",
      properties: { x: {} },
      additionalProperties: false,
    };
    // 1.x defaulted the allowed set to the EMPTY list, so this rejected `x`.
    expect(validateA(schema, { x: 1 })).toBe(true);
    expect(validateA(schema, { x: 1, y: 2 })).toBe(false);
  });

  it("judges undeclared values with the schema form", () => {
    const schema = {
      properties: { x: {} },
      additionalProperties: { type: "number" },
    };
    expect(validateA(schema, { x: "anything", y: 1 })).toBe(true);
    expect(validateA(schema, { x: "anything", y: "no" })).toBe(false);
  });

  it("applies EVERY matching patternProperties entry", () => {
    const schema = {
      patternProperties: {
        "^s_": { type: "string" },
        _end$: { minLength: 4 },
      },
    };
    expect(validateA(schema, { s_x_end: "abcd" })).toBe(true);
    expect(validateA(schema, { s_x_end: "abc" })).toBe(false);
    expect(validateA(schema, { s_x_end: 4 })).toBe(false);
  });

  it("constrains the property NAMES with propertyNames", () => {
    const schema = { propertyNames: { maxLength: 3 } };
    expect(validateA(schema, { abc: 1 })).toBe(true);
    expect(validateA(schema, { abcd: 1 })).toBe(false);
  });

  it("reads both Draft-07 forms of `dependencies`", () => {
    const list = { dependencies: { card: ["billing"] } };
    expect(validateA(list, { card: 1, billing: 2 })).toBe(true);
    expect(validateA(list, { card: 1 })).toBe(false);
    expect(validateA(list, { billing: 2 })).toBe(true);
    const sub = { dependencies: { card: { required: ["billing"] } } };
    expect(validateA(sub, { card: 1, billing: 2 })).toBe(true);
    expect(validateA(sub, { card: 1 })).toBe(false);
  });

  it("reads a `dependencies` object holding BOTH forms at once", () => {
    const schema = {
      dependencies: {
        card: ["billing"],
        gift: { properties: { note: { type: "string" } } },
      },
    };
    expect(validateA(schema, { card: 1, billing: 2 })).toBe(true);
    expect(validateA(schema, { card: 1 })).toBe(false);
    expect(validateA(schema, { gift: 1, note: "hi" })).toBe(true);
    expect(validateA(schema, { gift: 1, note: 4 })).toBe(false);
  });
});

describe("required is asked of the OBJECT, not of each child", () => {
  it("does not fire when the whole object is absent", () => {
    // The bug this shape exists to keep out: a child presence rule fires on any
    // `undefined`, including the one produced by a MISSING PARENT, so `{}`
    // would have been refused although Draft-07 applies a sub-schema only to a
    // value that is there.
    const schema = {
      properties: { a: { properties: { b: {} }, required: ["b"] } },
    };
    const validator = fromJsonSchema(jsonSchemaBagFixture, schema);
    expect(validator.validate({}).valid).toBe(true);
    expect(validator.validate({ a: {} }).valid).toBe(false);
    expect(validator.validate({ a: { b: 1 } }).valid).toBe(true);
  });

  it("is none of a NON-object's business (§6.5.3)", () => {
    expect(validateA({ required: ["b"] }, "a string")).toBe(true);
    expect(validateA({ required: ["b"] }, [1, 2])).toBe(true);
    expect(validateA({ required: ["b"] }, {})).toBe(false);
  });

  it("counts an explicit undefined as PRESENT only when the key exists", () => {
    const declared: Record<string, unknown> = {};
    Object.defineProperty(declared, "b", {
      value: undefined,
      enumerable: true,
    });
    expect(validateA({ required: ["b"] }, declared)).toBe(true);
    expect(validateA({ required: ["b"] }, {})).toBe(false);
  });

  it("still distributes the ROOT's required, which has no object to ask", () => {
    const validator = fromJsonSchema(jsonSchemaBagFixture, {
      required: ["a"],
      properties: { a: {} },
    });
    expect(validator.validate({}).valid).toBe(false);
    expect(validator.validate({ a: 1 }).valid).toBe(true);
  });
});
