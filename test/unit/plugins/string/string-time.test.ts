import { Builder } from "../../../../src/index";
import { stringTimePlugin } from "../../../../src/plugins/string-time";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  passesThrough,
  type StringModel,
} from "./string-model";

const byDefault = Builder()
  .use(stringTimePlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.time())
  .build();

const withoutMilliseconds = Builder()
  .use(stringTimePlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.time({ allowMilliseconds: false }))
  .build();

describe("stringTime", () => {
  it.each([
    ["00:00:00", true],
    ["23:59:59", true],
    ["10:20:30.5", true],
    ["10:20:30.123", true],
    ["24:00:00", false],
    ["10:60:00", false],
    ["10:20", false],
    ["10:20:30.1234", false],
    ["10:20:30Z", false],
    ["10:20:30+09:00", false],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(byDefault, value)).toBe(expected);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(passesThrough(byDefault, value)).toBe(true);
  });

  it("only an EXPLICIT false forbids the fractional part", () => {
    expect(isAccepted(withoutMilliseconds, "10:20:30.123")).toBe(false);
    expect(isAccepted(withoutMilliseconds, "10:20:30")).toBe(true);
    const undefinedFlag = Builder()
      .use(stringTimePlugin)
      .for<StringModel>()
      .v("text", (b) => b.string.time({ allowMilliseconds: undefined }))
      .build();
    expect(isAccepted(undefinedFlag, "10:20:30.123")).toBe(true);
  });

  it("has an overridable code, which 1.x's FORMAT_TIME was not", () => {
    expect(firstIssue(byDefault, "nope").code).toBe("stringTime");
    expect(firstIssue(byDefault, "nope").message).toBe(
      "Value must be a valid time format (HH:MM:SS)"
    );
    const custom = Builder()
      .use(stringTimePlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.time(undefined, {
          code: "FORMAT_TIME",
          messageFactory: (context) =>
            `ms=${String(context.allowMilliseconds)}`,
        })
      )
      .build();
    const issue = firstIssue(custom, "nope");
    expect(issue.code).toBe("FORMAT_TIME");
    expect(issue.message).toBe("ms=true");
  });
});
