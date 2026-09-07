// ===========================================================================
// test/unit/json-schema/convert/build-from-schema.test.ts
//
// The end-to-end shape: a document in, a working validator out. 1.x failed 32
// of its 42 fromJsonSchema integration suites and the failures were all of this
// kind — a validator that said `valid: true` about a value the schema forbids.
// Every assertion below therefore checks BOTH directions.
// ===========================================================================
import {
  NotASchemaError,
  buildFieldEntries,
  buildFromSchema,
  fromJsonSchema,
} from "../../../../src/json-schema/build-from-schema";
import { jsonSchemaBagFixture } from "./json-schema-bag-fixture";

const build = (schema: unknown) => fromJsonSchema(jsonSchemaBagFixture, schema);

interface Person {
  readonly name: string;
  readonly age?: number;
  readonly tags?: readonly string[];
}

const PERSON_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 2, maxLength: 8 },
    age: { type: "integer", minimum: 0, maximum: 150 },
    tags: { type: "array", items: { type: "string" }, minItems: 1 },
  },
  required: ["name"],
};

describe("buildFromSchema", () => {
  it("accepts a document the schema permits", () => {
    const validator = build(PERSON_SCHEMA);
    expect(
      validator.validate({ name: "ada", age: 36, tags: ["x"] }).valid
    ).toBe(true);
  });

  it("enforces every scalar keyword it converted", () => {
    const validator = build(PERSON_SCHEMA);
    expect(validator.validate({ name: "a" }).valid).toBe(false);
    expect(validator.validate({ name: "abcdefghi" }).valid).toBe(false);
    expect(validator.validate({ name: "ada", age: -1 }).valid).toBe(false);
    expect(validator.validate({ name: "ada", age: 1.5 }).valid).toBe(false);
    expect(validator.validate({ name: "ada", tags: [] }).valid).toBe(false);
  });

  it("enforces `type`, which 1.x never asserted at all", () => {
    const validator = build(PERSON_SCHEMA);
    expect(validator.validate({ name: 42 }).valid).toBe(false);
    expect(validator.validate({ name: "ada", age: "36" }).valid).toBe(false);
    expect(validator.validate({ name: "ada", tags: "x" }).valid).toBe(false);
  });

  it("reports the failing path in the L1 grammar", () => {
    const validator = build({
      properties: {
        rows: {
          items: { properties: { n: { type: "number" } } },
        },
      },
    });
    const outcome = validator.validate({ rows: [{ n: 1 }, { n: "x" }] });
    expect(outcome.valid).toBe(false);
    if (outcome.valid) return;
    expect(outcome.issues[0]?.path).toBe("rows[1].n");
  });

  it("flattens nested properties into dotted declarations", () => {
    const entries = buildFieldEntries(jsonSchemaBagFixture, {
      properties: {
        user: {
          properties: {
            address: { properties: { street: { type: "string" } } },
          },
        },
      },
    });
    expect(entries.map((entry) => entry.path)).toEqual([
      "user",
      "user.address",
      "user.address.street",
    ]);
  });

  it("flattens `items` into a `[*]` declaration, at every depth", () => {
    const entries = buildFieldEntries(jsonSchemaBagFixture, {
      properties: {
        grid: { items: { items: { properties: { n: {} } } } },
      },
    });
    expect(entries.map((entry) => entry.path)).toEqual([
      "grid",
      "grid[*]",
      "grid[*][*]",
      "grid[*][*].n",
    ]);
  });

  it("declares a `required` name that has no `properties` entry", () => {
    const entries = buildFieldEntries(jsonSchemaBagFixture, {
      required: ["ticket"],
    });
    expect(entries.map((entry) => entry.path)).toEqual(["ticket"]);
    expect(build({ required: ["ticket"] }).validate({}).valid).toBe(false);
    expect(build({ required: ["ticket"] }).validate({ ticket: 1 }).valid).toBe(
      true
    );
  });

  it("treats the empty string as PRESENT for `required`", () => {
    // Deviation from `.required()`, which carries 1.x's form emptiness. See
    // src/json-schema/declare-presence.ts.
    const validator = build({
      properties: { name: { type: "string" } },
      required: ["name"],
    });
    expect(validator.validate({ name: "" }).valid).toBe(true);
    expect(validator.validate({}).valid).toBe(false);
  });

  it("rejects null unless `type` names null, and accepts it when it does", () => {
    expect(
      build({ properties: { a: { type: "string" } } }).validate({ a: null })
        .valid
    ).toBe(false);
    expect(
      build({ properties: { a: { type: ["string", "null"] } } }).validate({
        a: null,
      }).valid
    ).toBe(true);
    expect(build({ properties: { a: {} } }).validate({ a: null }).valid).toBe(
      true
    );
  });

  it("keeps `strict()` and the surface the builder hands out", () => {
    const surface = buildFromSchema(jsonSchemaBagFixture, PERSON_SCHEMA);
    expect(surface.strict().build().validate({ name: "ada" }).valid).toBe(true);
  });

  it("refuses a value that is not a schema", () => {
    expect(() => build(42)).toThrow(NotASchemaError);
    expect(() => build(null)).toThrow(NotASchemaError);
    expect(() => build("{}")).toThrow(NotASchemaError);
  });

  it("accepts the boolean schema form of §4.4", () => {
    expect(build({ properties: { a: true } }).validate({ a: 1 }).valid).toBe(
      true
    );
    expect(build({ properties: { a: false } }).validate({ a: 1 }).valid).toBe(
      false
    );
    expect(build({ properties: { a: false } }).validate({}).valid).toBe(true);
  });

  it("lets the caller supply the type, and defaults to a record", () => {
    const typed = fromJsonSchema<Person>(jsonSchemaBagFixture, PERSON_SCHEMA);
    expect(typed.pick("name").path).toBe("name");
    const untyped = fromJsonSchema(jsonSchemaBagFixture, PERSON_SCHEMA);
    expect(untyped.pick("name").path).toBe("name");
  });
});
