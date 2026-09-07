// ===========================================================================
// L6  src/builder/resolve-field-default.ts
// `.v()`'s third argument becomes the two members CompiledField reads. Doing it
// HERE, at declaration time, is what keeps run-field's applyDefault free of a
// "is this a factory or a literal" test on the hot path: the eager form is
// wrapped into a factory once, at build().
// ===========================================================================
import { APPLIES_DEFAULT_TO_NULL_BY_DEFAULT } from "../compile/compile-field";
import type { DefaultFactory, FieldOptions } from "./field-options.types";

export interface FieldDefaultPolicy {
  readonly defaultOf: ((root: unknown) => unknown) | null;
  readonly applyDefaultToNull: boolean;
}

const NO_DEFAULT: FieldDefaultPolicy = Object.freeze({
  defaultOf: null,
  applyDefaultToNull: APPLIES_DEFAULT_TO_NULL_BY_DEFAULT,
});

/**
 * A declaration that names no default at all shares one frozen policy, so the
 * overwhelmingly common field allocates nothing.
 *
 * `default: undefined` is read as "no default": undefined is precisely the
 * value a default exists to replace, so storing it would build a writer that
 * writes back what it read.
 */
export function resolveFieldDefault<TValue>(
  options: FieldOptions<TValue> | undefined
): FieldDefaultPolicy {
  const applyDefaultToNull =
    options?.applyDefaultToNull ?? APPLIES_DEFAULT_TO_NULL_BY_DEFAULT;
  const declared = options?.default;
  if (declared === undefined) {
    return applyDefaultToNull === APPLIES_DEFAULT_TO_NULL_BY_DEFAULT
      ? NO_DEFAULT
      : Object.freeze({ defaultOf: null, applyDefaultToNull });
  }
  return Object.freeze({
    defaultOf: toDefaultFactory(declared),
    applyDefaultToNull,
  });
}

/**
 * A type GUARD rather than an assertion: this file is not permitted to assert
 * and does not need to. `typeof === "function"` is the same test the legacy
 * applyDefault made, kept because the documented option really is
 * `T | (() => T)`.
 */
function isDefaultFactory<TValue>(
  declared: TValue | DefaultFactory<TValue>
): declared is DefaultFactory<TValue> {
  return typeof declared === "function";
}

function toDefaultFactory<TValue>(
  declared: TValue | DefaultFactory<TValue>
): (root: unknown) => unknown {
  if (isDefaultFactory(declared)) return (root) => declared(root);
  return () => declared;
}
