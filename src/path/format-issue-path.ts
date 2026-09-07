// ===========================================================================
// L1  src/path/format-issue-path.ts
// The declaration grammar takes `[*]`; the ISSUE grammar emits `[n]` only.
// This is the one place a concrete index stack becomes a path string.
// ===========================================================================
import type { PathSegment } from "./path-segment.types";

/**
 * `[key items, each, key name]` with `[0]` renders `items[0].name`; a nested
 * template with `[0, 2]` renders `matrix[0][2]`. An empty template renders
 * `""`, which is the path a root-level failure carries.
 *
 * Wildcards consume `indices` left to right, outermost first — the order the
 * index stack pushes them in.
 *
 * Too few indices is a bug in the caller, not a data condition, so it throws
 * rather than rendering a `[*]` that would then look like a declaration path.
 * Surplus indices are ignored: the stack may still hold entries belonging to
 * array nodes above this template.
 */
export function formatIssuePath(
  template: readonly PathSegment[],
  indices: readonly number[]
): string {
  let rendered = "";
  let consumed = 0;
  for (const segment of template) {
    if (segment.kind === "key") {
      rendered += rendered === "" ? segment.key : `.${segment.key}`;
      continue;
    }
    const index = indices[consumed];
    if (index === undefined) {
      throw new RangeError(
        `formatIssuePath needs ${consumed + 1} index/indices for the template ` +
          `but received ${indices.length}`
      );
    }
    consumed += 1;
    rendered += `[${index}]`;
  }
  return rendered;
}
