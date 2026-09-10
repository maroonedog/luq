// ===========================================================================
// L1  src/path/create-value-writer.ts
// Copy-on-write. Used only when a field declared a transform or a default.
//
// The writer NEVER mutates its subject: it returns a new root in which only
// the objects along the written spine are fresh, and every untouched sibling
// keeps its identity. The legacy tree shipped four setters with three
// different auto-vivification rules, all of them mutating in place and one of
// them replacing a legitimate `0` / `""` / `false` intermediate with `{}`.
// ===========================================================================
import type { PathSegment } from "./path-segment.types";
import {
  collectKeySegments,
  isIndexableObject,
  readOwnProperty,
} from "./create-value-reader";
import { isArray } from "../types";

/** Returns the new root. It is NOT `void`: a copy-on-write write cannot report
 *  its result through the argument it refused to mutate. */
export type ValueWriter = (subject: unknown, value: unknown) => unknown;

export function createValueWriter(
  template: readonly PathSegment[]
): ValueWriter {
  const keys = collectKeySegments(template);
  if (keys.length === 0) return (_subject, value) => value;
  return (subject, value) => writeInto(subject, keys, 0, value);
}

function writeInto(
  container: unknown,
  keys: readonly string[],
  depth: number,
  value: unknown
): unknown {
  const key = keys[depth];
  if (key === undefined) return value;
  if (container === null || container === undefined) {
    return vivify(key, writeInto(undefined, keys, depth + 1, value));
  }
  if (!isIndexableObject(container)) return container;
  const child = readOwnProperty(container, key);
  const written = writeInto(child, keys, depth + 1, value);
  if (written === child) return container;
  return copyWith(container, key, written);
}

/**
 * Auto-vivification, restricted to the one case the legacy rule got wrong:
 * only a missing or null intermediate is created. A present primitive is left
 * exactly as it is (the `if (!isIndexableObject) return container` above), so
 * writing `a.b` into `{a: 0}` destroys nothing and returns the original root
 * by identity.
 *
 * The container created is always a plain object. A numeric segment does not
 * conjure an array — the declaration grammar cannot express `items[0]`, so a
 * numeric key here is a Record key.
 */
/**
 * Places a key as an own property. **Never with the assignment operator.**
 *
 * `copy[key] = value` on "__proto__" invokes the accessor on
 * Object.prototype: instead of creating an own property it swaps the
 * prototype. defineProperty ignores accessors and defines the own property, so
 * a property actually named "__proto__" can be held safely.
 *
 * "constructor" and "prototype" are data properties, so assignment would only
 * make own properties of them — but branching per key is how the branch gets
 * written wrong, so everything goes through this one path.
 *
 * This is what makes writing safe, and therefore what makes refusing these
 * names in the path grammar unnecessary. See reserved-segment.ts.
 */
function putOwnProperty(
  target: Record<string, unknown>,
  key: string,
  value: unknown
): void {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

function vivify(key: string, written: unknown): Record<string, unknown> {
  const created: Record<string, unknown> = {};
  putOwnProperty(created, key, written);
  return created;
}

function copyWith(
  container: Record<string, unknown>,
  key: string,
  value: unknown
): unknown {
  if (isArray(container)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) return container;
    const copy: unknown[] = container.slice();
    copy[index] = value;
    return copy;
  }
  // Spread copies own enumerable properties with CreateDataProperty, so no
  // setter runs here. Only assignment is dangerous.
  const copy: Record<string, unknown> = { ...container };
  putOwnProperty(copy, key, value);
  return copy;
}
