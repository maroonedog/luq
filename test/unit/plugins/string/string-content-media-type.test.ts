import { Builder } from "../../../../src/index";
import { stringContentMediaTypePlugin } from "../../../../src/plugins/string-content-media-type";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  type StringModel,
  type StringValidator,
} from "./string-model";

function typedAs(mediaType: string): StringValidator {
  return Builder()
    .use(stringContentMediaTypePlugin)
    .for<StringModel>()
    .v("text", (b) => b.string.contentMediaType(mediaType))
    .build();
}

const json = typedAs("application/json");
const html = typedAs("text/html");
const xml = typedAs("text/xml");
const svg = typedAs("image/svg+xml");
const plain = typedAs("text/plain");

describe("stringContentMediaType", () => {
  it("application/json parses the text", () => {
    expect(isAccepted(json, '{"a":1}')).toBe(true);
    expect(isAccepted(json, "[1,2]")).toBe(true);
    expect(isAccepted(json, "{a:1}")).toBe(false);
    expect(isAccepted(json, "")).toBe(false);
  });

  it("text/html looks for an element", () => {
    expect(isAccepted(html, "<p>hi</p>")).toBe(true);
    expect(isAccepted(html, "plain words")).toBe(false);
  });

  it("xml accepts a declaration or a root element", () => {
    expect(isAccepted(xml, '<?xml version="1.0"?><a/>')).toBe(true);
    expect(isAccepted(xml, "<root><a/></root>")).toBe(true);
    expect(isAccepted(xml, "not xml")).toBe(false);
  });

  it("image/svg+xml looks for the svg element", () => {
    expect(isAccepted(svg, "<svg viewBox='0 0 1 1'><rect/></svg>")).toBe(true);
    expect(isAccepted(svg, "<p>hi</p>")).toBe(false);
  });

  it("text/* accepts any text", () => {
    expect(isAccepted(plain, "anything at all")).toBe(true);
    expect(isAccepted(typedAs("text/markdown"), "# heading")).toBe(true);
  });

  it("follows the structured suffix for a vendor media type", () => {
    expect(isAccepted(typedAs("application/vnd.api+json"), '{"a":1}')).toBe(
      true
    );
    expect(isAccepted(typedAs("application/vnd.api+json"), "nope")).toBe(false);
    expect(isAccepted(typedAs("application/atom+xml"), "<feed/>")).toBe(true);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(isAccepted(json, value)).toBe(true);
  });

  it("REFUSES an unrecognisable media type at build time", () => {
    // 1.x returned true for anything it could not recognise, and sniffed
    // magic bytes for image/png and friends by decoding base64 through
    // Buffer/atob. Both are gone; a media type src cannot check is refused.
    expect(() => typedAs("application/octet-stream")).toThrow(
      /invalid argument "mediaType"/
    );
    expect(() => typedAs("image/png")).toThrow(/invalid argument "mediaType"/);
  });

  it("has an overridable code, which 1.x's CONTENT_MEDIA_TYPE was not", () => {
    expect(firstIssue(json, "nope").code).toBe("stringContentMediaType");
    expect(firstIssue(json, "nope").message).toBe(
      "Value must be valid application/json content"
    );
    const custom = Builder()
      .use(stringContentMediaTypePlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.contentMediaType("application/json", {
          code: "CONTENT_MEDIA_TYPE",
          messageFactory: (context) => `type=${context.mediaType}`,
        })
      )
      .build();
    const issue = firstIssue(custom, "nope");
    expect(issue.code).toBe("CONTENT_MEDIA_TYPE");
    expect(issue.message).toBe("type=application/json");
  });
});
