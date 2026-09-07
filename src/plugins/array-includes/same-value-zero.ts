// ===========================================================================
// L7  src/plugins/array-includes/same-value-zero.ts
// The equality Array.prototype.includes uses, spelled out.
//
// It is duplicated rather than imported from ../array-unique: a plugin may
// import its OWN directory and nothing else under src/plugins (the isolation
// gate in scripts/check-plugin-isolation.ts enforces it), because a shared
// module between two plugins would put both into one tree-shaking unit.
// Six lines is the price of two independently droppable plugins.
// ===========================================================================

/** NaN equals NaN; +0 equals -0. `a !== a` is the NaN test that needs no cast. */
export function isSameValueZero(left: unknown, right: unknown): boolean {
  return left === right || (left !== left && right !== right);
}
