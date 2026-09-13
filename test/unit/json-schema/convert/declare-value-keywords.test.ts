// ===========================================================================
// test/unit/json-schema/convert/declare-value-keywords.test.ts
//
// `type` is the ONLY rule in the converter that judges the value's type, so a
// `type` the converter cannot read is not a small loss: the check disappears
// entirely and the field starts accepting null as well, because `permitsNull`
// reads the same list. Both consequences are asserted here from the document
// side, so a guard that throws but is never reached still fails this file.
// ===========================================================================
import {
  permitsNull,
  readDeclaredTypes,
} from "../../../../src/json-schema/declare-value-keywords";
import { MalformedSchemaError } from "../../../../src/json-schema/malformed-schema-error";
import {
  isDraft07Schema,
  isSchemaObject,
} from "../../../../src/json-schema/draft07.types";
import type { Draft07SchemaObject } from "../../../../src/json-schema/draft07.types";
import { fromJsonSchema } from "../../../../src/json-schema/build-from-schema";
import { refusalFrom } from "../malformed-schema-refusal";
import { jsonSchemaBagFixture } from "./json-schema-bag-fixture";

/** A malformed document is untyped by definition; this is the only door in. */
function schemaObject(document: unknown): Draft07SchemaObject {
  if (!isDraft07Schema(document) || !isSchemaObject(document)) {
    throw new Error("the fixture is not a schema object");
  }
  return document;
}

const build = (schema: unknown) => fromJsonSchema(jsonSchemaBagFixture, schema);

describe("readDeclaredTypes refuses a `type` the meta-schema forbids", () => {
  it("refuses a name that is not one of the seven", () => {
    const error = refusalFrom(() =>
      readDeclaredTypes(schemaObject({ type: "strig" }))
    );
    expect(error.keyword).toBe("type");
    expect(error.received).toBe('"strig"');
    expect(error.message).toContain("strig");
  });

  it("refuses null before the lookup coerces it to the name `null`", () => {
    // `hasOwnProperty.call(table, null)` answers TRUE: the key is coerced to
    // the string "null", so an unguarded lookup reads `{"type": null}` as
    // `{"type": "null"}` and silently changes what the document says.
    const error = refusalFrom(() =>
      readDeclaredTypes(schemaObject({ type: null }))
    );
    expect(error.keyword).toBe("type");
    expect(error.received).toBe("null");
  });

  it("refuses a member of the array form that is not a string", () => {
    expect(() =>
      readDeclaredTypes(schemaObject({ type: ["string", 3] }))
    ).toThrow(MalformedSchemaError);
    expect(() => readDeclaredTypes(schemaObject({ type: [null] }))).toThrow(
      MalformedSchemaError
    );
  });

  it("refuses an unknown name inside the array form", () => {
    expect(() =>
      readDeclaredTypes(schemaObject({ type: ["string", "strig"] }))
    ).toThrow(MalformedSchemaError);
  });

  it("refuses the empty array, which the meta-schema gives minItems 1", () => {
    const error = refusalFrom(() =>
      readDeclaredTypes(schemaObject({ type: [] }))
    );
    expect(error.keyword).toBe("type");
    expect(error.received).toBe("[]");
  });

  it("refuses a value that is neither a string nor an array", () => {
    expect(() => readDeclaredTypes(schemaObject({ type: 7 }))).toThrow(
      MalformedSchemaError
    );
    expect(() =>
      readDeclaredTypes(schemaObject({ type: { name: "string" } }))
    ).toThrow(MalformedSchemaError);
  });

  it("still reads every well-formed `type` it is given", () => {
    const seven = [
      "string",
      "number",
      "integer",
      "boolean",
      "array",
      "object",
      "null",
    ];
    for (const name of seven) {
      expect(readDeclaredTypes(schemaObject({ type: name }))).toEqual([name]);
    }
    expect(readDeclaredTypes(schemaObject({ type: seven }))).toEqual(seven);
    expect(readDeclaredTypes(schemaObject({}))).toEqual([]);
  });
});

describe("permitsNull answers only for a document it can read", () => {
  it("throws instead of answering true for an unreadable `type`", () => {
    // Answering `true` here is the second half of the same defect: the field
    // is declared nullable because the list came back empty.
    expect(() => permitsNull(schemaObject({ type: "strig" }))).toThrow(
      MalformedSchemaError
    );
  });

  it("still answers for the forms it can read", () => {
    expect(permitsNull(schemaObject({}))).toBe(true);
    expect(permitsNull(schemaObject({ type: ["string", "null"] }))).toBe(true);
    expect(permitsNull(schemaObject({ type: "string" }))).toBe(false);
  });
});

describe("the refusal reaches the converter", () => {
  it("refuses the document at build time rather than dropping the check", () => {
    // Before the guard this built a validator with NO type rule at all, so
    // `{ a: 42 }` was accepted against `{"type":"strig"}`.
    expect(() => build({ properties: { a: { type: "strig" } } })).toThrow(
      MalformedSchemaError
    );
  });

  it("still converts a document whose `type` is well formed", () => {
    const validator = build({ properties: { a: { type: "string" } } });
    expect(validator.validate({ a: "ok" }).valid).toBe(true);
    expect(validator.validate({ a: 42 }).valid).toBe(false);
  });
});

describe("`type: integer` reports one failure, not two", () => {
  // Every issue must be distinguishable by (path, code): that pair is what a
  // machine consumer groups and de-duplicates on. `type: "integer"` used to
  // produce TWO issues at the same path both coded `type` — the type check,
  // whose own test is `Number.isInteger`, and a second rule built from the
  // numberInteger plugin with its code overridden to `type`. A consumer
  // de-duplicating the pair silently dropped one and could not tell it had.
  const integerField = { properties: { a: { type: "integer" } } };
  const everyIssue = { abortEarly: false, abortEarlyOnEachField: false };

  it("reports a non-integer number once", () => {
    const outcome = build(integerField).validate({ a: 1.5 }, everyIssue);
    expect(outcome.valid).toBe(false);
    if (outcome.valid) return;
    expect(outcome.issues.map((issue) => [issue.path, issue.code])).toEqual([
      ["a", "type"],
    ]);
  });

  it("reports a value of the wrong type once", () => {
    const outcome = build(integerField).validate({ a: "no" }, everyIssue);
    expect(outcome.valid).toBe(false);
    if (outcome.valid) return;
    expect(outcome.issues).toHaveLength(1);
  });

  it("still accepts an integer, and still refuses a fraction", () => {
    expect(build(integerField).validate({ a: 7 }).valid).toBe(true);
    expect(build(integerField).validate({ a: 7.5 }).valid).toBe(false);
  });

  it("keeps the union form working, where integer is one member of several", () => {
    const union = build({ properties: { a: { type: ["integer", "string"] } } });
    expect(union.validate({ a: "abc" }).valid).toBe(true);
    expect(union.validate({ a: 7 }).valid).toBe(true);
    expect(union.validate({ a: 1.5 }).valid).toBe(false);
    expect(union.validate({ a: true }).valid).toBe(false);
  });
});
