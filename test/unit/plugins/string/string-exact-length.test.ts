import { Builder } from "../../../../src/index";
import { stringExactLengthPlugin } from "../../../../src/plugins/string-exact-length";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  passesThrough,
  type StringModel,
} from "./string-model";

const exactlyFour = Builder()
  .use(stringExactLengthPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.exactLength(4))
  .build();

describe("stringExactLength", () => {
  it.each([
    ["abcd", true],
    ["abc", false],
    ["abcde", false],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(exactlyFour, value)).toBe(expected);
  });

  it("counts by code point, so two emoji are two characters and not four", () => {
    expect(isAccepted(exactlyFour, "\u{1F600}\u{1F601}")).toBe(false);
    expect(
      isAccepted(exactlyFour, "\u{1F600}\u{1F601}\u{1F602}\u{1F603}")
    ).toBe(true);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(passesThrough(exactlyFour, value)).toBe(true);
  });

  it("defaults its code to the plugin name", () => {
    const issue = firstIssue(exactlyFour, "abc");
    expect(issue.code).toBe("stringExactLength");
    expect(issue.message).toBe(
      "String must have exactly 4 characters, but got 3"
    );
  });

  it("honours options.code and options.messageFactory", () => {
    const custom = Builder()
      .use(stringExactLengthPlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.exactLength(4, {
          code: "BAD_LENGTH",
          messageFactory: (context) =>
            `${String(context.actual)}/${String(context.expected)}`,
        })
      )
      .build();
    const issue = firstIssue(custom, "ab");
    expect(issue.code).toBe("BAD_LENGTH");
    expect(issue.message).toBe("2/4");
  });

  it("throws at BUILD time on a negative length", () => {
    expect(() =>
      Builder()
        .use(stringExactLengthPlugin)
        .for<StringModel>()
        .v("text", (b) => b.string.exactLength(-2))
        .build()
    ).toThrow(/invalid argument "expected"/);
  });
});
