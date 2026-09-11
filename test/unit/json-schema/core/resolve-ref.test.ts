// ===========================================================================
// test/unit/json-schema/core/resolve-ref.test.ts
//
// The cycle tests are the ones that matter: 1.x had a recursive resolver that
// detected cycles and a one-step resolver that did not, and only the one that
// did not was ever called. A cycle here must be an ERROR, and it must be an
// error QUICKLY - each cycle case is given a timeout so that a regression to
// "loops forever" fails the suite instead of hanging CI.
// ===========================================================================
import { RefResolutionError } from "../../../../src/json-schema/ref-resolution-error";
import {
  isResolvableRef,
  resolveRef,
  resolveRefInScope,
} from "../../../../src/json-schema/resolve-ref";
import { createDocumentScope } from "../../../../src/json-schema/ref-scope";
import type { Draft07Schema } from "../../../../src/json-schema/draft07.types";

const withDefinitions: Draft07Schema = {
  type: "object",
  definitions: {
    positiveAge: { type: "integer", minimum: 0 },
    name: { type: "string", minLength: 1 },
    alias: { $ref: "#/definitions/name" },
  },
  properties: {
    age: { $ref: "#/definitions/positiveAge" },
  },
};

const with2019Defs: Draft07Schema = {
  $defs: {
    label: { type: "string", maxLength: 8 },
  },
};

describe("local pointers resolve", () => {
  it("resolves #/definitions/X", () => {
    expect(resolveRef("#/definitions/positiveAge", withDefinitions)).toEqual({
      type: "integer",
      minimum: 0,
    });
  });

  it("resolves #/$defs/X", () => {
    expect(resolveRef("#/$defs/label", with2019Defs)).toEqual({
      type: "string",
      maxLength: 8,
    });
  });

  // A Draft-07 document may still be pointed at with the 2019-09 spelling and
  // the other way round; both containers answer to both segment names.
  it("accepts either spelling for either container", () => {
    expect(resolveRef("#/$defs/name", withDefinitions)).toEqual({
      type: "string",
      minLength: 1,
    });
    expect(resolveRef("#/definitions/label", with2019Defs)).toEqual({
      type: "string",
      maxLength: 8,
    });
  });

  it("resolves a general JSON Pointer, not only definitions", () => {
    expect(resolveRef("#/properties/age", withDefinitions)).toEqual({
      type: "integer",
      minimum: 0,
    });
  });

  it("resolves the root pointer", () => {
    expect(resolveRef("#", withDefinitions)).toBe(withDefinitions);
  });

  it("has #/ name the empty-string key's member, not the root (RFC 6901)", () => {
    // Pinned as the root, a document with an "" key becomes unreachable and
    // the suite's empty-token cases fail.
    expect(() => resolveRef("#/", withDefinitions)).toThrow(RefResolutionError);
    const withEmptyKey = JSON.parse(
      String.raw`{"": {"type": "number"}}`
    ) as Draft07Schema;
    expect(resolveRef("#/", withEmptyKey)).toEqual({ type: "number" });
  });

  it("indexes into an array", () => {
    const root: Draft07Schema = {
      allOf: [{ type: "string" }, { type: "number" }],
    };
    expect(resolveRef("#/allOf/1", root)).toEqual({ type: "number" });
  });

  it("decodes RFC 6901 escapes", () => {
    const root: Draft07Schema = {
      definitions: {
        "a/b": { type: "string" },
        "c~d": { type: "number" },
      },
    };
    expect(resolveRef("#/definitions/a~1b", root)).toEqual({ type: "string" });
    expect(resolveRef("#/definitions/c~0d", root)).toEqual({ type: "number" });
  });

  it("returns a boolean schema unchanged", () => {
    const root: Draft07Schema = { definitions: { anything: true } };
    expect(resolveRef("#/definitions/anything", root)).toBe(true);
    const closed: Draft07Schema = { definitions: { nothing: false } };
    expect(resolveRef("#/definitions/nothing", closed)).toBe(false);
  });
});

describe("a chain of refs is followed to the end", () => {
  it("does not stop at a target that is itself a $ref", () => {
    expect(resolveRef("#/definitions/alias", withDefinitions)).toEqual({
      type: "string",
      minLength: 1,
    });
  });

  it("follows a three-link chain", () => {
    const root: Draft07Schema = {
      definitions: {
        a: { $ref: "#/definitions/b" },
        b: { $ref: "#/definitions/c" },
        c: { type: "boolean" },
      },
    };
    expect(resolveRef("#/definitions/a", root)).toEqual({ type: "boolean" });
  });
});

describe("a cycle is an error, and a fast one", () => {
  const twoStepCycle: Draft07Schema = {
    definitions: {
      a: { $ref: "#/definitions/b" },
      b: { $ref: "#/definitions/a" },
    },
  };

  it("throws on a two-step cycle instead of looping", () => {
    expect(() => resolveRef("#/definitions/a", twoStepCycle)).toThrow(
      RefResolutionError
    );
    expect(() => resolveRef("#/definitions/a", twoStepCycle)).toThrow(
      /circular reference/
    );
  }, 2000);

  it("names the pointers on the cycle", () => {
    let message = "";
    try {
      resolveRef("#/definitions/a", twoStepCycle);
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).toContain("#/definitions/a");
    expect(message).toContain("#/definitions/b");
  }, 2000);

  it("throws on a self-reference", () => {
    const root: Draft07Schema = {
      definitions: { loop: { $ref: "#/definitions/loop" } },
    };
    expect(() => resolveRef("#/definitions/loop", root)).toThrow(
      /circular reference/
    );
  }, 2000);

  it("throws on a long cycle", () => {
    const definitions: Record<string, Draft07Schema> = {};
    for (let index = 0; index < 50; index += 1) {
      definitions[`n${String(index)}`] = {
        $ref: `#/definitions/n${String((index + 1) % 50)}`,
      };
    }
    expect(() => resolveRef("#/definitions/n0", { definitions })).toThrow(
      /circular reference/
    );
  }, 2000);

  // A recursive TREE is not a cycle: resolving the pointer lands on a schema
  // object at once. Refusing this shape would make recursive schemas
  // unusable, so the distinction is asserted rather than assumed.
  it("accepts a schema that references itself under a keyword", () => {
    const tree: Draft07Schema = {
      definitions: {
        node: {
          type: "object",
          properties: {
            child: { $ref: "#/definitions/node" },
          },
        },
      },
    };
    expect(resolveRef("#/definitions/node", tree)).toEqual(
      tree.definitions?.["node"]
    );
    expect(isResolvableRef("#/definitions/node", tree)).toBe(true);
  });
});

describe("what the resolver refuses", () => {
  // This entry point is the one where the caller passed nothing, so an
  // external reference always fails. It fails because nothing was passed, not
  // because it is unsupported — and that distinction is the design: nothing is
  // ever fetched.
  it("refuses an external reference nobody supplied", () => {
    expect(() =>
      resolveRef("https://example.com/s.json", withDefinitions)
    ).toThrow(RefResolutionError);
    expect(() =>
      resolveRef("other.json#/definitions/x", withDefinitions)
    ).toThrow(/was not supplied/);
  });

  it("says Luq never fetches, rather than leaving the caller to guess", () => {
    expect(() =>
      resolveRef("other.json#/definitions/x", withDefinitions)
    ).toThrow(/never fetches/);
  });

  it("refuses an external reference reached through a chain", () => {
    const root: Draft07Schema = {
      definitions: { hop: { $ref: "https://example.com/s.json" } },
    };
    expect(() => resolveRef("#/definitions/hop", root)).toThrow(
      /was not supplied/
    );
  });

  it("refuses a pointer that leads nowhere, naming the segment", () => {
    expect(() => resolveRef("#/definitions/missing", withDefinitions)).toThrow(
      /no schema at segment "missing"/
    );
  });

  it("refuses a pointer that lands on a non-schema", () => {
    expect(() =>
      resolveRef("#/definitions/name/minLength", withDefinitions)
    ).toThrow(/the target is not a schema/);
  });

  it("carries the ref on the error", () => {
    let thrown: unknown;
    try {
      resolveRef("#/definitions/missing", withDefinitions);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(RefResolutionError);
    expect((thrown as RefResolutionError).ref).toBe("#/definitions/missing");
  });
});

describe("isResolvableRef answers without throwing", () => {
  it("is true for a reachable pointer", () => {
    expect(isResolvableRef("#/definitions/name", withDefinitions)).toBe(true);
  });

  it("is false for a cycle, an external ref and a dangling pointer", () => {
    const cycle: Draft07Schema = {
      definitions: { a: { $ref: "#/definitions/a" } },
    };
    expect(isResolvableRef("#/definitions/a", cycle)).toBe(false);
    expect(isResolvableRef("https://example.com/s.json", cycle)).toBe(false);
    expect(isResolvableRef("#/definitions/nope", withDefinitions)).toBe(false);
  });

  // "false" is a statement about the REFERENCE. A failure that is not about
  // the reference must not be dressed up as one, or a document that blows the
  // stack while being indexed reads as a merely dangling `$ref`.
  it("rethrows a failure that is not a ref failure", () => {
    let deep: Draft07Schema = { type: "string" };
    for (let level = 0; level < 30000; level += 1) {
      deep = { definitions: { inner: deep } };
    }
    let thrown: unknown;
    try {
      isResolvableRef("#/definitions/inner", deep);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(RangeError);
    expect(thrown).not.toBeInstanceOf(RefResolutionError);
  });
});

// `#name` is a NAME, not a location: it is answered by the registry's index of
// `$id` anchors, never by walking a pointer.
describe("resolve-ref resolves a plain-name fragment through the registry", () => {
  const anchored: Draft07Schema = {
    $id: "http://host/a.json",
    definitions: {
      named: { $id: "#positive", type: "integer", minimum: 1 },
    },
  };

  it("finds the node an anchor $id names", () => {
    expect(resolveRef("#positive", anchored)).toEqual({
      $id: "#positive",
      type: "integer",
      minimum: 1,
    });
  });

  it("names the absolute URI it looked for when no anchor matches", () => {
    expect(() => resolveRef("#missing", anchored)).toThrow(RefResolutionError);
    expect(() => resolveRef("#missing", anchored)).toThrow(
      /no schema is named "http:\/\/host\/a\.json#missing"/
    );
  });
});

describe("resolve-ref resolves against the documents the caller supplied", () => {
  const positiveInt: Draft07Schema = { type: "integer", minimum: 0 };

  it("reads a pointer into a document from externalDocuments", () => {
    const remote: Draft07Schema = { definitions: { positiveInt } };
    const root: Draft07Schema = { $id: "http://host/main.json" };
    const scope = createDocumentScope(root, {
      "http://host/int.json": remote,
    });
    expect(
      resolveRefInScope("int.json#/definitions/positiveInt", scope).schema
    ).toEqual({ type: "integer", minimum: 0 });
  });

  it("reports the missing segment for a pointer the supplied document lacks", () => {
    const remote: Draft07Schema = { definitions: { positiveInt } };
    const scope = createDocumentScope({}, { "http://host/int.json": remote });
    expect(() =>
      resolveRefInScope("http://host/int.json#/definitions/nope", scope)
    ).toThrow(/no schema at segment "nope"/);
  });

  // The security property, stated as a test: supplying ONE document does not
  // open a door to any other. A URI nobody passed in is refused, not fetched.
  it("still refuses a URI that is not in the map, however many are", () => {
    const scope = createDocumentScope(
      {},
      { "http://host/a.json": { type: "string" } }
    );
    expect(() => resolveRefInScope("http://host/b.json", scope)).toThrow(
      /"http:\/\/host\/b\.json" was not supplied/
    );
    expect(() => resolveRefInScope("http://host/b.json", scope)).toThrow(
      /never fetches/
    );
  });

  it("throws on a cycle that runs through two supplied documents", () => {
    const first: Draft07Schema = {
      $id: "http://host/a.json",
      definitions: { loop: { $ref: "b.json#/definitions/loop" } },
    };
    const second: Draft07Schema = {
      $id: "http://host/b.json",
      definitions: { loop: { $ref: "a.json#/definitions/loop" } },
    };
    const scope = createDocumentScope(first, {
      "http://host/b.json": second,
    });
    expect(() => resolveRefInScope("#/definitions/loop", scope)).toThrow(
      /circular reference/
    );
    let message = "";
    try {
      resolveRefInScope("#/definitions/loop", scope);
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).toContain("http://host/a.json#/definitions/loop");
    expect(message).toContain("http://host/b.json#/definitions/loop");
  }, 2000);
});

// The hop bound sits BEHIND the cycle detector: every link here is distinct,
// so nothing is circular and only the bound can stop it. A chain this long is
// not a document anybody writes by hand, which is exactly why the bound exists
// rather than trusting the chain to end.
describe("resolve-ref stops a chain that is long without being circular", () => {
  it("refuses more than 1000 hops", () => {
    const definitions: Record<string, Draft07Schema> = {};
    const links = 1100;
    for (let index = 0; index < links; index += 1) {
      definitions[`d${String(index)}`] = {
        $ref: `#/definitions/d${String(index + 1)}`,
      };
    }
    definitions[`d${String(links)}`] = { type: "string" };
    const root: Draft07Schema = { definitions };
    expect(() => resolveRef("#/definitions/d0", root)).toThrow(
      RefResolutionError
    );
    expect(() => resolveRef("#/definitions/d0", root)).toThrow(
      /more than 1000 \$ref hops/
    );
  }, 5000);

  it("follows a chain that stays under the bound", () => {
    const definitions: Record<string, Draft07Schema> = {};
    const links = 900;
    for (let index = 0; index < links; index += 1) {
      definitions[`d${String(index)}`] = {
        $ref: `#/definitions/d${String(index + 1)}`,
      };
    }
    definitions[`d${String(links)}`] = { type: "string" };
    expect(resolveRef("#/definitions/d0", { definitions })).toEqual({
      type: "string",
    });
  }, 5000);
});
