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

/**
 * Tidies a value before anything judges it. See `normalize` below.
 *
 * Both sides are `unknown` on purpose: the input has not been validated yet,
 * and a form puts a string in a numeric field, so `"42"` → `42` is the main
 * use of this layer. Typing it `(value: TValue) => TValue` would be a lie.
 * What comes back out is judged by the rules, not by the type.
 */
export type FieldNormalizer = (value: unknown) => unknown;

export interface FieldOptions<TValue> {
  /**
   * Substituted before ANY rule looks at the value, so validate() and parse()
   * judge the same thing; only parse() writes it back.
   */
  readonly default?: TValue | DefaultFactory<TValue>;
  /** Defaults to true — a declared null is replaced, matching 1.x. */
  readonly applyDefaultToNull?: boolean;
  /**
   * Tidies the value before anything judges it. Runs straight after
   * `default` and before presence is decided.
   *
   * Same promise as `default`: validate() and parse() judge the same value,
   * and only parse() writes it back, so the two can never disagree.
   *
   * **Never called for undefined or null.** Otherwise
   * `(v) => String(v).trim()` would turn a missing field into the string
   * `"undefined"` and let it past `.required()`. Absence is `default`'s
   * business; this one only ever sees a value that is there, which is why a
   * normalizer needs no null check of its own.
   *
   * That ordering is what makes the common case work: `"  "` → trim → `""`
   * → presence reads the empty string as missing → required reports it.
   */
  readonly normalize?: FieldNormalizer;
}
