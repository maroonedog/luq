// ===========================================================================
// test/unit/json-schema/convert/flatten-schema.test.ts
//
// Path derivation, `$ref` following, recursion termination, and the two things
// the converter is required to be LOUD about: a keyword from another dialect,
// and a rule-bearing keyword on the document ROOT, which has no declarable
// path. 1.x was silent about both.
//
// Arrays nested inside arrays are here rather than with the array keywords
// because what they exercise is the DECLARED PATH: one `[*]` step per
// dimension, and where a tuple stops the stepping because its positions
// disagree.
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
const firstIssue = (
  schema: unknown,
  value: unknown
): { path: string; code: string; message: string } => {
  const result = build(schema).validate(value);
  const issue = result.issues[0];
  if (issue === undefined) throw new Error("expected the value to be refused");
  return { path: issue.path, code: issue.code, message: issue.message };
};

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

describe("flatten-array-schema: arrays nested inside arrays", () => {
  it("declares one `[*]` step per dimension", () => {
    // `items` of `items` is a SECOND element declaration, not a rule on the
    // outer one, so the inner element gets a path of its own and an issue
    // carries both real indices.
    const matrix = {
      properties: {
        grid: {
          type: "array",
          items: { type: "array", items: { type: "number" } },
        },
      },
    };
    expect(paths(matrix)).toEqual(["grid", "grid[*]", "grid[*][*]"]);
    expect(build(matrix).validate({ grid: [[1, 2], [3]] }).valid).toBe(true);
    expect(firstIssue(matrix, { grid: [[1, "x"]] })).toEqual({
      path: "grid[0][1]",
      code: "type",
      message: "Value must be of type number, but got string",
    });
  });

  it("declares neither dimension's element as a required one", () => {
    // An element declaration is a place for rules, not a demand that the place
    // be filled: `items` says what an element must look like IF there is one,
    // so an array with a hole at either dimension is accepted and nothing is
    // reported as missing. Without this the element step could be declared
    // present-or-else and every test above would still pass, because the
    // documents they validate have no holes.
    const matrix = {
      properties: {
        grid: {
          type: "array",
          items: { type: "array", items: { type: "number" } },
        },
      },
    };
    const validator = build(matrix);
    expect(validator.validate({ grid: [undefined] }).issues).toEqual([]);
    expect(validator.validate({ grid: [[undefined]] }).issues).toEqual([]);
  });

  it("carries the element object's own properties under both steps", () => {
    const cells = {
      properties: {
        grid: {
          items: { items: { properties: { value: { type: "string" } } } },
        },
      },
    };
    expect(paths(cells)).toEqual([
      "grid",
      "grid[*]",
      "grid[*][*]",
      "grid[*][*].value",
    ]);
    expect(firstIssue(cells, { grid: [[{ value: 1 }]] }).path).toBe(
      "grid[0][0].value"
    );
  });

  it("gives a tuple nested inside an array no child step of its own", () => {
    // Position 0 and position 1 obey DIFFERENT schemas, and one declared `[*]`
    // cannot say that, so the tuple form stays a rule on the array it
    // constrains. The outer array still declares its own element.
    const rows = {
      properties: {
        rows: { items: { items: [{ type: "string" }, { type: "number" }] } },
      },
    };
    expect(paths(rows)).toEqual(["rows", "rows[*]"]);
    const validator = build(rows);
    expect(
      validator.validate({
        rows: [
          ["a", 1],
          ["b", 2],
        ],
      }).valid
    ).toBe(true);
    // The refusal is pinned to the exact issue, not merely to `valid: false`:
    // the OUTER index reaches the path because the composite is a rule on the
    // declared `rows[*]`, and the INNER position reaches the message because it
    // is the loop counter the composite attaches to its detail.
    expect(
      firstIssue(rows, {
        rows: [
          ["a", 1],
          [9, 2],
        ],
      })
    ).toEqual({
      path: "rows[1]",
      code: "items",
      message: "Element 0 does not match the schema declared for it",
    });
  });

  it("reports the failing position on the array that owns the tuple", () => {
    const rows = {
      properties: {
        rows: { items: { items: [{ type: "string" }, { type: "number" }] } },
      },
    };
    expect(
      firstIssue(rows, {
        rows: [
          ["a", 1],
          ["b", "no"],
        ],
      })
    ).toEqual({
      path: "rows[1]",
      code: "items",
      message: "Element 1 does not match the schema declared for it",
    });
  });

  it("judges the extras of a nested tuple with `additionalItems`", () => {
    const rows = {
      properties: {
        rows: {
          items: {
            items: [{ type: "string" }],
            additionalItems: { type: "number" },
          },
        },
      },
    };
    const validator = build(rows);
    expect(validator.validate({ rows: [["a", 1, 2]] }).valid).toBe(true);
    // Naming the position proves the REST schema judged element 2 — the third
    // element, past the single declared position — and not something else that
    // also happens to refuse the document.
    expect(firstIssue(rows, { rows: [["a", 1, "b"]] })).toEqual({
      path: "rows[0]",
      code: "items",
      message: "Element 2 does not match the schema declared for it",
    });
    // A short inner array is valid (§9.3.1): there is nothing for the rest
    // schema to judge, so it judges nothing.
    expect(validator.validate({ rows: [[]] }).valid).toBe(true);
  });

  it("closes a nested tuple with `additionalItems: false`", () => {
    const rows = {
      properties: {
        rows: {
          items: { items: [{ type: "string" }], additionalItems: false },
        },
      },
    };
    const validator = build(rows);
    expect(validator.validate({ rows: [["a"]] }).valid).toBe(true);
    // `additionalItems: false` becomes the schema that matches nothing, so the
    // refusal arrives as the tuple rule naming the extra element's position —
    // element 1, the first one past the single declared position.
    expect(firstIssue(rows, { rows: [["a", "b"]] })).toEqual({
      path: "rows[0]",
      code: "items",
      message: "Element 1 does not match the schema declared for it",
    });
  });

  it("follows a `$ref` carried by `items`", () => {
    const schema = {
      definitions: {
        point: { properties: { x: { type: "number" } }, required: ["x"] },
      },
      properties: { path: { items: { $ref: "#/definitions/point" } } },
    };
    expect(paths(schema)).toEqual(["path", "path[*]", "path[*].x"]);
    const validator = build(schema);
    expect(validator.validate({ path: [{ x: 1 }] }).valid).toBe(true);
    // Both refusals are pinned to the element's own declared path, which is
    // what proves the target's constraints landed UNDER `[*]` rather than on
    // the array itself or nowhere at all.
    expect(firstIssue(schema, { path: [{ x: "no" }] })).toEqual({
      path: "path[0].x",
      code: "type",
      message: "Value must be of type number, but got string",
    });
    expect(firstIssue(schema, { path: [{}] })).toEqual({
      path: "path[0]",
      code: "required",
      message: "Missing required property: x",
    });
  });

  it("terminates when `items` refers back to the definition that owns it", () => {
    // The declared paths of an array of itself are infinite; the walk stops the
    // first time the same pointer comes round again.
    const tree = {
      definitions: {
        node: {
          properties: {
            name: { type: "string" },
            kids: { items: { $ref: "#/definitions/node" } },
          },
        },
      },
      properties: { root: { $ref: "#/definitions/node" } },
    };
    expect(paths(tree)).toEqual([
      "root",
      "root.name",
      "root.kids",
      "root.kids[*]",
    ]);
    const validator = build(tree);
    expect(validator.validate({ root: { name: "a", kids: [] } }).valid).toBe(
      true
    );
    // The dimension that WAS declared still carries the definition's rules.
    expect(firstIssue(tree, { root: { name: 1, kids: [] } })).toEqual({
      path: "root.name",
      code: "type",
      message: "Value must be of type string, but got number",
    });
    // And the one past the stop carries none: `root.kids[*]` exists as a path
    // but the definition was not expanded under it a second time, so a kid's
    // own `name` is unjudged. That asymmetry is exactly what terminating means,
    // and a walk that ran one level further would report an issue here.
    expect(
      validator.validate({ root: { name: "a", kids: [{ name: 2 }] } }).issues
    ).toEqual([]);
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

  it("raises a repeated child to required when a later arm requires it", () => {
    // The same key is declared twice across the merged root nodes. The FIRST
    // declaration keeps its schema — which is why `tags[*]` survives, since
    // only that one carries `items` — and the later arm contributes presence
    // and nothing else.
    const declarations = flattenSchema(
      {
        properties: { tags: { items: { type: "string" } } },
        allOf: [
          { properties: { tags: { type: "array" } }, required: ["tags"] },
        ],
      },
      readChildSchemas
    );
    expect(declarations.map((declaration) => declaration.path)).toEqual([
      "tags",
      "tags[*]",
    ]);
    expect(
      declarations.find((declaration) => declaration.path === "tags")
        ?.isRequired
    ).toBe(true);
  });

  it("does not lower a required child that a later arm repeats", () => {
    // Presence only ever goes one way: an arm that says nothing about
    // `required` says nothing, it does not make the child optional again.
    const declarations = flattenSchema(
      {
        properties: { tags: { items: { type: "string" } } },
        required: ["tags"],
        allOf: [{ properties: { tags: { type: "array" } } }],
      },
      readChildSchemas
    );
    expect(declarations.map((declaration) => declaration.path)).toEqual([
      "tags",
      "tags[*]",
    ]);
    expect(
      declarations.find((declaration) => declaration.path === "tags")
        ?.isRequired
    ).toBe(true);
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
