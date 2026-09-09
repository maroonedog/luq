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

  // min(0) は「下限を課さない」であって「一文字以上」ではない。走査は
  // min に届いた時点で止めるので、空文字列ではループ本体が一度も回らない —
  // 早期脱出に書き換えたとき、この境界だけが素通りして穴が開いた。
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

  // 走査を打ち切っても actual は真の長さを報告しなければならない。落ちる値は
  // 定義上 min より短いので、打ち切りは起きない — それを固定しておく。
  it("reports the true length as actual, even though the walk can stop early", () => {
    const issue = firstIssue(atLeastThree, "ab");
    expect(issue.message).toContain("2");
  });

  // 符号位置で数える契約は変えていない。星座面の一文字は UTF-16 では 2 単位で、
  // .length を使うと min(2) を通ってしまう。
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
