// ===========================================================================
// test/unit/plugins/string/string-regex.test.ts
// The Draft-07 `regex` format. Until step 27 the format map declared this name
// UNSUPPORTED, so a schema carrying it threw at BUILD time; these are the
// assertions that make "supported" mean something.
// ===========================================================================
import { Builder } from "../../../../src/index";
import { stringRegexPlugin } from "../../../../src/plugins/string-regex";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  passesThrough,
  type StringModel,
} from "./string-model";

const regex = Builder()
  .use(stringRegexPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.regex())
  .build();

describe("stringRegex", () => {
  it.each([
    ["", true],
    ["^abc$", true],
    ["a{1,3}", true],
    ["[a-z]+", true],
    ["(?:group)?", true],
    ["\\d{4}-\\d{2}-\\d{2}", true],
    ["^(abc)\\1$", true],
    ["a**", false],
    ["[unclosed", false],
    ["(unclosed", false],
    ["a{3,1}", false],
    ["\\", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(regex, value)).toBe(expected);
  });

  it("uses the ENGINE as the grammar, so no second pattern table exists", () => {
    // Anything the platform RegExp constructor accepts is an ECMA-262 pattern
    // by definition. The plugin never re-describes that grammar.
    const exotic = "(?=lookahead)(?!negative)[\\s\\S]*?";
    expect(() => new RegExp(exotic)).not.toThrow();
    expect(isAccepted(regex, exotic)).toBe(true);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(passesThrough(regex, value)).toBe(true);
  });

  it("reports an overridable code and the documented message", () => {
    expect(firstIssue(regex, "a**").code).toBe("stringRegex");
    expect(firstIssue(regex, "a**").message).toBe(
      "Value must be a valid ECMA-262 regular expression"
    );
  });
});
