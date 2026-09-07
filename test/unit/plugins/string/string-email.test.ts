import { Builder } from "../../../../src/index";
import { stringEmailPlugin } from "../../../../src/plugins/string-email";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  type StringModel,
} from "./string-model";

const anyDomain = Builder()
  .use(stringEmailPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.email())
  .build();

const corporate = Builder()
  .use(stringEmailPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.email({ allowedDomains: ["Example.com", "b.io"] }))
  .build();

describe("stringEmail", () => {
  it.each([
    ["john@example.com", true],
    ["j.o+tag_1%x@sub.example.co.jp", true],
    ["a@b.co", true],
    [".john@example.com", false],
    ["john.@example.com", false],
    ["john@example", false],
    ["john@example.c", false],
    ["john@@example.com", false],
    ["john example@x.com", false],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(anyDomain, value)).toBe(expected);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(isAccepted(anyDomain, value)).toBe(true);
  });

  it("matches allowedDomains case-insensitively after the LAST @", () => {
    expect(isAccepted(corporate, "john@EXAMPLE.com")).toBe(true);
    expect(isAccepted(corporate, "john@b.io")).toBe(true);
    expect(isAccepted(corporate, "john@other.com")).toBe(false);
  });

  it("names the reason ONCE instead of re-running the check to find it", () => {
    // 1.x derived the reason inside getErrorMessage by re-executing the regex
    // and the domain lookup, so validation ran twice on the failure path.
    expect(firstIssue(anyDomain, "nope").message).toBe(
      "Invalid email: invalid format"
    );
    expect(firstIssue(corporate, "john@other.com").message).toBe(
      "Invalid email: domain not allowed (allowed: Example.com, b.io)"
    );
  });

  it("does NOT cap the length: compose .max(n).email() for that", () => {
    const long = `${"a".repeat(300)}@example.com`;
    expect(isAccepted(anyDomain, long)).toBe(true);
  });

  it("lets customRegex replace the built-in pattern entirely", () => {
    const loose = Builder()
      .use(stringEmailPlugin)
      .for<StringModel>()
      .v("text", (b) => b.string.email({ customRegex: /^[^@]+@[^@]+$/ }))
      .build();
    expect(isAccepted(loose, "john@example")).toBe(true);
  });

  it("is stateless even when customRegex carries /g", () => {
    const global = Builder()
      .use(stringEmailPlugin)
      .for<StringModel>()
      .v("text", (b) => b.string.email({ customRegex: /^[^@]+@[^@]+$/g }))
      .build();
    expect(isAccepted(global, "john@example")).toBe(true);
    expect(isAccepted(global, "john@example")).toBe(true);
  });

  it("defaults its code to the plugin name and honours an override", () => {
    expect(firstIssue(anyDomain, "nope").code).toBe("stringEmail");
    const custom = Builder()
      .use(stringEmailPlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.email(undefined, {
          code: "BAD_EMAIL",
          messageFactory: (context) => `why: ${context.reason}`,
        })
      )
      .build();
    const issue = firstIssue(custom, "nope");
    expect(issue.code).toBe("BAD_EMAIL");
    expect(issue.message).toBe("why: invalid format");
  });
});
