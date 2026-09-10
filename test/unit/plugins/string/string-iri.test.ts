import { Builder } from "../../../../src/index";
import { stringIriPlugin } from "../../../../src/plugins/string-iri";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  passesThrough,
  type StringModel,
} from "./string-model";

const iri = Builder()
  .use(stringIriPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.iri())
  .build();

describe("stringIri", () => {
  it.each([
    ["https://example.com/a", true],
    ["mailto:john@example.com", true],
    ["urn:isbn:0451450523", true],
    ["https://例え.テスト/パス", true],
    ["scheme:ある", true],
    ["/relative/path", false],
    ["example.com", false],
    ["https://example.com/a b", false],
    ["1scheme:x", false],
    // RFC 3987's ipath-empty: "scheme:" is a well-formed IRI with no path.
    ["scheme:", true],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(iri, value)).toBe(expected);
  });

  it("rejects a control character anywhere in the value", () => {
    expect(isAccepted(iri, "https://example.com/\u0007")).toBe(false);
    expect(isAccepted(iri, "https://example.com/\u007f")).toBe(false);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(passesThrough(iri, value)).toBe(true);
  });

  it("has an overridable code, which 1.x's FORMAT_IRI was not", () => {
    expect(firstIssue(iri, "nope").code).toBe("stringIri");
    expect(firstIssue(iri, "nope").message).toBe(
      "Value must be a valid IRI (RFC 3987)"
    );
    const custom = Builder()
      .use(stringIriPlugin)
      .for<StringModel>()
      .v("text", (b) => b.string.iri({ code: "FORMAT_IRI" }))
      .build();
    expect(firstIssue(custom, "nope").code).toBe("FORMAT_IRI");
  });
});
