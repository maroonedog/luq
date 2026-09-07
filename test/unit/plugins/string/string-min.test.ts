import { Builder } from "../../../../src/index";
import { stringMinPlugin } from "../../../../src/plugins/string-min";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  type StringModel,
} from "./string-model";

const atLeastThree = Builder()
  .use(stringMinPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.min(3))
  .build();

describe("stringMin", () => {
  it.each([
    ["abc", true],
    ["abcd", true],
    ["ab", false],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(atLeastThree, value)).toBe(expected);
  });

  it("counts UTF-16 code units, so one emoji is two characters", () => {
    // "ab" + a surrogate pair = 4 code units, 3 code points.
    expect(isAccepted(atLeastThree, "ab\u{1F600}")).toBe(true);
    // The pair alone is 2 code units, so min(3) rejects it.
    expect(isAccepted(atLeastThree, "\u{1F600}")).toBe(false);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(isAccepted(atLeastThree, value)).toBe(true);
  });

  it("defaults its code to the plugin name and reports the actual length", () => {
    const issue = firstIssue(atLeastThree, "ab");
    expect(issue.code).toBe("stringMin");
    expect(issue.path).toBe("text");
    expect(issue.message).toBe(
      "String must have at least 3 characters, but got 2"
    );
  });

  it("honours options.code, options.messageFactory and options.severity", () => {
    const custom = Builder()
      .use(stringMinPlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.min(3, {
          code: "TOO_SHORT",
          severity: "warning",
          messageFactory: (context) =>
            `${context.path}: ${String(context.actual)} < ${String(context.min)}`,
        })
      )
      .build();
    const issue = firstIssue(custom, "a");
    expect(issue.code).toBe("TOO_SHORT");
    expect(issue.severity).toBe("warning");
    expect(issue.message).toBe("text: 1 < 3");
  });

  it("rejects a nonsensical bound at BUILD time, not at validate time", () => {
    const build = (min: number): unknown =>
      Builder()
        .use(stringMinPlugin)
        .for<StringModel>()
        .v("text", (b) => b.string.min(min))
        .build();
    expect(() => build(-1)).toThrow(/invalid argument "min"/);
    expect(() => build(Number.NaN)).toThrow(/invalid argument "min"/);
  });
});
