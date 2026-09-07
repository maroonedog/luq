import { Builder } from "../../../../src/index";
import { stringStartsWithPlugin } from "../../../../src/plugins/string-starts-with";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  type StringModel,
} from "./string-model";

const prefixed = Builder()
  .use(stringStartsWithPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.startsWith("api-"))
  .build();

const emptyPrefix = Builder()
  .use(stringStartsWithPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.startsWith(""))
  .build();

describe("stringStartsWith", () => {
  it.each([
    ["api-key", true],
    ["api-", true],
    ["API-key", false],
    ["key-api-", false],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(prefixed, value)).toBe(expected);
  });

  it("an EMPTY prefix accepts everything, including the empty string", () => {
    expect(isAccepted(emptyPrefix, "")).toBe(true);
    expect(isAccepted(emptyPrefix, "anything")).toBe(true);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(isAccepted(prefixed, value)).toBe(true);
  });

  it("defaults its code to the plugin name and quotes the prefix", () => {
    const issue = firstIssue(prefixed, "nope");
    expect(issue.code).toBe("stringStartsWith");
    expect(issue.message).toBe('String must start with "api-"');
  });

  it("honours options.code and options.messageFactory", () => {
    const custom = Builder()
      .use(stringStartsWithPlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.startsWith("api-", {
          code: "BAD_PREFIX",
          messageFactory: (context) => `need ${context.prefix}`,
        })
      )
      .build();
    const issue = firstIssue(custom, "nope");
    expect(issue.code).toBe("BAD_PREFIX");
    expect(issue.message).toBe("need api-");
  });

  it("refuses a non-string prefix at BUILD time", () => {
    expect(() =>
      Builder()
        .use(stringStartsWithPlugin)
        .for<StringModel>()
        .v("text", (b) => b.string.startsWith(7 as unknown as string))
        .build()
    ).toThrow(/invalid argument "prefix"/);
  });
});
