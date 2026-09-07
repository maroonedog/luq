// ===========================================================================
// L6  src/builder/create-projection-reader.ts
// pickAll()'s output side: one declared path becomes one closure that lifts the
// value(s) at that path out of a subject. Built ONCE, when pickAll() is called,
// which is what "the paths are pre-resolved at that moment" means.
//
// It is NOT a second traversal of the plan: nothing here validates, nothing
// here reads a rule. It is a projection, and it is expressed entirely by
// composing the L1 readers so the two directions cannot disagree about what a
// segment means. createValueReader refuses a wildcard on purpose (it has one
// return value), so a `[*]` is split off here and mapped, exactly as the array
// runner splits one.
// ===========================================================================
import { createArrayReader } from "../path/create-array-reader";
import { createValueReader } from "../path/create-value-reader";
import { parseFieldPath } from "../path/parse-field-path";
import type { PathSegment } from "../path/path-segment.types";

export type ProjectionReader = (subject: unknown) => unknown;

/** Throws PathSyntaxError at pickAll() time, naming the path, never later. */
export function createProjectionReader(path: string): ProjectionReader {
  return createSegmentProjection(parseFieldPath(path));
}

/**
 * A wildcard-free template reads one value. A wildcard template reads the array
 * before the first `[*]` and maps the rest over its elements, so
 * `items[*].name` projects to `string[]` and `grid[*][*]` to `unknown[][]` —
 * the same shape ValueAtPath gives the caller.
 *
 * A non-array at a wildcard path projects to `undefined` rather than to `[]`:
 * createArrayReader already answers null for "there is no array here", and
 * inventing an empty array would tell the caller the field was present.
 */
function createSegmentProjection(
  template: readonly PathSegment[]
): ProjectionReader {
  const wildcardAt = template.findIndex((segment) => segment.kind === "each");
  if (wildcardAt === -1) return createValueReader(template);
  const readArray = createArrayReader(template.slice(0, wildcardAt));
  const readElement = createSegmentProjection(template.slice(wildcardAt + 1));
  return (subject) => {
    const elements = readArray(subject);
    return elements === null ? undefined : elements.map(readElement);
  };
}
