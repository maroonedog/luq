// ===========================================================================
// L1  src/path/create-value-reader.ts
// The ONE resolver: segments in, one value out. Compiled at build time into a
// closure so validation never inspects the template again.
//
// The legacy createNestedValueAccessor returned three different shapes by
// segment count (a value, the raw ARRAY, or an `__isArrayElementField` marker)
// and mapped only the first array it met. None of that survives: a dotted
// segment that lands on an array resolves to the array, full stop. Traversal
// happens only where the path says `[*]`, and that is the array runner's job.
// ===========================================================================
import type { PathSegment } from "./path-segment.types";
import { PathSyntaxError, assertDeclarableKey } from "./reserved-segment";

export type ValueReader = (subject: unknown) => unknown;

const hasOwnProperty = Object.prototype.hasOwnProperty;

/** True for arrays too: both are indexable by a string key. */
export function isIndexableObject(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Own properties only. `in` and plain member access walk the prototype chain,
 * which is how the legacy tree reported `toString` as a present field. A
 * primitive intermediate does NOT descend (`{user:"John"}` at `user.name` is
 * undefined, not `"John".name`), and an array hole is absent rather than
 * undefined-valued — the same answer either way, reached honestly.
 */
export function readOwnProperty(subject: unknown, key: string): unknown {
  if (!isIndexableObject(subject)) return undefined;
  return hasOwnProperty.call(subject, key) ? subject[key] : undefined;
}

/**
 * Validates a template and flattens it to plain keys. Shared with the writer
 * so the two directions cannot disagree about what a template may contain.
 *
 * A `[*]` segment is rejected: a wildcard names many values, and this reader
 * has one return value. The array runner splits a wildcard template into an
 * array node plus an element template before it ever gets here.
 */
export function collectKeySegments(
  template: readonly PathSegment[]
): readonly string[] {
  const rendered = describeTemplate(template);
  const keys: string[] = [];
  for (const segment of template) {
    if (segment.kind === "each") {
      throw new PathSyntaxError(
        rendered,
        "a single-value template must not contain a wildcard segment"
      );
    }
    assertDeclarableKey(segment.key, rendered);
    keys.push(segment.key);
  }
  return keys;
}

function describeTemplate(template: readonly PathSegment[]): string {
  return template
    .map((segment) => (segment.kind === "each" ? "[*]" : segment.key))
    .join(".");
}

/**
 * An empty template is the identity reader: the element of `items[*]` is
 * declared relative to itself, and that is a real compiled field.
 */
export function createValueReader(
  template: readonly PathSegment[]
): ValueReader {
  const keys = collectKeySegments(template);
  const only = keys[0];
  if (keys.length === 0) return (subject) => subject;
  if (keys.length === 1 && only !== undefined) {
    return (subject) => readOwnProperty(subject, only);
  }
  return (subject) => {
    let current = subject;
    for (const key of keys) {
      current = readOwnProperty(current, key);
      if (current === undefined) return undefined;
    }
    return current;
  };
}
