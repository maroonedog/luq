// ===========================================================================
// test/unit/plugins/string/string-uri-reference.test.ts
// The Draft-07 `uri-reference` format (RFC 3986). The table that matters most
// is the LAST one: a URI-reference is ASCII-only, so it must reject values the
// IRI-reference plugin accepts. Step 24 refused to bind `uri-reference` to
// stringIriReference for exactly that reason; these assertions are what makes
// the separate plugin worth its file.
// ===========================================================================
import { Builder } from "../../../../src/index";
import { stringUriReferencePlugin } from "../../../../src/plugins/string-uri-reference";
import { stringIriReferencePlugin } from "../../../../src/plugins/string-iri-reference";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  passesThrough,
  type StringModel,
} from "./string-model";

const uriReference = Builder()
  .use(stringUriReferencePlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.uriReference())
  .build();

const iriReference = Builder()
  .use(stringIriReferencePlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.iriReference())
  .build();

describe("stringUriReference", () => {
  it.each([
    ["", true],
    ["https://example.com/a?b=1#c", true],
    ["//example.com/a", true],
    ["/absolute/path", true],
    ["./relative", true],
    ["../up", true],
    ["?query=1", true],
    ["#fragment", true],
    ["plain/segment", true],
    ["mailto:someone@example.com", true],
    ["http://[2001:db8::1]/", true],
    ["%20encoded/path", true],
    ["has space", false],
    ["%zz", false],
    ["%2", false],
    ["path/with|pipe", false],
    ["1bad:scheme", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(uriReference, value)).toBe(expected);
  });

  it("the EMPTY STRING is a valid same-document reference", () => {
    expect(isAccepted(uriReference, "")).toBe(true);
  });

  it("rejects a lone %, which a character-class check would let through", () => {
    expect(isAccepted(uriReference, "a%b")).toBe(false);
    expect(isAccepted(uriReference, "a%41b")).toBe(true);
  });

  it("is STRICTLY NARROWER than iri-reference, which is why it exists", () => {
    // Every one of these is a legal IRI-reference and an illegal
    // URI-reference: RFC 3986 is ASCII-only and requires percent-encoding.
    for (const value of ["日本語/パス", "/naïve", "über"]) {
      expect(isAccepted(iriReference, value)).toBe(true);
      expect(isAccepted(uriReference, value)).toBe(false);
    }
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(passesThrough(uriReference, value)).toBe(true);
  });

  it("reports an overridable code and the documented message", () => {
    expect(firstIssue(uriReference, "has space").code).toBe(
      "stringUriReference"
    );
    expect(firstIssue(uriReference, "has space").message).toBe(
      "Value must be a valid URI-reference (RFC 3986)"
    );
  });
});
