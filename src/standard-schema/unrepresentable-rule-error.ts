// ===========================================================================
// L10 src/standard-schema/unrepresentable-rule-error.ts
//
// Meeting a declaration that cannot be written as JSON Schema throws, by
// default.
//
// Dropping it silently is not on offer. What comes out of here gets USED FOR
// VALIDATION by whoever receives it, so dropping a `.custom()` produces a
// schema that admits values it must not — with no trace of the omission. The
// missing constraint is discovered by the incident it causes.
//
// Anyone for whom dropping is fine — emitting for documentation or for a form
// layout rather than for validation — can ask for it explicitly through
// libraryOptions, which the spec provides for exactly this kind of agreement.
// The point is that the lax choice is never the default, and that having made
// it stays visible in the caller's code.
// ===========================================================================

export class UnrepresentableRuleError extends Error {
  constructor(
    readonly fieldPath: string,
    readonly pluginName: string,
    readonly reason: string
  ) {
    super(
      `"${fieldPath}" declares ${pluginName}, which Luq cannot express in ` +
        `JSON Schema: ${reason}. Pass ` +
        `libraryOptions: { unrepresentable: "omit" } to drop it instead — ` +
        `the emitted schema then accepts values this validator rejects.`
    );
    this.name = "UnrepresentableRuleError";
  }
}

/** What to do with an unwritable declaration. Defaults to "throw". */
export type UnrepresentablePolicy = "throw" | "omit";

/**
 * Reads the policy out of `libraryOptions`.
 *
 * An unrecognised value falls to throw. A misspelled `omit` landing on the
 * strict side is correct; landing on the lax side is an incident.
 */
export function readUnrepresentablePolicy(
  libraryOptions: Record<string, unknown> | undefined
): UnrepresentablePolicy {
  return libraryOptions?.["unrepresentable"] === "omit" ? "omit" : "throw";
}
