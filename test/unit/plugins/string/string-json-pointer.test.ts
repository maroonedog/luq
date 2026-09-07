import { Builder } from "../../../../src/index";
import { stringJsonPointerPlugin } from "../../../../src/plugins/string-json-pointer";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  type StringModel,
} from "./string-model";

const pointer = Builder()
  .use(stringJsonPointerPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.jsonPointer())
  .build();

describe("stringJsonPointer", () => {
  it.each([
    ["", true],
    ["/", true],
    ["/foo", true],
    ["/foo/0", true],
    ["/a~0b", true],
    ["/a~1b", true],
    ["/ ", true],
    ["foo", false],
    ["/a~2b", false],
    ["/a~", false],
    ["#/foo", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(pointer, value)).toBe(expected);
  });

  it("returns quickly on a long near-miss", () => {
    // The 1.x pattern nested two unbounded quantifiers over a class that also
    // matched "/", so this input backtracked pathologically.
    const started = Date.now();
    expect(isAccepted(pointer, `/${"a/".repeat(2000)}~`)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(isAccepted(pointer, value)).toBe(true);
  });

  it("has an overridable code, which 1.x's FORMAT_JSON_POINTER was not", () => {
    expect(firstIssue(pointer, "foo").code).toBe("stringJsonPointer");
    expect(firstIssue(pointer, "foo").message).toBe(
      "Value must be a valid JSON Pointer (RFC 6901)"
    );
    const custom = Builder()
      .use(stringJsonPointerPlugin)
      .for<StringModel>()
      .v("text", (b) => b.string.jsonPointer({ code: "FORMAT_JSON_POINTER" }))
      .build();
    expect(firstIssue(custom, "foo").code).toBe("FORMAT_JSON_POINTER");
  });
});
