// ===========================================================================
// L7  src/plugins/string-regex/is-ecma262-regex.ts
// Draft-07 §7.3.8 defines `regex` as "a regular expression, as described in
// ECMA 262". The platform RegExp constructor IS that grammar, so the check is
// "does the engine accept it" and not a second, hand-written pattern grammar —
// there is nothing here for a regex table to drift from.
//
// CSP: `new RegExp(source)` compiles a pattern, it does not evaluate program
// text. It is not `eval` and not `new Function`, and the no-dynamic-code gate
// greps for those two.
// ===========================================================================

/** True when `source` compiles as an ECMA-262 pattern with no flags. */
export function isEcma262Regex(source: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}
