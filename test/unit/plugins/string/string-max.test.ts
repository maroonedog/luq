import { Builder } from "../../../../src/index";
import { stringMaxPlugin } from "../../../../src/plugins/string-max";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  type StringModel,
} from "./string-model";

const atMostThree = Builder()
  .use(stringMaxPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.max(3))
  .build();

const empty = Builder()
  .use(stringMaxPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.max(0))
  .build();

describe("stringMax", () => {
  it.each([
    ["", true],
    ["abc", true],
    ["abcd", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(atMostThree, value)).toBe(expected);
  });

  it("max(0) permits only the empty string", () => {
    expect(isAccepted(empty, "")).toBe(true);
    expect(isAccepted(empty, "a")).toBe(false);
  });

  it("counts UTF-16 code units", () => {
    expect(isAccepted(atMostThree, "ab\u{1F600}")).toBe(false);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(isAccepted(atMostThree, value)).toBe(true);
  });

  it("defaults its code to the plugin name", () => {
    const issue = firstIssue(atMostThree, "abcd");
    expect(issue.code).toBe("stringMax");
    expect(issue.message).toBe(
      "String must have at most 3 characters, but got 4"
    );
  });

  it("honours options.code and options.messageFactory", () => {
    const custom = Builder()
      .use(stringMaxPlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.max(3, {
          code: "TOO_LONG",
          messageFactory: (context) => `max=${String(context.max)}`,
        })
      )
      .build();
    const issue = firstIssue(custom, "abcd");
    expect(issue.code).toBe("TOO_LONG");
    expect(issue.message).toBe("max=3");
  });

  it("throws at BUILD time on a negative bound", () => {
    expect(() =>
      Builder()
        .use(stringMaxPlugin)
        .for<StringModel>()
        .v("text", (b) => b.string.max(-1))
        .build()
    ).toThrow(/invalid argument "max"/);
  });
});
