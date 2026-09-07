import { Builder } from "../../../../src/index";
import { stringDurationPlugin } from "../../../../src/plugins/string-duration";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  type StringModel,
} from "./string-model";

const duration = Builder()
  .use(stringDurationPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.duration())
  .build();

describe("stringDuration", () => {
  it.each([
    ["P1Y", true],
    ["P1Y2M3DT4H5M6S", true],
    ["P3W", true],
    ["PT0.5S", true],
    ["PT1M", true],
    ["P", false],
    ["PT", false],
    ["1Y", false],
    ["P1S", false],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(duration, value)).toBe(expected);
  });

  it("keeps the week designator the JSON Schema table had dropped", () => {
    expect(isAccepted(duration, "P2W")).toBe(true);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(isAccepted(duration, value)).toBe(true);
  });

  it("has an overridable code, which 1.x's FORMAT_DURATION was not", () => {
    expect(firstIssue(duration, "P").code).toBe("stringDuration");
    expect(firstIssue(duration, "P").message).toBe(
      "Value must be a valid ISO 8601 duration"
    );
    const custom = Builder()
      .use(stringDurationPlugin)
      .for<StringModel>()
      .v("text", (b) => b.string.duration({ code: "FORMAT_DURATION" }))
      .build();
    expect(firstIssue(custom, "P").code).toBe("FORMAT_DURATION");
  });
});
