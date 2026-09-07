// ===========================================================================
// L7  src/plugins/string-idn-email/idn-email.ts
// RFC 6531 internationalized email address, to the depth this library actually
// checks. The scope is written down rather than implied, because a format that
// LOOKS supported and asserts nothing is the exact failure this rewrite ends.
//
// ENFORCED: exactly one address, split at the LAST "@"; a local part of 1..64
// code points that is either a quoted-string or a dot-atom (non-empty, no
// leading or trailing ".", no "..", none of the RFC 5322 specials and no
// whitespace or control character); and a domain of dot-separated labels, each
// 1..63 code points, none empty, none starting or ending with "-", none
// carrying an ASCII character outside letter-digit-hyphen, total <= 253.
//
// NOT ENFORCED: address literals ("user@[192.0.2.1]"), comments, folding
// white space, the IDNA2008 property tables and the Bidi rule. The full
// RFC 5891 label grammar — the reserved-hyphen rule, A-label decodability, the
// leading-combining-mark rule — lives in the stringIdnHostname plugin and a
// plugin may not import a sibling, so this file checks the label SHAPE only.
// Two formats, two owners; this is not a copy of that grammar and is not
// interchangeable with it.
// ===========================================================================
const MAX_LOCAL_LENGTH = 64;
const MAX_DOMAIN_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;
const HIGHEST_ASCII = 0x7f;
const ASCII_LETTER_DIGIT_HYPHEN = /^[A-Za-z0-9-]*$/;
/** RFC 5322 specials plus space and every control character. */
const LOCAL_SPECIALS = /["(),:;<>@[\\\]\s]/;

function countCodePoints(value: string): number {
  return [...value].length;
}

function hasDisallowedAscii(label: string): boolean {
  for (const character of label) {
    const code = character.codePointAt(0) ?? 0;
    if (code > HIGHEST_ASCII) continue;
    if (!ASCII_LETTER_DIGIT_HYPHEN.test(character)) return true;
  }
  return false;
}

function isDomainLabel(label: string): boolean {
  const length = countCodePoints(label);
  if (length === 0 || length > MAX_LABEL_LENGTH) return false;
  if (label.startsWith("-") || label.endsWith("-")) return false;
  return !hasDisallowedAscii(label);
}

function isDomain(domain: string): boolean {
  if (domain.length === 0) return false;
  if (countCodePoints(domain) > MAX_DOMAIN_LENGTH) return false;
  return domain.split(".").every(isDomainLabel);
}

function isQuotedLocal(local: string): boolean {
  if (local.length < 2 || !local.startsWith('"') || !local.endsWith('"')) {
    return false;
  }
  const inner = local.slice(1, -1);
  return !inner.includes('"') && !/[\r\n]/.test(inner);
}

function isDotAtomLocal(local: string): boolean {
  if (local.startsWith(".") || local.endsWith(".")) return false;
  if (local.includes("..")) return false;
  return !LOCAL_SPECIALS.test(local);
}

function isLocalPart(local: string): boolean {
  const length = countCodePoints(local);
  if (length === 0 || length > MAX_LOCAL_LENGTH) return false;
  return isQuotedLocal(local) || isDotAtomLocal(local);
}

export function isIdnEmail(value: string): boolean {
  const at = value.lastIndexOf("@");
  if (at < 0) return false;
  return isLocalPart(value.slice(0, at)) && isDomain(value.slice(at + 1));
}
