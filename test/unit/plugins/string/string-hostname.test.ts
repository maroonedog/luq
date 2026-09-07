import { Builder } from "../../../../src/index";
import { stringHostnamePlugin } from "../../../../src/plugins/string-hostname";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  type StringModel,
} from "./string-model";

const hostname = Builder()
  .use(stringHostnamePlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.hostname())
  .build();

describe("stringHostname", () => {
  it.each([
    ["example.com", true],
    ["a", true],
    ["sub.example.co.jp", true],
    ["my-host.example.com", true],
    ["-host.example.com", false],
    ["host-.example.com", false],
    ["host_name.example.com", false],
    ["example.com.", false],
    ["example..com", false],
    ["exámple.com", false],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(hostname, value)).toBe(expected);
  });

  it("caps a label at 63 characters and the whole name at 253", () => {
    expect(isAccepted(hostname, `${"a".repeat(63)}.com`)).toBe(true);
    expect(isAccepted(hostname, `${"a".repeat(64)}.com`)).toBe(false);
    const many = Array.from({ length: 6 }, () => "a".repeat(45)).join(".");
    expect(many.length).toBeGreaterThan(253);
    expect(isAccepted(hostname, many)).toBe(false);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(isAccepted(hostname, value)).toBe(true);
  });

  it("has an overridable code, which 1.x's FORMAT_HOSTNAME was not", () => {
    expect(firstIssue(hostname, "-nope").code).toBe("stringHostname");
    expect(firstIssue(hostname, "-nope").message).toBe(
      "Value must be a valid hostname"
    );
    const custom = Builder()
      .use(stringHostnamePlugin)
      .for<StringModel>()
      .v("text", (b) => b.string.hostname({ code: "FORMAT_HOSTNAME" }))
      .build();
    expect(firstIssue(custom, "-nope").code).toBe("FORMAT_HOSTNAME");
  });
});
