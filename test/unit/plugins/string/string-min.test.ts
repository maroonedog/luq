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

  // min(0) imposes no lower bound; it does not mean "at least one character".
  // The walk stops as soon as min is reached, so on an empty string the loop
  // body never runs — the one boundary an early exit leaves open.
  it.each([
    ["", true],
    ["a", true],
  ] as const)("min(0) accepts %p", (value, expected) => {
    const noBound = Builder()
      .use(stringMinPlugin)
      .for<StringModel>()
      .v("text", (b) => b.string.min(0))
      .build();
    expect(isAccepted(noBound, value)).toBe(expected);
  });

  // Stopping early must not stop actual reporting the true length. A failing
  // value is by definition shorter than min, so the walk never stops early on
  // one — pinned here.
  it("reports the true length as actual, even though the walk can stop early", () => {
    const issue = firstIssue(atLeastThree, "ab");
    expect(issue.message).toContain("2");
  });

  // The contract to count code points is unchanged. One astral character is
  // two UTF-16 units, so .length would let it past min(2).
  it("counts code points, not UTF-16 units", () => {
    const atLeastTwo = Builder()
      .use(stringMinPlugin)
      .for<StringModel>()
      .v("text", (b) => b.string.min(2))
      .build();
    expect(isAccepted(atLeastTwo, "😀")).toBe(false);
    expect(isAccepted(atLeastTwo, "😀a")).toBe(true);
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
