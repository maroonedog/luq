// ===========================================================================
// L1  src/path/match-path-pattern.ts
// The round trip between the two grammars: does the issue path `items[0].name`
// belong to the declaration `items[*].name`?
//
// The legacy version built a RegExp by string replacement on every call. This
// scans the concrete path against the already-parsed template instead, so a
// key containing a regex metacharacter cannot change the meaning of the match
// and no pattern is ever compiled from user text.
// ===========================================================================
import { parseFieldPath } from "./parse-field-path";

/**
 * `pattern` is a declaration path and is PARSED, so a malformed pattern throws
 * PathSyntaxError rather than quietly matching nothing.
 *
 * `concretePath` is untrusted text (it may come straight from a caller
 * filtering issues) and is only scanned: a `[*]` in it fails the digit rule
 * and returns false, which keeps the two grammars from meeting in the middle.
 */
export function matchPathPattern(
  pattern: string,
  concretePath: string
): boolean {
  const template = parseFieldPath(pattern);
  let cursor = 0;
  for (let i = 0; i < template.length; i += 1) {
    const segment = template[i];
    if (segment === undefined) return false;
    if (segment.kind === "key") {
      if (i > 0) {
        if (concretePath[cursor] !== ".") return false;
        cursor += 1;
      }
      if (!concretePath.startsWith(segment.key, cursor)) return false;
      cursor += segment.key.length;
      continue;
    }
    const afterIndex = scanIndex(concretePath, cursor);
    if (afterIndex === null) return false;
    cursor = afterIndex;
  }
  return cursor === concretePath.length;
}

/** Consumes `[<digits>]` at `from`, returning the position after it. */
function scanIndex(concretePath: string, from: number): number | null {
  if (concretePath[from] !== "[") return null;
  let cursor = from + 1;
  let digits = 0;
  while (isDigit(concretePath[cursor])) {
    cursor += 1;
    digits += 1;
  }
  if (digits === 0) return null;
  if (concretePath[cursor] !== "]") return null;
  return cursor + 1;
}

function isDigit(character: string | undefined): boolean {
  return character !== undefined && character >= "0" && character <= "9";
}
