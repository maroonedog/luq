// ===========================================================================
// test/unit/json-schema/convert/assert-object-keyword-values.test.ts
//
// The object-family keyword VALUES, each of which used to fail in a way that
// was not a refusal: `required: "name"` declared one phantom child per
// CHARACTER at the root and threw a raw TypeError from inside validate() when
// it sat on a nested object; `properties: {a: null}` threw while reading a
// pointer off null; `additionalProperties: "false"` built a validator that
// accepted every extra property, which is the opposite of what the document
// says; and `patternProperties: {"^a": "x"}`, `propertyNames: 5` and
// `dependencies: {a: 5}` each handed a primitive to the sub-schema walker,
// which finds no keys on it and yields a branch that passes everything.
//
// Every case here therefore asserts the refusal happens at BUILD time: a
// validator that enforces less than its document must never come into
// existence. Each family also keeps a case for the legal forms, because a
// guard that refuses a well-formed document is the same bug pointed the other
// way — most of all `dependencies`, where §6.5.7 makes an array of property
// names and a schema equally lawful under the same key.
// ===========================================================================
import { fromJsonSchema } from "../../../../src/json-schema/build-from-schema";
import { readRefPointer } from "../../../../src/json-schema/collect-definitions";
import {
  createExpansionBudget,
  createStructuralContext,
} from "../../../../src/json-schema/create-structural-context";
import { declareRequiredProperties } from "../../../../src/json-schema/declare-required-properties";
import type {
  Draft07Schema,
  Draft07SchemaObject,
} from "../../../../src/json-schema/draft07.types";
import { MalformedSchemaError } from "../../../../src/json-schema/malformed-schema-error";
import { refusalFrom } from "../malformed-schema-refusal";
import { createLocalScope } from "../../../../src/json-schema/ref-scope";
import { DEFAULT_GLOBAL_CONFIG } from "../../../../src/types/global-config";
import { jsonSchemaBagFixture } from "./json-schema-bag-fixture";

const build = (schema: unknown) => fromJsonSchema(jsonSchemaBagFixture, schema);

const EMPTY_DOCUMENT: Draft07SchemaObject = {};

/** A context of the shape the converter threads through every sub-schema. */
const contextForDeclaring = () =>
  createStructuralContext(
    {
      bag: jsonSchemaBagFixture,
      scope: createLocalScope(EMPTY_DOCUMENT),
      chain: {
        fieldPath: "a",
        declaredSiblingKeys: [],
        config: DEFAULT_GLOBAL_CONFIG,
      },
      budget: createExpansionBudget(),
    },
    EMPTY_DOCUMENT,
    []
  );

/** The refusal the BUILD raised, so a case can assert on the keyword it names. */
const refusalOf = (schema: unknown): MalformedSchemaError =>
  refusalFrom(() => build(schema));

describe("`required` values", () => {
  it("refuses a bare string at the root instead of declaring one path per character", () => {
    const error = refusalOf({
      type: "object",
      properties: { name: { type: "string" } },
      required: "name",
    });
    expect(error.keyword).toBe("required");
    expect(error.received).toBe('"name"');
  });

  it("refuses a bare string on a NESTED object at build time", () => {
    // The worst of the four shapes: this one used to build successfully and
    // throw `required.filter is not a function` on the first request.
    expect(() =>
      build({
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: { name: { type: "string" } },
            required: "name",
          },
        },
      })
    ).toThrow(MalformedSchemaError);
  });

  it("refuses a bare string inside a composed branch", () => {
    expect(() => build({ anyOf: [{ required: "name" }] })).toThrow(
      MalformedSchemaError
    );
  });

  it("refuses an array that is not all strings, and the non-array forms", () => {
    for (const bad of [[1, 2], true, { name: true }, "name"]) {
      expect(() =>
        build({ type: "object", properties: { a: {} }, required: bad })
      ).toThrow(MalformedSchemaError);
    }
  });

  it("accepts a repeated name, which asks for nothing the single name does not", () => {
    const validator = build({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "string" } },
      required: ["a", "a"],
    });
    expect(validator.validate({ a: "x" }).valid).toBe(true);
    expect(validator.validate({ b: "x" }).valid).toBe(false);
  });

  it("refuses to build the object rule around a non-array", () => {
    // declareRequiredProperties is asked for its rules BEFORE a node's children
    // are read (collect-sub-schema-rules expands the node's own rules first),
    // and the rule it returns calls `.filter` on `required` at VALIDATION time.
    // The node is parsed rather than written as a literal because that is where
    // one really comes from: the declared type cannot be trusted about JSON.
    const node: Draft07SchemaObject = JSON.parse('{"required":"name"}');
    expect(() =>
      declareRequiredProperties(node, contextForDeclaring())
    ).toThrow(MalformedSchemaError);
  });

  it("still declares a required child from a well-formed list", () => {
    const validator = build({
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    });
    expect(validator.validate({ name: "x" }).valid).toBe(true);
    expect(validator.validate({}).valid).toBe(false);
  });
});

describe("`properties` values", () => {
  it("refuses null under a property key and names the key", () => {
    const error = refusalOf({ type: "object", properties: { a: null } });
    expect(error.keyword).toBe("properties");
    expect(error.reason).toContain('"a"');
    expect(error.received).toBe("null");
  });

  it("refuses a string, a number and an array under a property key", () => {
    for (const bad of ["", 7, ["a"]]) {
      expect(() => build({ properties: { a: bad } })).toThrow(
        MalformedSchemaError
      );
    }
  });

  it("refuses a `properties` that is not a map of schemas", () => {
    const error = refusalOf({ type: "object", properties: "name" });
    expect(error.keyword).toBe("properties");
    // The REASON is asserted, not just the keyword: a string that reached the
    // per-member loop would also refuse, because Object.entries walks it
    // character by character and a character is not a schema — but it would
    // then report `the schema under "0"`, blaming an index the document never
    // wrote. A whole value of the wrong shape has to be explained as one.
    expect(error.reason).toBe(
      "the value must be an object mapping property names to schemas"
    );
  });

  it("keeps the boolean schema form of §4.4 working under a property key", () => {
    expect(build({ properties: { a: true } }).validate({ a: 1 }).valid).toBe(
      true
    );
    expect(build({ properties: { a: false } }).validate({ a: 1 }).valid).toBe(
      false
    );
  });

  it("reads no pointer off a node that is not an object", () => {
    // The guard used to be "not a boolean", which counted null as something to
    // read `$ref` off. Parsing is how such a node really arrives: `null` under
    // a property key is valid JSON and the declared type cannot rule it out.
    const parsedNull: Draft07Schema = JSON.parse("null");
    expect(readRefPointer(parsedNull)).toBeUndefined();
    expect(readRefPointer(true)).toBeUndefined();
    expect(readRefPointer({ $ref: "#/definitions/a" })).toBe("#/definitions/a");
  });
});

describe("`additionalProperties` values", () => {
  it('refuses the string "false" rather than accepting every extra property', () => {
    const error = refusalOf({
      type: "object",
      properties: { a: { type: "string" } },
      additionalProperties: "false",
    });
    expect(error.keyword).toBe("additionalProperties");
    expect(error.received).toBe('"false"');
  });

  it("refuses a number and an array", () => {
    for (const bad of [0, 1, ["a"]]) {
      expect(() =>
        build({ properties: { a: {} }, additionalProperties: bad })
      ).toThrow(MalformedSchemaError);
    }
  });

  it("leaves the boolean form exactly as it was", () => {
    const closed = build({
      type: "object",
      properties: { a: { type: "string" } },
      additionalProperties: false,
    });
    expect(closed.validate({ a: "x" }).valid).toBe(true);
    expect(closed.validate({ a: "x", extra: 1 }).valid).toBe(false);
    const open = build({
      type: "object",
      properties: { a: { type: "string" } },
      additionalProperties: true,
    });
    expect(open.validate({ a: "x", extra: 1 }).valid).toBe(true);
  });

  it("leaves the schema form exactly as it was", () => {
    const typed = build({
      type: "object",
      properties: { a: { type: "string" } },
      additionalProperties: { type: "number" },
    });
    expect(typed.validate({ a: "x", extra: 1 }).valid).toBe(true);
    expect(typed.validate({ a: "x", extra: "no" }).valid).toBe(false);
  });
});

describe("`patternProperties` values", () => {
  it("refuses a string under a pattern rather than matching the pattern against nothing", () => {
    // The silent shape: "x" has no keys, so the walker yields an empty branch
    // and `{ab: 999}` — which the document says must be a string — passes.
    const error = refusalOf({
      type: "object",
      patternProperties: { "^a": "x" },
    });
    expect(error.keyword).toBe("patternProperties");
    expect(error.reason).toContain('"^a"');
    expect(error.received).toBe('"x"');
  });

  it("refuses null under a pattern rather than reading a pointer off it", () => {
    expect(() =>
      build({ type: "object", patternProperties: { "^a": null } })
    ).toThrow(MalformedSchemaError);
  });

  it("leaves a key that will not compile to the build, which still dies on it", () => {
    // The guard reads the keys but does not compile them: a second
    // `new RegExp` in the converter would break its rule that regex
    // construction happens in exactly one place, the `pattern` keyword's.
    // Nothing is under-enforced without it — the plugin compiles every key
    // while building its rule, so the build fails before a validator exists,
    // as a SyntaxError rather than as a typed refusal.
    expect(() =>
      build({ type: "object", patternProperties: { "^(": { type: "string" } } })
    ).toThrow(SyntaxError);
  });

  it("refuses a `patternProperties` that is not a map of schemas", () => {
    const error = refusalOf({ type: "object", patternProperties: "^a" });
    expect(error.keyword).toBe("patternProperties");
    // Named as the whole value, for the same reason `properties` is: walking
    // a string's characters would refuse too, and blame `the schema under
    // "0"` for a key the document never wrote.
    expect(error.reason).toBe(
      "the value must be an object mapping regular expressions to schemas"
    );
  });

  it("still constrains every key a well-formed pattern matches", () => {
    const validator = build({
      type: "object",
      patternProperties: { "^a": { type: "string" } },
    });
    expect(validator.validate({ ab: "x" }).valid).toBe(true);
    expect(validator.validate({ ab: 999 }).valid).toBe(false);
    expect(validator.validate({ zz: 999 }).valid).toBe(true);
  });

  it("keeps the boolean schema form of §4.4 working under a pattern", () => {
    const closed = build({
      type: "object",
      patternProperties: { "^a": false },
    });
    expect(closed.validate({ ab: 1 }).valid).toBe(false);
    expect(closed.validate({ zz: 1 }).valid).toBe(true);
  });
});

describe("`propertyNames` values", () => {
  it("refuses a number rather than constraining no name at all", () => {
    const error = refusalOf({ type: "object", propertyNames: 5 });
    expect(error.keyword).toBe("propertyNames");
    expect(error.received).toBe("5");
  });

  it("refuses null rather than reading a pointer off it", () => {
    expect(() => build({ type: "object", propertyNames: null })).toThrow(
      MalformedSchemaError
    );
  });

  it("refuses an array, which is a schema list's shape and not a schema", () => {
    expect(() =>
      build({ type: "object", propertyNames: [{ type: "string" }] })
    ).toThrow(MalformedSchemaError);
  });

  it("still constrains the names a well-formed schema describes", () => {
    const validator = build({
      type: "object",
      propertyNames: { pattern: "^a" },
    });
    expect(validator.validate({ ab: 1 }).valid).toBe(true);
    expect(validator.validate({ zz: 1 }).valid).toBe(false);
  });
});

describe("`dependencies` values", () => {
  it("refuses a number under a key rather than depending on nothing", () => {
    const error = refusalOf({ type: "object", dependencies: { a: 5 } });
    expect(error.keyword).toBe("dependencies");
    expect(error.reason).toContain('"a"');
    expect(error.received).toBe("5");
  });

  it("refuses null under a key rather than reading a pointer off it", () => {
    expect(() => build({ type: "object", dependencies: { a: null } })).toThrow(
      MalformedSchemaError
    );
  });

  it("refuses an array that is not all property names", () => {
    expect(() =>
      build({ type: "object", dependencies: { a: ["b", 3] } })
    ).toThrow(MalformedSchemaError);
  });

  it("refuses a `dependencies` that is not a map", () => {
    const error = refusalOf({ type: "object", dependencies: ["a"] });
    expect(error.keyword).toBe("dependencies");
    // An array's indices are keys to Object.entries, so a per-member walk
    // would refuse this too and call "a" a dependency under the key "0". The
    // array is what is wrong, and the reason has to say so.
    expect(error.reason).toBe(
      "the value must be an object mapping property names to schemas or to " +
        "arrays of property names"
    );
  });

  it("keeps the property-dependency array form of §6.5.7 working", () => {
    const validator = build({
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
      dependencies: { a: ["b"] },
    });
    expect(validator.validate({ a: 1, b: 2 }).valid).toBe(true);
    expect(validator.validate({ a: 1 }).valid).toBe(false);
    expect(validator.validate({ b: 2 }).valid).toBe(true);
  });

  it("keeps the schema-dependency form of §6.5.7 working", () => {
    const validator = build({
      type: "object",
      dependencies: { a: { required: ["b"] } },
    });
    expect(validator.validate({ a: 1, b: 2 }).valid).toBe(true);
    expect(validator.validate({ a: 1 }).valid).toBe(false);
    expect(validator.validate({ c: 3 }).valid).toBe(true);
  });

  it("keeps both forms working side by side under one `dependencies`", () => {
    const validator = build({
      type: "object",
      dependencies: { a: ["b"], c: { required: ["d"] } },
    });
    expect(validator.validate({ a: 1, b: 2 }).valid).toBe(true);
    expect(validator.validate({ a: 1 }).valid).toBe(false);
    expect(validator.validate({ c: 1 }).valid).toBe(false);
    expect(validator.validate({ c: 1, d: 2 }).valid).toBe(true);
  });
});
