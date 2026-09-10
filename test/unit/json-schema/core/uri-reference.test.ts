// The URI arithmetic of `$id` and `$ref`.
//
// It matters for exactly one thing: the same `$ref` string names a different
// place depending on where it was written. Get that wrong and an external
// reference quietly reads the wrong document.
import {
  nextBaseUri,
  normalizeUri,
  readAnchor,
  resolveUriReference,
  splitUri,
} from "../../../../src/json-schema/uri-reference";

describe("splitUri", () => {
  it("splits the fragment off, without the hash", () => {
    expect(splitUri("http://x/a.json#/definitions/b")).toEqual({
      resource: "http://x/a.json",
      fragment: "/definitions/b",
    });
  });

  it("reports an empty fragment rather than undefined when there is none", () => {
    expect(splitUri("http://x/a.json")).toEqual({
      resource: "http://x/a.json",
      fragment: "",
    });
  });

  it("keeps an empty resource for a fragment-only reference", () => {
    expect(splitUri("#/definitions/b")).toEqual({
      resource: "",
      fragment: "/definitions/b",
    });
  });

  it("splits at the FIRST hash, so a fragment containing one survives", () => {
    expect(splitUri("http://x/a#b#c").fragment).toBe("b#c");
  });
});

describe("resolveUriReference", () => {
  it("resolves a relative reference against the base", () => {
    expect(resolveUriReference("http://x/schemas/a.json", "b.json")).toBe(
      "http://x/schemas/b.json"
    );
  });

  it("resolves an absolute-path reference against the base's authority", () => {
    expect(resolveUriReference("http://x/schemas/a.json", "/c.json")).toBe(
      "http://x/c.json"
    );
  });

  it("keeps an absolute reference, ignoring the base", () => {
    expect(resolveUriReference("http://x/a.json", "http://y/b.json")).toBe(
      "http://y/b.json"
    );
  });

  it("resolves dot segments, which is why this is not string concatenation", () => {
    expect(resolveUriReference("http://x/a/b/c.json", "../d.json")).toBe(
      "http://x/a/d.json"
    );
  });

  it("carries the base through a fragment-only reference", () => {
    expect(resolveUriReference("http://x/a.json", "#/definitions/b")).toBe(
      "http://x/a.json#/definitions/b"
    );
  });

  it("returns the reference unchanged when there is no base to resolve against", () => {
    // The common case: a document with no `$id`. Guessing one here turns a
    // local pointer into an absolute URI that does not exist.
    expect(resolveUriReference("", "#/definitions/x")).toBe("#/definitions/x");
    expect(resolveUriReference("", "folder/int.json")).toBe("folder/int.json");
  });

  it("normalises an absolute reference even with no base", () => {
    expect(resolveUriReference("", "http://x/a/../b.json")).toBe(
      "http://x/b.json"
    );
  });
});

describe("nextBaseUri", () => {
  it("moves the base to an absolute $id", () => {
    expect(nextBaseUri("http://x/a.json", "http://y/b.json")).toBe(
      "http://y/b.json"
    );
  });

  it("moves the base to a relative $id, resolved against the current one", () => {
    expect(nextBaseUri("http://x/schemas/a.json", "folder/")).toBe(
      "http://x/schemas/folder/"
    );
  });

  it("leaves the base alone for an ANCHOR $id", () => {
    // §8.2.3: `$id: "#name"` is a name, not a base. Treated as a base, a
    // `$ref` written beside it quietly points somewhere else.
    expect(nextBaseUri("http://x/a.json", "#name")).toBe("http://x/a.json");
  });

  it("leaves the base alone when there is no $id", () => {
    expect(nextBaseUri("http://x/a.json", undefined)).toBe("http://x/a.json");
    expect(nextBaseUri("http://x/a.json", "")).toBe("http://x/a.json");
  });
});

describe("readAnchor", () => {
  it("reads a plain-name fragment as an anchor", () => {
    expect(readAnchor("#foo")).toBe("foo");
  });

  it("is not an anchor when the fragment is a POINTER", () => {
    expect(readAnchor("#/definitions/foo")).toBeUndefined();
  });

  it("is not an anchor when the $id is a location", () => {
    expect(readAnchor("http://x/a.json")).toBeUndefined();
    expect(readAnchor(undefined)).toBeUndefined();
    expect(readAnchor("#")).toBeUndefined();
  });
});

describe("normalizeUri", () => {
  it("leaves a relative URI alone, because there is nothing to normalise it against", () => {
    expect(normalizeUri("folder/int.json")).toBe("folder/int.json");
  });

  it("normalises an absolute URI so two spellings become one key", () => {
    expect(normalizeUri("http://x/a/../b.json")).toBe("http://x/b.json");
  });
});
