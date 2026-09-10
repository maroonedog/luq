// ===========================================================================
// L8  src/json-schema/follow-json-pointer.ts — walks an RFC 6901 pointer.
//
// Answers only WHERE INSIDE a document, never WHICH document. Choosing the
// document is a separate job, kept separate because base-URI arithmetic and
// pointer decoding are different problems and neither reads well once they
// share a file.
// ===========================================================================
import { isArray, isPlainObject } from "../types";

/** RFC 6901: `~1` is "/" and `~0` is "~", decoded in that order. */
function decodePointerToken(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

/**
 * A `$ref` is a URI and the pointer is its fragment. RFC 6901 §6 says the
 * fragment is percent-encoded by the fragment rules, so **the whole fragment
 * is decoded before splitting on slashes**.
 *
 * The order matters. `#/definitions/percent%25field` decodes to
 * `/definitions/percent%field` and is split from there. Splitting first and
 * decoding each token does decode `%25`, but then `%2F` turns back into a
 * separator, which is not what the spec says it means.
 *
 * decodeURIComponent throws on a malformed sequence like `%zz`, and a
 * pointer that cannot be decoded is used as-is. Throwing here would make one
 * broken pointer take the whole document down.
 */
function decodeFragment(pointer: string): string {
  try {
    return decodeURIComponent(pointer);
  } catch {
    return pointer;
  }
}

/** `fragment` is what came AFTER the "#", so there is no prefix to strip. */
export function toPointerTokens(fragment: string): readonly string[] {
  const pointer = decodeFragment(fragment);
  if (pointer === "") return [];
  // "/" is the empty-string key directly under the root, not an empty token
  // list. Returning [] here would turn a pointer at `{"": ...}` into the root.
  return pointer.split("/").slice(1).map(decodePointerToken);
}

/**
 * `definitions` and `$defs` are the same container to a pointer: a Draft-07
 * document spells it one way, a 2019-09 document the other, and a schema that
 * mixes them (they exist) must still resolve. A real `definitions` member
 * always wins, so a property literally named "definitions" is unaffected.
 */
export function stepInto(current: unknown, token: string): unknown {
  if (isArray(current)) return current[Number(token)];
  if (!isPlainObject(current)) return undefined;
  if (token === "definitions" || token === "$defs") {
    return current["definitions"] ?? current["$defs"];
  }
  return current[token];
}

/**
 * Walks the pointer while **counting every `$id` crossed on the way**.
 *
 * When an intermediate node along the path carries `$id: "folder/"`, a
 * relative `$ref` written deeper in must resolve under folder/. Looking only
 * at the `$id` of the node landed on loses every node passed through.
 *
 * How the base advances is supplied by the caller. This function only needs
 * to know which nodes were crossed and in what order; it does no URI
 * arithmetic of its own.
 */
export function walkPointer<TScope>(
  fragment: string,
  document: unknown,
  scope: TScope,
  advance: (scope: TScope, node: unknown) => TScope,
  onMissing: (token: string) => never
): { readonly node: unknown; readonly scope: TScope } {
  let current: unknown = document;
  let here = scope;
  for (const token of toPointerTokens(fragment)) {
    current = stepInto(current, token);
    if (current === undefined) onMissing(token);
    here = advance(here, current);
  }
  return { node: current, scope: here };
}
