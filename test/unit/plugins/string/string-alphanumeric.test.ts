import { Builder } from "../../../../src/index";
import { stringAlphanumericPlugin } from "../../../../src/plugins/string-alphanumeric";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  passesThrough,
  type StringModel,
} from "./string-model";

const strict = Builder()
  .use(stringAlphanumericPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.alphanumeric())
  .build();

const withSpaces = Builder()
  .use(stringAlphanumericPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.alphanumeric(true))
  .build();

describe("stringAlphanumeric", () => {
  it.each([
    ["abc123", true],
    ["ABC", true],
    ["9", true],
    ["ab c", false],
    ["ab-c", false],
    ["", false],
    ["あ", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(strict, value)).toBe(expected);
  });

  it("allowSpaces widens the class but still rejects the empty string", () => {
    expect(isAccepted(withSpaces, "ab c")).toBe(true);
    expect(isAccepted(withSpaces, "ab\tc")).toBe(true);
    expect(isAccepted(withSpaces, "ab-c")).toBe(false);
    expect(isAccepted(withSpaces, "")).toBe(false);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(passesThrough(strict, value)).toBe(true);
  });

  it("keeps ONE code whatever allowSpaces is", () => {
    // 1.x emitted "stringAlphanumeric_with_spaces" when the flag was set, so
    // an option value moved the error code. It no longer can.
    expect(firstIssue(strict, "a-b").code).toBe("stringAlphanumeric");
    expect(firstIssue(withSpaces, "a-b").code).toBe("stringAlphanumeric");
  });

  it("puts allowSpaces in the message, not in the code", () => {
    expect(firstIssue(strict, "a-b").message).toBe(
      "String must contain only alphanumeric characters"
    );
    expect(firstIssue(withSpaces, "a-b").message).toBe(
      "String must contain only alphanumeric characters and spaces"
    );
  });

  it("honours options.code and options.messageFactory", () => {
    const custom = Builder()
      .use(stringAlphanumericPlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.alphanumeric(true, {
          code: "NOT_ALNUM",
          messageFactory: (context) => `spaces=${String(context.allowSpaces)}`,
        })
      )
      .build();
    const issue = firstIssue(custom, "a-b");
    expect(issue.code).toBe("NOT_ALNUM");
    expect(issue.message).toBe("spaces=true");
  });
});
