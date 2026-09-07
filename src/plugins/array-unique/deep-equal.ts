// ===========================================================================
// L7  src/plugins/array-unique/deep-equal.ts
// THE single equality definition behind `unique`.
//
// docs/legacy-spec/plugin-catalog-structural.md records two separate defects
// in the legacy answer and this module exists to close both:
//   * legacy switched from a `===` double loop to a Set at length 11, so
//     [NaN, NaN] was a duplicate in a long array and not in a short one. One
//     definition is used here at every length.
//   * the rewrite's first draft keyed on JSON.stringify, which is ORDER
//     dependent: {a:1,b:2} and {b:2,a:1} are the same value and were reported
//     as distinct. Keys are compared as a set, so order cannot matter.
//
// Leaves compare with SameValueZero (NaN equals NaN, +0 equals -0), which is
// the definition Set and Array.prototype.includes already use, so `unique` and
// `includes` agree about what "the same element" means.
// ===========================================================================

/** NaN equals NaN; +0 equals -0. `a !== a` is the NaN test that needs no cast. */
export function isSameValueZero(left: unknown, right: unknown): boolean {
  return left === right || (left !== left && right !== right);
}

/**
 * Structural comparison for arrays and PLAIN objects only. A Date, a RegExp, a
 * Map or a class instance compares by identity, because reading their own
 * enumerable keys would call every one of them equal to every other — a RegExp
 * has none at all.
 */
export function isDeepEqual(left: unknown, right: unknown): boolean {
  if (isSameValueZero(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      areElementsEqual(left, right)
    );
  }
  if (!isPlainRecord(left) || !isPlainRecord(right)) return false;
  return areEntriesEqual(left, right);
}

function areElementsEqual(
  left: readonly unknown[],
  right: readonly unknown[]
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (!isDeepEqual(left[index], right[index])) return false;
  }
  return true;
}

function areEntriesEqual(
  left: Record<string, unknown>,
  right: Record<string, unknown>
): boolean {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!isDeepEqual(left[key], right[key])) return false;
  }
  return true;
}

/** Object.prototype or a null prototype: anything else keeps its identity. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
