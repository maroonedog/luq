// ===========================================================================
// L10 src/standard-schema/split-issue-path.ts
//
// Opens an issue path ("items[1].productId") into the spec's segment list
// (["items", 1, "productId"]).
//
// Mind the direction: this reverses issue-path FORMATTING, and is not a parser
// for declared paths. An issue path never contains [*] — it carries the real
// index instead. Handling both grammars in one function is how [*] quietly
// starts being read as 0, so they are kept apart.
//
// Array indices come out as numbers. The spec's PropertyKey allows
// string | number | symbol, and the consumers — form libraries — are written
// expecting a number.
// ===========================================================================

/** The opened path: object keys as strings, array indices as numbers. */
export type IssuePathSegments = readonly (string | number)[];

const INDEX_PATTERN = /^\[(\d+)\]/;

/**
 * The root ("") is the empty list, which the spec reads as an issue on the
 * root itself.
 *
 * A shape that cannot be interpreted comes back as the whole path in one
 * string segment rather than being swallowed. Handing over something visibly
 * unopened beats dropping the issue.
 */
export function splitIssuePath(path: string): IssuePathSegments {
  if (path === "") return [];

  const segments: (string | number)[] = [];
  let rest = path;
  let expectKey = true;

  while (rest !== "") {
    if (expectKey) {
      const key = rest.slice(0, findKeyEnd(rest));
      if (key === "") return [path];
      segments.push(key);
      rest = rest.slice(key.length);
      expectKey = false;
      continue;
    }
    const index = INDEX_PATTERN.exec(rest);
    if (index !== null) {
      segments.push(Number(index[1]));
      rest = rest.slice(index[0].length);
      continue;
    }
    if (rest.startsWith(".")) {
      rest = rest.slice(1);
      expectKey = true;
      continue;
    }
    return [path];
  }

  return expectKey ? [path] : segments;
}

/** A key runs to the next "." or "[", or to the end when there is neither. */
function findKeyEnd(rest: string): number {
  const dot = rest.indexOf(".");
  const bracket = rest.indexOf("[");
  if (dot === -1) return bracket === -1 ? rest.length : bracket;
  if (bracket === -1) return dot;
  return Math.min(dot, bracket);
}
