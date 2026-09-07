// ===========================================================================
// L7  src/plugins/string-content-encoding/content-encoding-checks.ts
// The six encodings JSON Schema's contentEncoding keyword can name here, as a
// CLOSED table. 1.x returned true for any name it did not know, so
// `.contentEncoding("totally-made-up")` validated everything; a lookup that
// can miss is what made that possible, so this one reports the miss and the
// caller turns it into a build-time error.
//
// Nothing here decodes. Recognition is a pure predicate over the text, which
// keeps Buffer and atob — and their environment-dependent answers — out of src.
// ===========================================================================
export type ContentEncodingName =
  | "base64"
  | "base32"
  | "binary"
  | "7bit"
  | "8bit"
  | "quoted-printable";

export type ContentEncodingCheck = (value: string) => boolean;

const BASE64_ALPHABET = /^[A-Za-z0-9+/]*={0,2}$/;
const BASE32_ALPHABET = /^[A-Z2-7]*={0,6}$/;
const BINARY_DIGITS = /^[01\s]*$/;
const HEX_PAIR = /^[0-9A-Fa-f]{2}$/;
const LINE_BREAK = /\r?\n/;

const MAX_QUOTED_LINE_LENGTH = 76;
const HIGHEST_ASCII = 127;

function isBase64Text(value: string): boolean {
  if (value.length === 0) return true;
  return value.length % 4 === 0 && BASE64_ALPHABET.test(value);
}

function isBase32Text(value: string): boolean {
  if (value.length === 0) return true;
  return value.length % 8 === 0 && BASE32_ALPHABET.test(value);
}

function isSevenBitText(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > HIGHEST_ASCII) return false;
  }
  return true;
}

/** Every "=" starts a hex escape or ends the line as a soft break. */
function isQuotedPrintableLine(line: string): boolean {
  if (line.length > MAX_QUOTED_LINE_LENGTH) return false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== "=") continue;
    if (index === line.length - 1) continue;
    if (!HEX_PAIR.test(line.slice(index + 1, index + 3))) return false;
  }
  return true;
}

function isQuotedPrintableText(value: string): boolean {
  return value.split(LINE_BREAK).every(isQuotedPrintableLine);
}

const CONTENT_ENCODING_CHECKS: ReadonlyMap<
  ContentEncodingName,
  ContentEncodingCheck
> = new Map<ContentEncodingName, ContentEncodingCheck>([
  ["base64", isBase64Text],
  ["base32", isBase32Text],
  ["binary", (value) => BINARY_DIGITS.test(value)],
  ["7bit", isSevenBitText],
  ["8bit", () => true],
  ["quoted-printable", isQuotedPrintableText],
]);

function isContentEncodingName(value: string): value is ContentEncodingName {
  return (
    value === "base64" ||
    value === "base32" ||
    value === "binary" ||
    value === "7bit" ||
    value === "8bit" ||
    value === "quoted-printable"
  );
}

/** Encoding names are matched case-insensitively, as in 1.x. */
export function findContentEncodingCheck(
  encoding: string
): ContentEncodingCheck | undefined {
  const normalized = encoding.toLowerCase();
  return isContentEncodingName(normalized)
    ? CONTENT_ENCODING_CHECKS.get(normalized)
    : undefined;
}
