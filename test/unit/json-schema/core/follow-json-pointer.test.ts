// The RFC 6901 pointer walker: WHERE INSIDE a document, never WHICH document.
//
// The cases worth pinning are the ones where a pointer and a URI disagree
// about what a character means — `~1`, `%25`, and a percent escape that is not
// an escape at all. Each of those is a place where guessing produces a
// validator that quietly checks a different node.
import {
  stepInto,
  toPointerTokens,
  walkPointer,
} from "../../../../src/json-schema/follow-json-pointer";
import { resolveRef } from "../../../../src/json-schema/resolve-ref";
import type { Draft07Schema } from "../../../../src/json-schema/draft07.types";

describe("follow-json-pointer splits a fragment into tokens", () => {
  it("returns no tokens for the empty fragment, which names the root", () => {
    expect(toPointerTokens("")).toEqual([]);
  });

  it('keeps the empty token of a leading slash, which names the "" key', () => {
    expect(toPointerTokens("/")).toEqual([""]);
  });

  it("decodes ~1 as a slash and ~0 as a tilde", () => {
    expect(toPointerTokens("/definitions/a~1b")).toEqual([
      "definitions",
      "a/b",
    ]);
    expect(toPointerTokens("/definitions/c~0d")).toEqual([
      "definitions",
      "c~d",
    ]);
  });

  it("decodes ~01 as ~1 rather than as a slash", () => {
    // Decoding in the other order turns the literal name `~1` into `/`, which
    // is a different node — the whole reason RFC 6901 fixes the order.
    expect(toPointerTokens("/definitions/a~01b")).toEqual([
      "definitions",
      "a~1b",
    ]);
  });

  it("percent-decodes the fragment", () => {
    expect(toPointerTokens("/definitions/percent%25field")).toEqual([
      "definitions",
      "percent%field",
    ]);
  });

  // `%zz` is not a percent escape. A pointer carrying one is used exactly as
  // written, because the alternative — throwing — would take a whole document
  // down over one bad segment somewhere inside it.
  it("uses a fragment whose percent escape is malformed exactly as written", () => {
    expect(toPointerTokens("/definitions/%zz")).toEqual(["definitions", "%zz"]);
    expect(toPointerTokens("/%E0%A4%A")).toEqual(["%E0%A4%A"]);
  });

  it("reaches a definition literally named with a malformed escape", () => {
    const root = JSON.parse(
      String.raw`{"definitions": {"%zz": {"type": "string"}}}`
    ) as Draft07Schema;
    expect(resolveRef("#/definitions/%zz", root)).toEqual({ type: "string" });
  });
});

describe("follow-json-pointer steps into one node", () => {
  it("indexes an array by its token", () => {
    expect(stepInto([{ type: "string" }, { type: "number" }], "1")).toEqual({
      type: "number",
    });
  });

  it("answers to both spellings of the definitions container", () => {
    expect(stepInto({ $defs: { a: true } }, "definitions")).toEqual({
      a: true,
    });
    expect(stepInto({ definitions: { a: true } }, "$defs")).toEqual({
      a: true,
    });
  });

  it("prefers a real definitions member over $defs", () => {
    const both = { definitions: { a: 1 }, $defs: { b: 2 } };
    expect(stepInto(both, "$defs")).toEqual({ a: 1 });
  });

  it("is undefined for a token that is not there, and for a leaf", () => {
    expect(stepInto({ type: "string" }, "minLength")).toBeUndefined();
    expect(stepInto("string", "length")).toBeUndefined();
  });
});

describe("follow-json-pointer counts the nodes it crosses", () => {
  const document = {
    definitions: { outer: { $id: "folder/", properties: { leaf: true } } },
  };

  it("calls advance once per token, in order", () => {
    const crossed: string[] = [];
    const walked = walkPointer(
      "/definitions/outer/properties/leaf",
      document,
      "start",
      (scope, node) => {
        crossed.push(typeof node);
        return scope;
      },
      (token) => {
        throw new Error(`unexpected miss at ${token}`);
      }
    );
    expect(walked.node).toBe(true);
    expect(crossed).toEqual(["object", "object", "object", "boolean"]);
  });

  it("reports the token that led nowhere, and stops there", () => {
    expect(() =>
      walkPointer(
        "/definitions/nope/properties",
        document,
        "start",
        (scope) => scope,
        (token) => {
          throw new Error(`missing ${token}`);
        }
      )
    ).toThrow("missing nope");
  });
});
