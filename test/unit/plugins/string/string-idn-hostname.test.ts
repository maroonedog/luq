// ===========================================================================
// test/unit/plugins/string/string-idn-hostname.test.ts
// The Draft-07 `idn-hostname` format (RFC 5890/5891). The plugin header names
// exactly what it enforces and what it does not; these tables pin BOTH, so
// "supported" is a claim a reader can check rather than a word in a table.
// ===========================================================================
import { Builder } from "../../../../src/index";
import { stringIdnHostnamePlugin } from "../../../../src/plugins/string-idn-hostname";
import { stringHostnamePlugin } from "../../../../src/plugins/string-hostname";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  type StringModel,
} from "./string-model";

const idnHostname = Builder()
  .use(stringIdnHostnamePlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.idnHostname())
  .build();

const asciiHostname = Builder()
  .use(stringHostnamePlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.hostname())
  .build();

const LABEL_OF_63 = "a".repeat(63);
const LABEL_OF_64 = "a".repeat(64);

describe("stringIdnHostname", () => {
  it.each([
    ["example.com", true],
    ["日本.example", true],
    ["xn--fsq.example", true],
    ["a", true],
    ["a-b.c-d", true],
    [LABEL_OF_63, true],
    ["", false],
    [".", false],
    ["example..com", false],
    [".example.com", false],
    ["example.com.", false],
    ["-example.com", false],
    ["example-.com", false],
    [LABEL_OF_64, false],
    ["exa mple.com", false],
    ["example_com", false],
    ["exa@mple.com", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(idnHostname, value)).toBe(expected);
  });

  it("is STRICTLY WIDER than the ASCII hostname format, which is why it exists", () => {
    expect(isAccepted(asciiHostname, "日本.example")).toBe(false);
    expect(isAccepted(idnHostname, "日本.example")).toBe(true);
  });

  it("enforces the RFC 5891 reserved-hyphen rule only outside xn--", () => {
    expect(isAccepted(idnHostname, "ab--cd.example")).toBe(false);
    expect(isAccepted(idnHostname, "xn--cd.example")).toBe(true);
  });

  it("requires an A-label's remainder to be ASCII letter-digit-hyphen", () => {
    expect(isAccepted(idnHostname, "xn--日本.example")).toBe(false);
    expect(isAccepted(idnHostname, "xn--fsqu00a.example")).toBe(true);
  });

  it("refuses a label that BEGINS with a combining mark (RFC 5891 4.2.3.2)", () => {
    // U+0301 COMBINING ACUTE ACCENT on its own is a leading mark; the same
    // mark after a base letter is fine.
    expect(isAccepted(idnHostname, "́abc.example")).toBe(false);
    expect(isAccepted(idnHostname, "ábc.example")).toBe(true);
  });

  it("caps the whole name at 253 code points", () => {
    const long = `${"a".repeat(50)}.`.repeat(5);
    expect([...long.slice(0, -1)].length).toBe(254);
    expect(isAccepted(idnHostname, long.slice(0, -1))).toBe(false);
    expect(isAccepted(idnHostname, long.slice(0, -2))).toBe(true);
  });

  it("does NOT check the IDNA2008 property tables — the header says so", () => {
    // U+00A0 NO-BREAK SPACE is DISALLOWED by IDNA2008 and accepted here. The
    // gap is documented rather than hidden, and this test is what stops it
    // from being quietly assumed closed.
    expect(isAccepted(idnHostname, "a b.example")).toBe(true);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(isAccepted(idnHostname, value)).toBe(true);
  });

  it("reports an overridable code and the documented message", () => {
    expect(firstIssue(idnHostname, "-bad").code).toBe("stringIdnHostname");
    expect(firstIssue(idnHostname, "-bad").message).toBe(
      "Value must be a valid internationalized hostname (RFC 5890)"
    );
  });
});
