import { Builder } from "../../../../src/index";
import { stringBase64Plugin } from "../../../../src/plugins/string-base64";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  passesThrough,
  type StringModel,
} from "./string-model";

const standard = Builder()
  .use(stringBase64Plugin)
  .for<StringModel>()
  .v("text", (b) => b.string.base64())
  .build();

const urlSafe = Builder()
  .use(stringBase64Plugin)
  .for<StringModel>()
  .v("text", (b) => b.string.base64({ urlSafe: true }))
  .build();

describe("stringBase64", () => {
  it.each([
    ["", true],
    ["aGVsbG8=", true],
    ["aGVsbG9v", true],
    ["aGVsbG8", false],
    ["aGVsbG8!", false],
    ["a-_=", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(standard, value)).toBe(expected);
  });

  it("the EMPTY STRING is explicitly valid, as in 1.x", () => {
    expect(isAccepted(standard, "")).toBe(true);
    expect(isAccepted(urlSafe, "")).toBe(true);
  });

  it("urlSafe swaps the alphabet but still demands padding, as in 1.x", () => {
    expect(isAccepted(urlSafe, "a-_w")).toBe(true);
    expect(isAccepted(urlSafe, "a+/w")).toBe(false);
    expect(isAccepted(urlSafe, "a-_")).toBe(false);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(passesThrough(standard, value)).toBe(true);
  });

  it("has an overridable code, which 1.x's FORMAT_BASE64 was not", () => {
    expect(firstIssue(standard, "aGVsbG8").code).toBe("stringBase64");
    expect(firstIssue(standard, "aGVsbG8").message).toBe(
      "Value must be a valid base64 encoded string"
    );
    const custom = Builder()
      .use(stringBase64Plugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.base64(
          { urlSafe: true },
          {
            code: "FORMAT_BASE64",
            messageFactory: (context) => `urlSafe=${String(context.urlSafe)}`,
          }
        )
      )
      .build();
    const issue = firstIssue(custom, "a+/w");
    expect(issue.code).toBe("FORMAT_BASE64");
    expect(issue.message).toBe("urlSafe=true");
  });
});
