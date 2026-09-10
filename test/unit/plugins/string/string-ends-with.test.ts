import { Builder } from "../../../../src/index";
import { stringEndsWithPlugin } from "../../../../src/plugins/string-ends-with";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  passesThrough,
  type StringModel,
} from "./string-model";

const suffixed = Builder()
  .use(stringEndsWithPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.endsWith(".json"))
  .build();

const emptySuffix = Builder()
  .use(stringEndsWithPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.endsWith(""))
  .build();

describe("stringEndsWith", () => {
  it.each([
    ["schema.json", true],
    [".json", true],
    ["schema.JSON", false],
    ["schema.json.bak", false],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(suffixed, value)).toBe(expected);
  });

  it("an EMPTY suffix accepts everything, including the empty string", () => {
    expect(isAccepted(emptySuffix, "")).toBe(true);
    expect(isAccepted(emptySuffix, "anything")).toBe(true);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(passesThrough(suffixed, value)).toBe(true);
  });

  it("defaults its code to the plugin name and quotes the suffix", () => {
    const issue = firstIssue(suffixed, "nope");
    expect(issue.code).toBe("stringEndsWith");
    expect(issue.message).toBe('String must end with ".json"');
  });

  it("honours options.code and options.messageFactory", () => {
    const custom = Builder()
      .use(stringEndsWithPlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.endsWith(".json", {
          code: "BAD_SUFFIX",
          messageFactory: (context) => `need ${context.suffix}`,
        })
      )
      .build();
    const issue = firstIssue(custom, "nope");
    expect(issue.code).toBe("BAD_SUFFIX");
    expect(issue.message).toBe("need .json");
  });

  it("refuses a non-string suffix at BUILD time", () => {
    expect(() =>
      Builder()
        .use(stringEndsWithPlugin)
        .for<StringModel>()
        .v("text", (b) => b.string.endsWith(null as unknown as string))
        .build()
    ).toThrow(/invalid argument "suffix"/);
  });
});
