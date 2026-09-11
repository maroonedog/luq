import { Builder } from "../../../../src/index";
import { stringIpv6Plugin } from "../../../../src/plugins/string-ipv6";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  passesThrough,
  type StringModel,
} from "./string-model";

const ipv6 = Builder()
  .use(stringIpv6Plugin)
  .for<StringModel>()
  .v("text", (b) => b.string.ipv6())
  .build();

describe("stringIpv6", () => {
  it.each([
    ["2001:0db8:85a3:0000:0000:8a2e:0370:7334", true],
    ["2001:db8:85a3::8a2e:370:7334", true],
    ["::", true],
    ["::1", true],
    ["fe80::1", true],
    ["fe80::1%eth0", true],
    ["::ffff:192.0.2.1", true],
    ["1:2:3:4:5:6:1.2.3.4", true],
    ["2001:db8::8a2e:370:7334:1:2:3", false],
    ["1:2:3:4:5:6:7", false],
    ["gggg::1", false],
    ["12345::1", false],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(ipv6, value)).toBe(expected);
  });

  it("does NOT wave through anything containing '::'", () => {
    // jsonSchema/format-validators.ts returned true for any value containing
    // "::", so all of these validated in 1.x on the JSON Schema path.
    expect(isAccepted(ipv6, ":::")).toBe(false);
    expect(isAccepted(ipv6, "gg::1")).toBe(false);
    expect(isAccepted(ipv6, "1::2::3")).toBe(false);
    expect(isAccepted(ipv6, "hello::world")).toBe(false);
  });

  it("requires '::' to stand for at least one omitted group", () => {
    expect(isAccepted(ipv6, "1:2:3:4:5:6:7::8")).toBe(false);
    expect(isAccepted(ipv6, "1:2:3:4:5:6::8")).toBe(true);
  });

  it("accepts a dotted quad only as the LAST element", () => {
    expect(isAccepted(ipv6, "::ffff:192.0.2.1")).toBe(true);
    expect(isAccepted(ipv6, "192.0.2.1::")).toBe(false);
    expect(isAccepted(ipv6, "::ffff:999.0.2.1")).toBe(false);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(passesThrough(ipv6, value)).toBe(true);
  });

  it("has an overridable code, which 1.x's FORMAT_IPV6 was not", () => {
    expect(firstIssue(ipv6, "nope").code).toBe("stringIpv6");
    expect(firstIssue(ipv6, "nope").message).toBe(
      "Value must be a valid IPv6 address"
    );
    const custom = Builder()
      .use(stringIpv6Plugin)
      .for<StringModel>()
      .v("text", (b) => b.string.ipv6({ code: "FORMAT_IPV6" }))
      .build();
    expect(firstIssue(custom, "nope").code).toBe("FORMAT_IPV6");
  });

  // The zone suffix was only ever asserted in its accepting form, so every way
  // of writing it wrongly went unchecked. A zone is a link-local scope name; a
  // parser that shrugs at a malformed one accepts an address that names no
  // interface.
  describe("the RFC 6874 zone suffix", () => {
    it.each([
      ["fe80::1%eth0", true, "a named interface"],
      ["fe80::1%1", true, "a numeric scope id"],
      ["fe80::1%", false, "a '%' with nothing after it"],
      ["fe80::1%eth0%eth1", false, "two zones"],
      ["%eth0", false, "a zone with no address before it"],
      ["fe80::gggg%eth0", false, "a zone does not excuse the address"],
    ])("%p is accepted: %p — %s", (value, expected) => {
      expect(isAccepted(ipv6, value)).toBe(expected);
    });
  });

  it("rejects an empty group rather than reading past it", () => {
    // A single ':' leaves an empty part. Counting it as a group would make
    // "1:::2" and ":2" arithmetic that happens to land on eight.
    expect(isAccepted(ipv6, ":2")).toBe(false);
    expect(isAccepted(ipv6, "1:")).toBe(false);
    expect(isAccepted(ipv6, "1::2:")).toBe(false);
  });
});
