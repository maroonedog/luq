import { Builder } from "../../../../src/index";
import { stringDatePlugin } from "../../../../src/plugins/string-date";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  type StringModel,
} from "./string-model";

const isoDate = Builder()
  .use(stringDatePlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.date())
  .build();

describe("stringDate", () => {
  it.each([
    ["2024-01-01", true],
    ["2024-02-29", true],
    ["2000-02-29", true],
    ["1900-02-29", false],
    ["2023-02-29", false],
    ["2024-13-01", false],
    ["2024-00-10", false],
    ["2024-04-31", false],
    ["2024-1-01", false],
    ["24-01-01", false],
    ["2024-01-01T00:00:00Z", false],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(isoDate, value)).toBe(expected);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    // 1.x's FORMAT_* plugins returned FALSE here, so a nullable date field
    // reported a format error for `null`. The whole catalog now agrees.
    expect(isAccepted(isoDate, value)).toBe(true);
  });

  it("has an overridable code, which 1.x's FORMAT_DATE was not", () => {
    expect(firstIssue(isoDate, "2024-13-01").code).toBe("stringDate");
    const custom = Builder()
      .use(stringDatePlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.date({
          code: "FORMAT_DATE",
          messageFactory: (context) => `bad date at ${context.path}`,
        })
      )
      .build();
    const issue = firstIssue(custom, "2024-13-01");
    expect(issue.code).toBe("FORMAT_DATE");
    expect(issue.message).toBe("bad date at text");
  });

  it("does not put the path in the default message", () => {
    expect(firstIssue(isoDate, "nope").message).toBe(
      "Value must be a valid ISO 8601 date (YYYY-MM-DD)"
    );
  });
});
