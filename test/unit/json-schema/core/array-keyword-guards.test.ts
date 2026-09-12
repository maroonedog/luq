// ===========================================================================
// test/unit/json-schema/core/array-keyword-guards.test.ts
//
// The array keywords whose value shape decides whether a rule exists at all.
// Each had a route that built a validator enforcing LESS than the document
// asked for, which no later assertion can detect: `items: 5` produced an
// element schema with no rules in it, `additionalItems: 5` produced the same
// empty schema for every element past the tuple, `contains: 5` produced an
// element branch that matches anything, and any `uniqueItems` other than the
// literal `true` produced no rule either.
//
// The legal shapes are asserted next to the refusals, because the refusal is
// only correct if it leaves them alone: `items` has two forms in Draft-07,
// `additionalItems` and `contains` take a boolean as readily as an object, and
// `uniqueItems: false` is a lawful no-op.
// ===========================================================================
import {
  readCheckedItems,
  readCheckedUniqueItems,
} from "../../../../src/json-schema/array-keyword-guards";
import { fromJsonSchema } from "../../../../src/json-schema/build-from-schema";
import { MalformedSchemaError } from "../../../../src/json-schema/malformed-schema-error";
import { refusalFrom } from "../malformed-schema-refusal";
import { jsonSchemaBagFixture } from "../convert/json-schema-bag-fixture";

const build = (subSchema: unknown): unknown =>
  fromJsonSchema(jsonSchemaBagFixture, { properties: { a: subSchema } });

const validateA = (subSchema: unknown, value: unknown): boolean =>
  fromJsonSchema(jsonSchemaBagFixture, {
    properties: { a: subSchema },
  }).validate({ a: value }).valid;

/** The one shape section 6.4.2 gives `additionalItems` any effect in. */
const tupleOf = (rest: unknown): Record<string, unknown> => ({
  type: "array",
  items: [{ type: "number" }],
  additionalItems: rest,
});

describe("the readers hand back the value they checked", () => {
  it("returns undefined for an absent keyword, which stays a no-op", () => {
    expect(readCheckedItems({})).toBeUndefined();
    expect(readCheckedUniqueItems({})).toBeUndefined();
  });

  it("returns the value itself, so the caller reads it only once", () => {
    const single = { type: "string" } as const;
    expect(readCheckedItems({ items: single })).toBe(single);
    const tuple = [single];
    expect(readCheckedItems({ items: tuple })).toBe(tuple);
    expect(readCheckedUniqueItems({ uniqueItems: true })).toBe(true);
    expect(readCheckedUniqueItems({ uniqueItems: false })).toBe(false);
  });
});

describe("`items` refuses a value that is not a schema", () => {
  it("refuses a primitive, which would have constrained nothing", () => {
    expect(() => build({ items: 5 })).toThrow(MalformedSchemaError);
  });

  it("refuses null, which is not the empty schema", () => {
    expect(() => build({ items: null })).toThrow(MalformedSchemaError);
  });

  it("refuses a string, the shape an unparsed document arrives in", () => {
    expect(() => build({ items: "string" })).toThrow(MalformedSchemaError);
  });

  it("names the keyword and renders the value it found", () => {
    const thrown = refusalFrom(() => build({ items: 5 }));

    expect(thrown.keyword).toBe("items");
    expect(thrown.received).toBe("5");
  });

  it("refuses a tuple position that is not a schema, naming the index", () => {
    const thrown = refusalFrom(() => build({ items: [{ type: "string" }, 7] }));

    expect(thrown.keyword).toBe("items");
    expect(thrown.reason).toContain("1");
    expect(thrown.received).toBe("7");
  });
});

describe("`items` keeps both forms Draft-07 defines", () => {
  it("still constrains every element through the single form", () => {
    const schema = { items: { type: "string" } };
    expect(validateA(schema, ["a", "b"])).toBe(true);
    expect(validateA(schema, ["a", 2])).toBe(false);
  });

  it("still constrains position i through the tuple form", () => {
    const schema = { items: [{ type: "string" }, { type: "number" }] };
    expect(validateA(schema, ["x", 1])).toBe(true);
    expect(validateA(schema, ["x", "y"])).toBe(false);
  });

  it("accepts the boolean form of a schema in both positions", () => {
    // Section 4.4: `true` and `false` ARE schemas, so neither is malformed.
    expect(() => build({ items: true })).not.toThrow();
    expect(() => build({ items: [false] })).not.toThrow();
  });

  it("accepts an empty tuple, which constrains no position", () => {
    expect(validateA({ items: [] }, [1, 2])).toBe(true);
  });
});

describe("`uniqueItems` refuses a value that is not a boolean", () => {
  it("refuses the string a form encoding produces", () => {
    expect(() => build({ uniqueItems: "true" })).toThrow(MalformedSchemaError);
  });

  it("refuses a number", () => {
    expect(() => build({ uniqueItems: 1 })).toThrow(MalformedSchemaError);
  });

  it("names the keyword and renders the value it found", () => {
    const thrown = refusalFrom(() => build({ uniqueItems: "yes" }));

    expect(thrown.keyword).toBe("uniqueItems");
    expect(thrown.received).toBe('"yes"');
  });
});

describe("`uniqueItems` keeps both booleans working", () => {
  it("still enforces uniqueness on true", () => {
    expect(validateA({ uniqueItems: true }, [1, 1])).toBe(false);
    expect(validateA({ uniqueItems: true }, [1, 2])).toBe(true);
  });

  it("is still a no-op on false, which section 6.4.3 requires", () => {
    expect(() => build({ uniqueItems: false })).not.toThrow();
    expect(validateA({ uniqueItems: false }, [1, 1])).toBe(true);
  });
});

describe("`additionalItems` refuses a value that is not a schema", () => {
  it("refuses the primitive that left every extra element unchecked", () => {
    // The rest branch is built from this value, and a primitive carries no
    // keywords, so the branch passed whatever it was given: element 1 of
    // [1, "nope"] was judged against a constraint that had become always-true.
    expect(() => validateA(tupleOf(5), [1, "nope"])).toThrow(
      MalformedSchemaError
    );
  });

  it("refuses the string a boolean serialised into a form arrives as", () => {
    expect(() => build(tupleOf("false"))).toThrow(MalformedSchemaError);
  });

  it("refuses null, which is not the empty schema", () => {
    expect(() => build(tupleOf(null))).toThrow(MalformedSchemaError);
  });

  it("names the keyword and renders the value it found", () => {
    const thrown = refusalFrom(() => build(tupleOf(5)));

    expect(thrown.keyword).toBe("additionalItems");
    expect(thrown.received).toBe("5");
  });
});

describe("`additionalItems` keeps the forms Draft-07 defines", () => {
  it("still closes the tuple on false", () => {
    expect(validateA(tupleOf(false), [1])).toBe(true);
    expect(validateA(tupleOf(false), [1, 2])).toBe(false);
  });

  it("still leaves the tuple open on true", () => {
    expect(validateA(tupleOf(true), [1, "anything"])).toBe(true);
  });

  it("still constrains the extra elements through a schema", () => {
    expect(validateA(tupleOf({ type: "string" }), [1, "x"])).toBe(true);
    expect(validateA(tupleOf({ type: "string" }), [1, 2])).toBe(false);
  });

  it("is still ignored beside the single form of `items`", () => {
    // Section 6.4.2 gives `additionalItems` effect only when `items` is the
    // tuple form; beside the single form no rest branch is built, so the
    // value is never read and the document builds as it always did.
    expect(() =>
      build({ type: "array", items: { type: "number" }, additionalItems: 5 })
    ).not.toThrow();
  });
});

describe("`contains` refuses a value that is not a schema", () => {
  it("refuses the primitive that turned existence into non-emptiness", () => {
    // An always-true inner branch matches the FIRST element, so the existence
    // check was satisfied by any non-empty array: ["a"] was accepted though
    // the document names nothing it could match. Only [] was rejected, and
    // that one lawful-looking verdict is what hid the missing constraint.
    expect(() => validateA({ type: "array", contains: 5 }, ["a"])).toThrow(
      MalformedSchemaError
    );
  });

  it("refuses a string, the shape an unparsed document arrives in", () => {
    expect(() => build({ contains: "string" })).toThrow(MalformedSchemaError);
  });

  it("refuses null, which is not the empty schema", () => {
    expect(() => build({ contains: null })).toThrow(MalformedSchemaError);
  });

  it("names the keyword and renders the value it found", () => {
    const thrown = refusalFrom(() => build({ contains: 5 }));

    expect(thrown.keyword).toBe("contains");
    expect(thrown.received).toBe("5");
  });
});

describe("`contains` keeps the forms Draft-07 defines", () => {
  it("still requires one element to match the schema form", () => {
    const schema = { type: "array", contains: { type: "number" } };
    expect(validateA(schema, ["a", 1])).toBe(true);
    expect(validateA(schema, ["a", "b"])).toBe(false);
    expect(validateA(schema, [])).toBe(false);
  });

  it("accepts the boolean form of a schema", () => {
    // Section 4.4: `true` and `false` ARE schemas, so neither is malformed.
    expect(() => build({ contains: true })).not.toThrow();
    expect(() => build({ contains: false })).not.toThrow();
  });
});

describe("the keywords that take a schema explain themselves alike", () => {
  it("states the two forms of section 4.4 in one phrase", () => {
    // A caller who reads a refusal from one keyword and then from another
    // reads one library, not two conventions, so the phrase naming what a
    // schema may be is written once and shared by every keyword that wants
    // one — including the positions of the tuple form of `items`.
    const rest = refusalFrom(() => build(tupleOf(5)));
    const contains = refusalFrom(() => build({ contains: 5 }));
    const position = refusalFrom(() => build({ items: [7] }));

    expect(rest.reason).toBe("the value must be an object or a boolean");
    expect(contains.reason).toBe(rest.reason);
    expect(position.reason).toContain("must be an object or a boolean");
  });
});
