import { Builder } from "../../../../src/index";
import { stringDatetimePlugin } from "../../../../src/plugins/string-datetime";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  type StringModel,
} from "./string-model";

const lenient = Builder()
  .use(stringDatetimePlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.datetime())
  .build();

const strict = Builder()
  .use(stringDatetimePlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.datetime({ strict: true }))
  .build();

describe("stringDatetime", () => {
  it.each([
    ["2024-01-01T10:20:30Z", true],
    ["2024-01-01T10:20:30.123Z", true],
    ["2024-01-01T10:20:30+09:00", true],
    ["2024-01-01T10:20:30", true],
    ["2024-01-01T24:00:00Z", false],
    ["2024-01-01T10:61:00Z", false],
    ["2024-02-30T10:20:30Z", false],
    ["2024-01-01 10:20:30Z", false],
    ["2024-01-01T10:20:30.1234Z", false],
    ["2024-01-01", false],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(lenient, value)).toBe(expected);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(isAccepted(lenient, value)).toBe(true);
  });

  it("strict makes a timezone designator mandatory", () => {
    expect(isAccepted(strict, "2024-01-01T10:20:30")).toBe(false);
    expect(isAccepted(strict, "2024-01-01T10:20:30Z")).toBe(true);
    expect(isAccepted(strict, "2024-01-01T10:20:30-05:00")).toBe(true);
  });

  it("keeps the PLUGIN's reading of an offset, not the JSON Schema table's", () => {
    // jsonSchema/format-validators.ts accepted only "Z"; the plugin accepted
    // +09:00. One format, one answer: the offset is valid.
    expect(isAccepted(lenient, "2024-01-01T10:20:30+09:00")).toBe(true);
    expect(isAccepted(strict, "2024-01-01T10:20:30+09:00")).toBe(true);
  });

  it("has an overridable code, which 1.x's FORMAT_DATETIME was not", () => {
    expect(firstIssue(lenient, "nope").code).toBe("stringDatetime");
    expect(firstIssue(lenient, "nope").message).toBe(
      "Value must be a valid ISO 8601 datetime"
    );
    const custom = Builder()
      .use(stringDatetimePlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.datetime(
          { strict: true },
          {
            code: "FORMAT_DATETIME",
            messageFactory: (context) => `strict=${String(context.strict)}`,
          }
        )
      )
      .build();
    const issue = firstIssue(custom, "2024-01-01T10:20:30");
    expect(issue.code).toBe("FORMAT_DATETIME");
    expect(issue.message).toBe("strict=true");
  });
});
