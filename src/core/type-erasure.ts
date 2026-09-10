// ===========================================================================
// src/core/type-erasure.ts — THE ONLY FILE PERMITTED TO ASSERT A TYPE.
// The code standard names this file by hand; everything else in src/ must reach
// a type by writing it, by a `unknown` + type-guard pair, or by a discriminated
// union. Every function here carries its own reason, so a reviewer can audit
// the whole escape hatch in one file.
// ===========================================================================

/**
 * Why: a record built up key by key has all its keys at run time but stays
 * Record<string, unknown> statically. The generic on the calling side —
 * AsyncContextBuilder.set's `C & { [P in K]: V }` — is what holds the
 * key-to-value correspondence as a type.
 */
export function eraseAssembledRecord<T extends object>(
  assembled: Readonly<Record<string, unknown>>
): T {
  return assembled as unknown as T;
}

/**
 * Why: a chain is a record carrying one method per plugin in the bag. The
 * keys are all there at run time but the value stays Record<string, unknown>
 * statically, while the matching types are mapped types — which keys appear
 * follows from the type arguments alone and cannot be written where the value
 * is assembled.
 *
 * Soundness depends on the assembly following the same rule the mapped type
 * does: attach a method for a plugin exactly when that plugin declares the
 * slot.
 */
export function eraseChainSurface<T extends object>(
  assembled: Readonly<Record<string, unknown>>
): T {
  return assembled as unknown as T;
}

/**
 * Why: a builder chain is one record holding the plugins added by use() and
 * the declarations added by v(), and its shape does not change as the chain
 * advances. Its static type does — each step is expressed with type arguments
 * (the bag intersection, the union of declared paths, the conditional that
 * branches on union guard exhaustiveness) that the assembling code has no way
 * to write. For the same reason the runtime knows only the plan and can only
 * answer ValidationResult<unknown>; this boundary is the one place the
 * declared T can be put back.
 *
 * Soundness depends on the erased surface declaring the same member set as
 * the public type, with the implementation structurally conforming to it.
 * Exactly one call site is allowed.
 */
export function eraseBuilderSurface<T extends object>(assembled: object): T {
  return assembled as unknown as T;
}

/**
 * Why: building a validator from a JSON Schema read at run time gives the
 * compiler nothing to check the declared T against — the document is a value,
 * not a type. The plan-backed validator can only answer
 * ValidationResult<unknown>, so this boundary is the one place the caller's
 * explicit T can be put back. Same kind of erasure as the builder surface,
 * hence the same home.
 *
 * Soundness depends on the plan-backed validator declaring the same member
 * set as Validator<T>, with the implementation structurally conforming to it.
 * When T disagrees with the actual document the type lies, but the runtime
 * result is still correct. Exactly one call site is allowed.
 */
export function eraseSchemaValidator<T>(planBacked: object): T {
  return planBacked as unknown as T;
}
