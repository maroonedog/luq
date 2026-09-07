import { Builder } from "../../../../src/index";
import { stringRelativeJsonPointerPlugin } from "../../../../src/plugins/string-relative-json-pointer";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  type StringModel,
} from "./string-model";

const relative = Builder()
  .use(stringRelativeJsonPointerPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.relativeJsonPointer())
  .build();

describe("stringRelativeJsonPointer", () => {
  it.each([
    ["0", true],
    ["1", true],
    ["12", true],
    ["0#", true],
    ["1/foo", true],
    ["2/foo/0", true],
    ["0/a~1b", true],
    ["01", false],
    ["-1", false],
    ["", false],
    ["#", false],
    ["/foo", false],
    ["1#/foo", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(relative, value)).toBe(expected);
  });

  it("actually inspects the POINTER half", () => {
    // jsonSchema/format-validators.ts tested only /^[0-9]+#?$/, so it never
    // looked past the leading count: "0/a~2b" passed there and failed in the
    // plugin. One rule now, and it is the plugin's.
    expect(isAccepted(relative, "0/a~2b")).toBe(false);
    expect(isAccepted(relative, "0/a~")).toBe(false);
    expect(isAccepted(relative, "0foo")).toBe(false);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(isAccepted(relative, value)).toBe(true);
  });

  it("has an overridable code, which 1.x's SCREAMING_SNAKE one was not", () => {
    expect(firstIssue(relative, "01").code).toBe("stringRelativeJsonPointer");
    expect(firstIssue(relative, "01").message).toBe(
      "Value must be a valid Relative JSON Pointer"
    );
    const custom = Builder()
      .use(stringRelativeJsonPointerPlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.relativeJsonPointer({ code: "FORMAT_RELATIVE_JSON_POINTER" })
      )
      .build();
    expect(firstIssue(custom, "01").code).toBe("FORMAT_RELATIVE_JSON_POINTER");
  });
});
