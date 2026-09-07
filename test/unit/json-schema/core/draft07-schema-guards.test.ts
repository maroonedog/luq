// ===========================================================================
// test/unit/json-schema/core/draft07-schema-guards.test.ts
//
// Draft-07 section 4.4 lets a schema BE a boolean. 1.x's converter tested
// `typeof x === "object"` and dropped every boolean schema on the builder
// path, so the guards that separate the two forms are worth their own tests.
// ===========================================================================
import {
  isDraft07Schema,
  isSchemaObject,
  type Draft07Schema,
} from "../../../../src/json-schema/draft07.types";

describe("isDraft07Schema", () => {
  it("accepts both forms a schema may take", () => {
    expect(isDraft07Schema(true)).toBe(true);
    expect(isDraft07Schema(false)).toBe(true);
    expect(isDraft07Schema({})).toBe(true);
    expect(isDraft07Schema({ type: "string" })).toBe(true);
  });

  it("rejects everything that is not a schema", () => {
    expect(isDraft07Schema(null)).toBe(false);
    expect(isDraft07Schema(undefined)).toBe(false);
    expect(isDraft07Schema([])).toBe(false);
    expect(isDraft07Schema([{ type: "string" }])).toBe(false);
    expect(isDraft07Schema("string")).toBe(false);
    expect(isDraft07Schema(7)).toBe(false);
  });
});

describe("isSchemaObject", () => {
  it("separates the boolean form from the object form", () => {
    expect(isSchemaObject(true)).toBe(false);
    expect(isSchemaObject(false)).toBe(false);
    expect(isSchemaObject({ type: "string" })).toBe(true);
  });

  it("narrows so the keywords are reachable without an assertion", () => {
    const schema: Draft07Schema = { minLength: 3, type: "string" };
    const minLength = isSchemaObject(schema) ? schema.minLength : undefined;
    expect(minLength).toBe(3);
  });

  it("gives the boolean form no keywords to read", () => {
    const schema: Draft07Schema = false;
    const minLength = isSchemaObject(schema) ? schema.minLength : undefined;
    expect(minLength).toBeUndefined();
  });
});
