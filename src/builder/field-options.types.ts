// ===========================================================================
// L6  src/builder/field-options.types.ts
// The third argument of `.v()`. It is a FIELD CONFIGURATION, never a Rule:
// compile/validation-plan.types.ts says so, and that is why `defaultOf` and
// `applyDefaultToNull` sit on FieldDeclaration rather than in its rule list.
//
// Legacy shape (should-preserve, docs/legacy-spec/documented-promises.md:211):
//     { default?: T | (() => T); applyDefaultToNull?: boolean }
// The factory form is widened to `(root: unknown) => T` so a default can read
// the object it is filling in; a legacy zero-argument factory still fits.
// ===========================================================================

/** The lazy form of a default. A zero-argument function is assignable to it. */
export type DefaultFactory<TValue> = (root: unknown) => TValue;

export interface FieldOptions<TValue> {
  /**
   * Substituted before ANY rule looks at the value, so validate() and parse()
   * judge the same thing; only parse() writes it back.
   */
  readonly default?: TValue | DefaultFactory<TValue>;
  /** Defaults to true — a declared null is replaced, matching 1.x. */
  readonly applyDefaultToNull?: boolean;
}
