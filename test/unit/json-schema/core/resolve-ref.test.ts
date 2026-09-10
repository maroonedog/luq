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
} from "../../../../src/json-schema/resolve-ref";
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
});
