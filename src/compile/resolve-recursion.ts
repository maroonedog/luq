// ===========================================================================
// L4  src/compile/resolve-recursion.ts
// A RecursiveRule plus a PlanRef becomes a RecursionPolicy.
//
// The PlanRef is late-bound on purpose: compileSchema creates the holder
// before compiling its fields and fills it afterwards, so a self-referential
// schema needs no forward declaration and no cast. Nothing here resolves it —
// resolving at build time would recurse forever.
// ===========================================================================
import type { RecursiveRule } from "../plugin-kit/compiled-rule";
import type { PlanRef, RecursionPolicy } from "./validation-plan.types";

/** Two recursive rules on one field cannot both describe the re-entry. */
export class ConflictingRecursionError extends Error {
  constructor(
    readonly fieldPath: string,
    readonly codes: readonly string[]
  ) {
    super(
      `The field "${fieldPath}" declares ${codes.length} recursive rules ` +
        `(${codes.join(", ")}); a field re-enters a plan at most once.`
    );
    this.name = "ConflictingRecursionError";
  }
}

/** null for every field that declared no RecursiveRule, i.e. almost all. */
export function resolveRecursion(
  rules: readonly RecursiveRule[],
  plan: PlanRef,
  fieldPath: string
): RecursionPolicy | null {
  const only = rules[0];
  if (only === undefined) return null;
  if (rules.length > 1) {
    throw new ConflictingRecursionError(
      fieldPath,
      rules.map((rule) => rule.code)
    );
  }
  const policy: RecursionPolicy = {
    code: only.code,
    severity: only.severity,
    target: only.target,
    maxDepth: only.maxDepth,
    plan,
    describe: (detail, ctx) => only.describe(detail, ctx),
  };
  return Object.freeze(policy);
}
