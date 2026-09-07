// ===========================================================================
// L1  src/path/create-array-reader.ts
// The reader for an array node's OWN path.
//
// It exists as its own function so the array runner has no branch: a value
// that is not an array comes back as null, already decided at the boundary.
// The legacy tree spelled the same rule as `if (!Array.isArray(arrayData))
// return` in two places and forgot it in a third, which is how `matrix[*][*]`
// became silently unvalidated.
// ===========================================================================
import type { PathSegment } from "./path-segment.types";
import { createValueReader } from "./create-value-reader";
import { isArray } from "../types";

export type ArrayReader = (subject: unknown) => readonly unknown[] | null;

/**
 * null means "there is no array here", which the runner treats as "element
 * rules are vacuous" — the must-preserve contract that a non-array at an `[*]`
 * path produces no issue from the element rule. Asserting that the container
 * IS an array is a separate, declared rule on the container path.
 *
 * An empty array is an array: it reads back as `[]`, and the element loop then
 * runs zero times. That distinction is the whole reason this returns
 * `readonly unknown[] | null` and not `readonly unknown[]`.
 */
export function createArrayReader(
  template: readonly PathSegment[]
): ArrayReader {
  const read = createValueReader(template);
  return (subject) => {
    const value = read(subject);
    return isArray(value) ? value : null;
  };
}
