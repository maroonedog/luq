// ===========================================================================
// The flagship bundle: one import, the whole of Draft-07.
//
// The two subpaths must be usable TOGETHER — 1.x let both claim
// `.fromJsonSchema` and picked a winner by registration order — so the first
// test here registers both plugins on one builder and asserts no collision.
// ===========================================================================
import { Builder } from "../../../../../src/index";
import {
  fromJsonSchema,
  jsonSchemaBag,
  jsonSchemaFullFeaturePlugin,
} from "../../../../../src/json-schema/extensions/json-schema-full-feature";
import { jsonSchemaPlugin } from "../../../../../src/json-schema/extensions/json-schema";
import { NotASchemaError } from "../../../../../src/json-schema";

function isValid(document: unknown, instance: unknown): boolean {
  return Builder()
    .use(jsonSchemaFullFeaturePlugin)
    .for<{ instance: unknown }>()
    .v("instance", (b) => b.any.jsonSchemaFullFeature(document))
    .build()
    .validate({ instance }).valid;
}

describe("plugin identity", () => {
  it("keeps the 1.x public name", () => {
    expect(jsonSchemaFullFeaturePlugin.name).toBe("jsonSchemaFullFeature");
  });

  it("claims a method the sibling bundle does not", () => {
    expect(jsonSchemaFullFeaturePlugin.method).not.toBe(
      jsonSchemaPlugin.method
    );
  });

  it("can be registered alongside the sibling bundle on one builder", () => {
    const validator = Builder()
      .use(jsonSchemaPlugin)
      .use(jsonSchemaFullFeaturePlugin)
      .for<{ a: unknown; b: unknown }>()
      .v("a", (chain) => chain.any.jsonSchema({ minimum: 3 }, jsonSchemaBag))
      .v("b", (chain) => chain.any.jsonSchemaFullFeature({ minimum: 3 }))
      .build();
    expect(validator.validate({ a: 4, b: 4 }).valid).toBe(true);
    expect(validator.validate({ a: 1, b: 4 }).valid).toBe(false);
    expect(validator.validate({ a: 4, b: 1 }).valid).toBe(false);
  });
});

describe("the chain method carries the bundled bag", () => {
  it("needs no bag argument", () => {
    expect(isValid({ type: "string", minLength: 2 }, "ab")).toBe(true);
    expect(isValid({ type: "string", minLength: 2 }, "a")).toBe(false);
  });

  it("builds the SAME rule the sibling builds from the same document", () => {
    const document = { type: "object", minProperties: 2 };
    const throughSibling = Builder()
      .use(jsonSchemaPlugin)
      .for<{ instance: unknown }>()
      .v("instance", (b) => b.any.jsonSchema(document, jsonSchemaBag))
      .build();
    expect(throughSibling.validate({ instance: { a: 1 } }).valid).toBe(
      isValid(document, { a: 1 })
    );
    expect(throughSibling.validate({ instance: { a: 1, b: 2 } }).valid).toBe(
      isValid(document, { a: 1, b: 2 })
    );
  });
});

describe("fromJsonSchema, the one-import route", () => {
  it("builds a validator over the declared paths", () => {
    const validator = fromJsonSchema<{ name: string; age: number }>({
      type: "object",
      properties: {
        name: { type: "string", minLength: 2 },
        age: { type: "integer", minimum: 0 },
      },
      required: ["name"],
    });
    expect(validator.validate({ name: "jo", age: 3 }).valid).toBe(true);
    expect(validator.validate({ name: "j", age: 3 }).valid).toBe(false);
    expect(validator.validate({ name: "jo", age: 1.5 }).valid).toBe(false);
    expect(validator.validate({ age: 3 }).valid).toBe(false);
  });

  it("reports the issue under the declared path, not under the root", () => {
    const validator = fromJsonSchema({
      type: "object",
      properties: { user: { properties: { age: { minimum: 0 } } } },
    });
    const outcome = validator.validate({ user: { age: -1 } });
    expect(outcome.valid).toBe(false);
    expect(outcome.valid === false ? outcome.issues[0]?.path : "").toBe(
      "user.age"
    );
  });

  it("refuses a value that is not a schema", () => {
    expect(() => fromJsonSchema(42)).toThrow(NotASchemaError);
  });

  it("parses as well as it validates", () => {
    const validator = fromJsonSchema<{ name: string }>({
      type: "object",
      properties: { name: { type: "string" } },
    });
    const parsed = validator.parse({ name: "jo" });
    expect(parsed.valid).toBe(true);
    expect(parsed.valid === true ? parsed.data.name : "").toBe("jo");
  });
});
