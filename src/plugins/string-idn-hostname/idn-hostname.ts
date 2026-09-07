// ===========================================================================
// L7  src/plugins/string-idn-hostname/idn-hostname.ts
// RFC 5890/5891 IDNA2008, to the depth this library actually checks — and the
// depth is stated here rather than implied, because the failure this rewrite
// exists to end is a format that LOOKS supported and asserts nothing.
//
// ENFORCED: total length <= 253; every label 1..63 code points; no empty label
// (so no leading dot, no trailing dot, no ".."); no leading or trailing "-";
// the RFC 5891 4.2.3.1 hyphen restriction (no "--" in the 3rd and 4th position
// unless the label is an "xn--" A-label); an A-label's remainder is ASCII
// letter-digit-hyphen; no ASCII character outside letter-digit-hyphen — which
// covers control characters, space, DEL and every ASCII punctuation mark other
// than "-"; and RFC 5891 4.2.3.2, a label may not BEGIN with a combining mark.
//
// NOT ENFORCED: the IDNA2008 derived-property tables (which non-ASCII code
// points are PVALID / DISALLOWED / CONTEXTJ), Bidi rule conformance, and
// Punycode decodability of an A-label. Every code point above U+007F is
// accepted. Those tables are megabytes; naming the gap is the honest
// alternative to pretending it is closed.
// ===========================================================================
const MAX_HOSTNAME_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;
const HIGHEST_ASCII = 0x7f;
const ASCII_LETTER_DIGIT_HYPHEN = /^[A-Za-z0-9-]*$/;
const LEADING_COMBINING_MARK = /^\p{M}/u;
const A_LABEL_PREFIX = "xn--";

function countCodePoints(value: string): number {
  return [...value].length;
}

/**
 * An ASCII code point outside letter-digit-hyphen. Written as a scan rather
 * than as a character class so the ranges are arithmetic a reader can check,
 * not an escape sequence a reader has to decode.
 */
function hasDisallowedAscii(label: string): boolean {
  for (const character of label) {
    const code = character.codePointAt(0) ?? 0;
    if (code > HIGHEST_ASCII) continue;
    if (!ASCII_LETTER_DIGIT_HYPHEN.test(character)) return true;
  }
  return false;
}

function hasReservedHyphens(label: string): boolean {
  return label.slice(2, 4) === "--" && !label.startsWith(A_LABEL_PREFIX);
}

function isLabel(label: string): boolean {
  const length = countCodePoints(label);
  if (length === 0 || length > MAX_LABEL_LENGTH) return false;
  if (label.startsWith("-") || label.endsWith("-")) return false;
  if (hasDisallowedAscii(label)) return false;
  if (LEADING_COMBINING_MARK.test(label)) return false;
  if (hasReservedHyphens(label)) return false;
  return (
    !label.startsWith(A_LABEL_PREFIX) ||
    ASCII_LETTER_DIGIT_HYPHEN.test(label.slice(A_LABEL_PREFIX.length))
  );
}

export function isIdnHostname(value: string): boolean {
  if (value.length === 0) return false;
  if (countCodePoints(value) > MAX_HOSTNAME_LENGTH) return false;
  return value.split(".").every(isLabel);
}
