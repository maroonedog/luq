// ===========================================================================
// L1  src/path/parse-field-path.ts
// The ONE function that turns a path string into segments. The legacy tree had
// four parsers that disagreed about `matrix[*][*]`; there is exactly one here,
// it runs at build time only, and validation never re-splits a string.
// ===========================================================================
import type { PathSegment } from "./path-segment.types";
import { PathSyntaxError, assertDeclarableKey } from "./reserved-segment";

const EACH_SUFFIX = "[*]";

const EACH_SEGMENT: PathSegment = Object.freeze({ kind: "each" });

/**
 * Grammar: `head ("." head)*` where `head` is `key ("[*]")*`.
 *
 * `[*]` is the DECLARATION wildcard and the only bracket form; `[0]` belongs
 * to the issue grammar (see formatIssuePath) and is rejected here, so a
 * wildcard path can never be emitted as an issue path or vice versa.
 */
export function parseFieldPath(path: string): readonly PathSegment[] {
  if (path === "") {
    throw new PathSyntaxError(path, "a field path must not be empty");
  }
  const segments: PathSegment[] = [];
  for (const head of path.split(".")) {
    appendHead(head, path, segments);
  }
  return Object.freeze(segments);
}

function appendHead(head: string, path: string, into: PathSegment[]): void {
  let key = head;
  let eachCount = 0;
  while (key.endsWith(EACH_SUFFIX)) {
    key = key.slice(0, -EACH_SUFFIX.length);
    eachCount += 1;
  }
  assertDeclarableKey(key, path);
  into.push(Object.freeze({ kind: "key", key }));
  for (let i = 0; i < eachCount; i += 1) into.push(EACH_SEGMENT);
}

/** The inverse of parseFieldPath. Exported so the round trip is testable and
 *  so parentFieldPath never rebuilds a path by string surgery. */
export function formatFieldPath(segments: readonly PathSegment[]): string {
  let rendered = "";
  segments.forEach((segment, index) => {
    if (segment.kind === "each") {
      rendered += EACH_SUFFIX;
      return;
    }
    rendered += index === 0 ? segment.key : `.${segment.key}`;
  });
  return rendered;
}

/**
 * The declared path one level up, or null at the top. Step 9 groups declared
 * child keys by this, so it must drop exactly one segment: the parent of
 * `items[*]` is `items`, and the parent of `matrix[*][*]` is `matrix[*]`.
 */
export function parentFieldPath(path: string): string | null {
  const segments = parseFieldPath(path);
  if (segments.length <= 1) return null;
  return formatFieldPath(segments.slice(0, -1));
}

/**
 * The final key of a path, or null when the path ends in a wildcard — an
 * element has an index, not a key. Returning null rather than `""` is what
 * lets step 9 tell "a declared child key of this object" from "the elements of
 * this array" without re-inspecting the string.
 */
export function leafKeyOf(path: string): string | null {
  const segments = parseFieldPath(path);
  const last = segments[segments.length - 1];
  if (last === undefined || last.kind === "each") return null;
  return last.key;
}
