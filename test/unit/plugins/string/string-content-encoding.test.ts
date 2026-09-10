import { Builder } from "../../../../src/index";
import { stringContentEncodingPlugin } from "../../../../src/plugins/string-content-encoding";
import type { ContentEncodingName } from "../../../../src/plugins/string-content-encoding";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  passesThrough,
  type StringModel,
  type StringValidator,
} from "./string-model";

function encodedAs(encoding: ContentEncodingName): StringValidator {
  return Builder()
    .use(stringContentEncodingPlugin)
    .for<StringModel>()
    .v("text", (b) => b.string.contentEncoding(encoding))
    .build();
}

const base64 = encodedAs("base64");
const base32 = encodedAs("base32");
const binary = encodedAs("binary");
const sevenBit = encodedAs("7bit");
const eightBit = encodedAs("8bit");
const quotedPrintable = encodedAs("quoted-printable");

describe("stringContentEncoding", () => {
  it("base64: empty is valid, length must be a multiple of 4", () => {
    expect(isAccepted(base64, "")).toBe(true);
    expect(isAccepted(base64, "aGVsbG8=")).toBe(true);
    expect(isAccepted(base64, "aGVsbG8")).toBe(false);
    expect(isAccepted(base64, "aGVs*G8=")).toBe(false);
  });

  it("base32: empty is valid, length must be a multiple of 8", () => {
    expect(isAccepted(base32, "")).toBe(true);
    expect(isAccepted(base32, "MZXW6===")).toBe(true);
    expect(isAccepted(base32, "MZXW6==")).toBe(false);
    expect(isAccepted(base32, "mzxw6===")).toBe(false);
  });

  it("binary accepts only 0, 1 and whitespace", () => {
    expect(isAccepted(binary, "0101 1010")).toBe(true);
    expect(isAccepted(binary, "")).toBe(true);
    expect(isAccepted(binary, "0102")).toBe(false);
  });

  it("7bit rejects any code unit above 127; 8bit accepts everything", () => {
    expect(isAccepted(sevenBit, "plain ascii")).toBe(true);
    expect(isAccepted(sevenBit, "café")).toBe(false);
    expect(isAccepted(eightBit, "café")).toBe(true);
    expect(isAccepted(eightBit, "\u{1F600}")).toBe(true);
  });

  it("quoted-printable caps a line at 76 and checks every escape", () => {
    expect(isAccepted(quotedPrintable, "caf=C3=A9")).toBe(true);
    expect(isAccepted(quotedPrintable, "soft break =\nrest")).toBe(true);
    expect(isAccepted(quotedPrintable, "caf=ZZ")).toBe(false);
    expect(isAccepted(quotedPrintable, "a".repeat(77))).toBe(false);
    expect(
      isAccepted(quotedPrintable, `${"a".repeat(70)}\n${"b".repeat(70)}`)
    ).toBe(true);
  });

  it("matches the encoding name case-insensitively", () => {
    const shouted = Builder()
      .use(stringContentEncodingPlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.contentEncoding("BASE64" as ContentEncodingName)
      )
      .build();
    expect(isAccepted(shouted, "aGVsbG8")).toBe(false);
    expect(isAccepted(shouted, "aGVsbG8=")).toBe(true);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(passesThrough(base64, value)).toBe(true);
  });

  it("REFUSES an unknown encoding at build time instead of passing all", () => {
    // 1.x returned true for any name it did not recognise, so
    // .contentEncoding("totally-made-up") validated every input.
    expect(() =>
      Builder()
        .use(stringContentEncodingPlugin)
        .for<StringModel>()
        .v("text", (b) =>
          b.string.contentEncoding(
            "totally-made-up" as unknown as ContentEncodingName
          )
        )
        .build()
    ).toThrow(/invalid argument "encoding"/);
  });

  it("has an overridable code, which 1.x's CONTENT_ENCODING was not", () => {
    expect(firstIssue(base64, "aGVsbG8").code).toBe("stringContentEncoding");
    expect(firstIssue(base64, "aGVsbG8").message).toBe(
      "Value must be valid base64 encoded content"
    );
    const custom = Builder()
      .use(stringContentEncodingPlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.contentEncoding("base64", {
          code: "CONTENT_ENCODING",
          messageFactory: (context) => `enc=${context.encoding}`,
        })
      )
      .build();
    const issue = firstIssue(custom, "aGVsbG8");
    expect(issue.code).toBe("CONTENT_ENCODING");
    expect(issue.message).toBe("enc=base64");
  });
});
