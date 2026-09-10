import { Builder } from "../../../../src/index";
import { stringIpv4Plugin } from "../../../../src/plugins/string-ipv4";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  passesThrough,
  type StringModel,
} from "./string-model";

const ipv4 = Builder()
  .use(stringIpv4Plugin)
  .for<StringModel>()
  .v("text", (b) => b.string.ipv4())
  .build();

describe("stringIpv4", () => {
  it.each([
    ["0.0.0.0", true],
    ["192.168.0.1", true],
    ["255.255.255.255", true],
    ["256.1.1.1", false],
    ["999.999.999.999", false],
    ["1.2.3", false],
    ["1.2.3.4.5", false],
    ["1.2.3.-1", false],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(ipv4, value)).toBe(expected);
  });

  it("REJECTS leading zeros, which the 1.x pattern wrongly accepted", () => {
    // The plugin's own JSDoc claimed these were rejected while its
    // [01]?[0-9][0-9]? alternative accepted them. The doc was right.
    expect(isAccepted(ipv4, "01.2.3.4")).toBe(false);
    expect(isAccepted(ipv4, "001.2.3.4")).toBe(false);
    expect(isAccepted(ipv4, "087.10.0.1")).toBe(false);
    expect(isAccepted(ipv4, "0.10.0.1")).toBe(true);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(passesThrough(ipv4, value)).toBe(true);
  });

  it("has an overridable code, which 1.x's FORMAT_IPV4 was not", () => {
    expect(firstIssue(ipv4, "999.1.1.1").code).toBe("stringIpv4");
    expect(firstIssue(ipv4, "999.1.1.1").message).toBe(
      "Value must be a valid IPv4 address"
    );
    const custom = Builder()
      .use(stringIpv4Plugin)
      .for<StringModel>()
      .v("text", (b) => b.string.ipv4({ code: "FORMAT_IPV4" }))
      .build();
    expect(firstIssue(custom, "999.1.1.1").code).toBe("FORMAT_IPV4");
  });
});
