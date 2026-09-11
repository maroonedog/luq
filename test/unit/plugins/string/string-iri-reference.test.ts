import { Builder } from "../../../../src/index";
import { stringIriReferencePlugin } from "../../../../src/plugins/string-iri-reference";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  passesThrough,
  type StringModel,
} from "./string-model";

const iriReference = Builder()
  .use(stringIriReferencePlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.iriReference())
  .build();

describe("stringIriReference", () => {
  it.each([
    ["", true],
    ["https://example.com/a", true],
    ["//example.com/a", true],
    ["/absolute/path", true],
    ["./relative", true],
    ["../up", true],
    ["?query=1", true],
    ["#fragment", true],
    ["plain/segment", true],
    ["日本語/パス", true],
    ["//example.com//second", false],
    ["not:a/scheme like this", false],
    ["has space", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(iriReference, value)).toBe(expected);
  });

  it("the EMPTY STRING is a valid same-document reference", () => {
    expect(isAccepted(iriReference, "")).toBe(true);
  });

  it("checks control characters only BEFORE the first ? or #", () => {
    expect(isAccepted(iriReference, "/path?a b")).toBe(true);
    expect(isAccepted(iriReference, "/pa th?a")).toBe(false);
  });

  it("counts DEL as a control character, the same as the C0 range", () => {
    expect(isAccepted(iriReference, "/pa\u0007th")).toBe(false);
    expect(isAccepted(iriReference, "/pa\u007fth")).toBe(false);
    expect(isAccepted(iriReference, "/path?a\u007f")).toBe(true);
  });

  it("refuses a bare path whose first segment looks like a scheme", () => {
    expect(isAccepted(iriReference, "weird:segment/rest")).toBe(true);
    expect(isAccepted(iriReference, "1bad:segment")).toBe(false);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(passesThrough(iriReference, value)).toBe(true);
  });

  it("has an overridable code, which 1.x's FORMAT_IRI_REFERENCE was not", () => {
    expect(firstIssue(iriReference, "has space").code).toBe(
      "stringIriReference"
    );
    expect(firstIssue(iriReference, "has space").message).toBe(
      "Value must be a valid IRI-reference (RFC 3987)"
    );
    const custom = Builder()
      .use(stringIriReferencePlugin)
      .for<StringModel>()
      .v("text", (b) => b.string.iriReference({ code: "FORMAT_IRI_REF" }))
      .build();
    expect(firstIssue(custom, "has space").code).toBe("FORMAT_IRI_REF");
  });
});
