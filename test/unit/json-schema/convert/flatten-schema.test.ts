// ===========================================================================
// test/unit/json-schema/convert/flatten-schema.test.ts
//
// Path derivation, `$ref` following, recursion termination, and the two things
// the converter is required to be LOUD about: a keyword from another dialect,
// and a rule-bearing keyword on the document ROOT, which has no declarable
// path. 1.x was silent about both.
// ===========================================================================
import {
  buildFieldEntries,
  fromJsonSchema,
} from "../../../../src/json-schema/build-from-schema";
import {
  collectRootNodes,
  flattenSchema,
  joinDeclaredPath,
} from "../../../../src/json-schema/flatten-schema";
import { readChildSchemas } from "../../../../src/json-schema/schema-to-declarations";
import { ROOT_PATH } from "../../../../src/compile/declared-child-keys";
import { RefResolutionError } from "../../../../src/json-schema/ref-resolution-error";
import { UnsupportedKeywordError } from "../../../../src/json-schema/unsupported-keyword-error";
import { PathSyntaxError } from "../../../../src/path/reserved-segment";
import { jsonSchemaBagFixture } from "./json-schema-bag-fixture";

const build = (schema: unknown) => fromJsonSchema(jsonSchemaBagFixture, schema);
const paths = (schema: unknown): readonly string[] =>
  buildFieldEntries(jsonSchemaBagFixture, schema).map((entry) => entry.path);

describe("joinDeclaredPath", () => {
  it("trails `[*]` and dots everything else", () => {
    expect(joinDeclaredPath("", "a")).toBe("a");
    expect(joinDeclaredPath("a", "b")).toBe("a.b");
    expect(joinDeclaredPath("a", "[*]")).toBe("a[*]");
    expect(joinDeclaredPath("a[*]", "b")).toBe("a[*].b");
  });

  it("refuses a property name the path grammar cannot express", () => {
    expect(() => joinDeclaredPath("a", "has.dot")).toThrow(PathSyntaxError);
    expect(() => joinDeclaredPath("a", "b[0]")).toThrow(PathSyntaxError);
  });

  it("makes a property actually named __proto__ a declared path", () => {
    // JSON.parse gives a real OWN "__proto__" key; an object literal would
    // only have set the prototype, which is not what a document does.
    // Refusing by name was dropped; pollution is closed on the writing side.
    const document: unknown = JSON.parse(
      String.raw`{"properties":{"__proto__":{"type":"string"}}}`
    );
    expect(paths(document)).toContain("__proto__");
  });
});

describe("$ref", () => {
  const SCHEMA = {
    definitions: {
      address: {
        type: "object",
        properties: { zip: { type: "string", minLength: 5 } },
        required: ["zip"],
      },
    },
    properties: { home: { $ref: "#/definitions/address" } },
  };

  it("declares the TARGET's paths under the referring key", () => {
    expect(paths(SCHEMA)).toEqual(["home", "home.zip"]);
  });

  it("applies the target's constraints", () => {
    const validator = build(SCHEMA);
    expect(validator.validate({ home: { zip: "12345" } }).valid).toBe(true);
    expect(validator.validate({ home: { zip: "1" } }).valid).toBe(false);
    expect(validator.validate({ home: {} }).valid).toBe(false);
  });

  it("follows the 2019-09 `$defs` spelling too", () => {
    expect(
      paths({
        $defs: { small: { properties: { n: {} } } },
        properties: { a: { $ref: "#/$defs/small" } },
      })
    ).toEqual(["a", "a.n"]);
  });

  it("throws on an external or dangling reference", () => {
    expect(() =>
      paths({ properties: { a: { $ref: "https://example.com/s.json" } } })
    ).toThrow(RefResolutionError);
    expect(() => paths({ properties: { a: { $ref: "#/nope" } } })).toThrow(
      RefResolutionError
    );
  });

  it("terminates on a RECURSIVE definition instead of declaring forever", () => {
    const recursive = {
      definitions: {
        node: {
          properties: {
            name: { type: "string" },
            child: { $ref: "#/definitions/node" },
          },
        },
      },
      properties: { tree: { $ref: "#/definitions/node" } },
    };
    // The chain stops the first time the SAME pointer comes round again: the
    // declared paths of a recursive definition are infinite and Luq declares
    // finite ones. objectRecursively is the plugin for that shape and it is
    // not in the JSON Schema bag.
    expect(paths(recursive)).toEqual(["tree", "tree.name", "tree.child"]);
    const validator = build(recursive);
    expect(validator.validate({ tree: { name: "a" } }).valid).toBe(true);
    expect(validator.validate({ tree: { name: 1 } }).valid).toBe(false);
  });

  it("terminates on a recursive definition inside an applicator", () => {
    const recursive = {
      definitions: {
        node: { anyOf: [{ $ref: "#/definitions/node" }, { type: "string" }] },
      },
      properties: { a: { $ref: "#/definitions/node" } },
    };
    expect(build(recursive).validate({ a: "x" }).valid).toBe(true);
  });
});

describe("the document root", () => {
  it("distributes `required` and merges `allOf` arms", () => {
    const schema = {
      allOf: [
        { properties: { a: { type: "string" } } },
        { properties: { b: { type: "number" } }, required: ["b"] },
      ],
    };
    expect(paths(schema)).toEqual(["a", "b"]);
    const validator = build(schema);
    expect(validator.validate({ a: "x", b: 1 }).valid).toBe(true);
    expect(validator.validate({ a: 1, b: 1 }).valid).toBe(false);
    expect(validator.validate({ a: "x" }).valid).toBe(false);
  });

  it("resolves a root `$ref`", () => {
    expect(
      paths({
        $ref: "#/definitions/root",
        definitions: { root: { properties: { a: {} } } },
      })
    ).toEqual(["a"]);
  });

  it("collects the root and its allOf arms, transitively", () => {
    expect(
      collectRootNodes({ allOf: [{ allOf: [{ title: "leaf" }] }] })
    ).toHaveLength(3);
  });

  it("DECLARES the root path for a rule-bearing root keyword", () => {
    // 1.x skipped the `path === ""` entry and called `.strict()`, which has no
    // runtime effect, so every one of these was silently lost. Step 25 threw.
    // Now each one becomes a declaration at ROOT_PATH that carries the keyword.
    for (const rootSchema of [
      { additionalProperties: false, properties: { a: {} } },
      { minProperties: 2 },
      { anyOf: [{ properties: { a: {} } }] },
      { if: { properties: { a: {} } }, then: {} },
      { patternProperties: { "^a": {} } },
      { propertyNames: { maxLength: 1 } },
      { dependencies: { a: ["b"] } },
      { not: { properties: { a: {} } } },
    ]) {
      expect(paths(rootSchema)).toContain(ROOT_PATH);
    }
  });

  it("keeps `properties` in the root node so declaredSiblingKeys survives", () => {
    // The residual node is what createStructuralContext reads the allowed key
    // set from; dropping `properties` with the other distributed keywords would
    // make a root `additionalProperties: false` reject every property, which is
    // exactly the 1.x defect recorded in json-schema-mapping.md.
    const declarations = flattenSchema(
      { additionalProperties: false, properties: { a: {} }, required: ["a"] },
      readChildSchemas
    );
    const root = declarations.find(
      (declaration) => declaration.path === ROOT_PATH
    );
    expect(Object.keys(root?.schema ?? {}).sort()).toEqual([
      "additionalProperties",
      "properties",
    ]);
    expect(root?.isRequired).toBe(false);
  });

  it("declares one root entry per allOf arm that carries a rule", () => {
    const declarations = flattenSchema(
      { allOf: [{ minProperties: 1 }, { maxProperties: 3 }] },
      readChildSchemas
    );
    expect(
      declarations.filter((declaration) => declaration.path === ROOT_PATH)
    ).toHaveLength(2);
  });

  it("declares NO root entry when every root keyword is distributed", () => {
    expect(
      paths({ type: "object", properties: { a: {} }, required: ["a"] })
    ).toEqual(["a"]);
  });

  it("keeps the annotations and the containers silent", () => {
    expect(() =>
      paths({
        $schema: "http://json-schema.org/draft-07/schema#",
        $id: "urn:x",
        title: "t",
        description: "d",
        default: {},
        examples: [],
        readOnly: false,
        writeOnly: false,
        $comment: "c",
        type: "object",
        definitions: {},
        properties: { a: {} },
      })
    ).not.toThrow();
  });
});

describe("keywords from another dialect", () => {
  it("throws, naming the keyword and the dialect", () => {
    expect(() =>
      build({ properties: { a: { dependentRequired: { x: ["y"] } } } })
    ).toThrow(UnsupportedKeywordError);
    expect(() =>
      build({ properties: { a: { unevaluatedProperties: false } } })
    ).toThrow(UnsupportedKeywordError);
    expect(() => build({ properties: { a: { prefixItems: [] } } })).toThrow(
      UnsupportedKeywordError
    );
  });

  it("ignores a name it has never heard of (§4.3.2)", () => {
    expect(() =>
      build({ properties: { a: { "x-vendor-thing": 1 } } })
    ).not.toThrow();
    expect(
      build({ properties: { a: { "x-vendor-thing": 1 } } }).validate({ a: 1 })
        .valid
    ).toBe(true);
  });
});

describe("flattenSchema", () => {
  it("is a pure function of the document and the child reader", () => {
    const schema = { properties: { a: { properties: { b: {} } } } };
    expect(flattenSchema(schema, readChildSchemas)).toEqual(
      flattenSchema(schema, readChildSchemas)
    );
  });
});
