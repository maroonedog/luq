import { Builder } from "../../../../src/index";
import { stringPatternPlugin } from "../../../../src/plugins/string-pattern";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  passesThrough,
  type StringModel,
} from "./string-model";

const digitsOnly = Builder()
  .use(stringPatternPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.pattern(/^[0-9]+$/))
  .build();

describe("stringPattern", () => {
  it.each([
    ["123", true],
    ["abc", false],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(digitsOnly, value)).toBe(expected);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(passesThrough(digitsOnly, value)).toBe(true);
  });

  it("is STATELESS across calls even for a /g pattern", () => {
    // The 1.x defect: `test` on a /g RegExp advances lastIndex, so the SAME
    // value alternated between valid and invalid on successive validations.
    const global = /ab/g;
    const validator = Builder()
      .use(stringPatternPlugin)
      .for<StringModel>()
      .v("text", (b) => b.string.pattern(global))
      .build();
    expect(isAccepted(validator, "abab")).toBe(true);
    expect(isAccepted(validator, "abab")).toBe(true);
    expect(isAccepted(validator, "abab")).toBe(true);
    // The caller's own object is not touched either.
    expect(global.lastIndex).toBe(0);
  });

  it("keeps flags the caller asked for, unlike the string form 1.x had", () => {
    const insensitive = Builder()
      .use(stringPatternPlugin)
      .for<StringModel>()
      .v("text", (b) => b.string.pattern(/^abc$/i))
      .build();
    expect(isAccepted(insensitive, "ABC")).toBe(true);
  });

  it("reports the pattern in the message context", () => {
    const issue = firstIssue(digitsOnly, "x");
    expect(issue.code).toBe("stringPattern");
    expect(issue.message).toBe("Invalid format");
    const custom = Builder()
      .use(stringPatternPlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.pattern(/^[0-9]+$/, {
          code: "NOT_DIGITS",
          messageFactory: (context) => `want ${context.pattern}`,
        })
      )
      .build();
    const customIssue = firstIssue(custom, "x");
    expect(customIssue.code).toBe("NOT_DIGITS");
    expect(customIssue.message).toBe("want /^[0-9]+$/");
  });

  it("refuses a non-RegExp at BUILD time", () => {
    const build = (pattern: unknown): unknown =>
      Builder()
        .use(stringPatternPlugin)
        .for<StringModel>()
        .v("text", (b) => b.string.pattern(pattern as RegExp))
        .build();
    expect(() => build("^[0-9]+$")).toThrow(/invalid argument "pattern"/);
  });
});
