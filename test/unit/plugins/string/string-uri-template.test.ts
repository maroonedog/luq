import { Builder } from "../../../../src/index";
import { stringUriTemplatePlugin } from "../../../../src/plugins/string-uri-template";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  type StringModel,
} from "./string-model";

const uriTemplate = Builder()
  .use(stringUriTemplatePlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.uriTemplate())
  .build();

describe("stringUriTemplate", () => {
  it.each([
    ["http://example.com/dictionary", true],
    ["http://example.com/dictionary/{term:1}/{term}", true],
    ["{?query,number}", true],
    ["{+path}/here", true],
    ["{#hash}", true],
    ["{list*}", true],
    ["{var.name}", true],
    ["http://example.com/dictionary/{term:1}/{term", false],
    ["{}", false],
    ["{a{b}}", false],
    ["}{", false],
    ["{term:12345}", false],
    ["{term*x}", false],
    ["{.leadingDot}", false],
    ["{bad-name}", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(uriTemplate, value)).toBe(expected);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(isAccepted(uriTemplate, value)).toBe(true);
  });

  it("has an overridable code, which 1.x's FORMAT_URI_TEMPLATE was not", () => {
    expect(firstIssue(uriTemplate, "{}").code).toBe("stringUriTemplate");
    expect(firstIssue(uriTemplate, "{}").message).toBe(
      "Value must be a valid URI Template (RFC 6570)"
    );
    const custom = Builder()
      .use(stringUriTemplatePlugin)
      .for<StringModel>()
      .v("text", (b) => b.string.uriTemplate({ code: "FORMAT_URI_TEMPLATE" }))
      .build();
    expect(firstIssue(custom, "{}").code).toBe("FORMAT_URI_TEMPLATE");
  });
});
