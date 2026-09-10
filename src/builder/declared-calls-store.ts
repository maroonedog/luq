// ===========================================================================
// L6  src/builder/declared-calls-store.ts
//
// What build() recorded, held outside the validator.
//
// Not a member on the validator, for two reasons. One is the public interface:
// every member added there is a member everyone who copies or reimplements the
// interface has to add too. The other is cost — a member nobody reads is still
// a member everybody carries.
// ===========================================================================
import type { FieldDeclaredCalls } from "./field-declared-calls.types";

const declaredCallsByValidator = new WeakMap<
  object,
  readonly FieldDeclaredCalls[]
>();

/** Called only by build(), attaching to an already frozen validator. */
export function rememberDeclaredCalls(
  validator: object,
  calls: readonly FieldDeclaredCalls[]
): void {
  declaredCallsByValidator.set(validator, calls);
}

/**
 * undefined means this validator did not come from build(). Keeping it
 * distinct from the empty list is the point: it lets a writer tell "no
 * constraints were declared" from "what was declared is not known".
 */
export function readDeclaredCalls(
  validator: unknown
): readonly FieldDeclaredCalls[] | undefined {
  if (typeof validator !== "object" || validator === null) return undefined;
  return declaredCallsByValidator.get(validator);
}
