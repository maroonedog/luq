// ===========================================================================
// L6  src/builder/compile-declarations.ts — WHAT build() ACTUALLY DOES.
//
// Four things, once, in this order:
//   1. resolve the effective GlobalConfig — ONCE. The process-wide store is
//      read here and nowhere else, so a later setGlobalConfig() cannot change
//      how an already-built validator behaves, and no rule reads a global at
//      validation time (user decision 1).
//   2. index the declared child keys from the declared PATH STRINGS, so
//      RuleBuildContext.declaredSiblingKeys is known before any callback runs.
//   3. run every `.v()` callback EXACTLY ONCE, through the L3 collector.
//   4. compile the declarations into one plan, wired to the one BranchExecutor.
//
// L6 is the only layer that may know both L4 and L5, which is why the port is
// wired here: compileSchema takes the executor as a required argument and
// compile/ therefore never grows a traversal of its own.
// ===========================================================================
import { compileSchema } from "../compile/compile-schema";
import { indexDeclaredChildKeys } from "../compile/declared-child-keys";
import type {
  FieldDeclaration,
  ValidationPlan,
} from "../compile/validation-plan.types";
import { createBranchExecutor } from "../runtime/run-branch";
import { resolveGlobalConfig } from "../types/global-config";
import type { GlobalConfig } from "../types/global-config";
import type { FieldEntry } from "./field-entry.types";
import type { FieldDeclaredCalls } from "./field-declared-calls.types";
import { getGlobalConfig } from "./global-config-store";

/** build() が一度で作るもの: 実行する計画と、書き出すための宣言。 */
export interface CompiledDeclarations {
  readonly plan: ValidationPlan;
  readonly declaredCalls: readonly FieldDeclaredCalls[];
}

export function compileDeclarations(
  entries: readonly FieldEntry[],
  configOverride: GlobalConfig | undefined
): CompiledDeclarations {
  const config = resolveGlobalConfig(configOverride, getGlobalConfig());
  const childKeysOf = indexDeclaredChildKeys(
    entries.map((entry) => entry.path)
  );
  const declarations: FieldDeclaration[] = [];
  const declaredCalls: FieldDeclaredCalls[] = [];
  for (const entry of entries) {
    const outcome = entry.collectRules({
      fieldPath: entry.path,
      declaredSiblingKeys: childKeysOf(entry.path),
      config,
    });
    declarations.push({
      path: entry.path,
      rules: outcome.rules,
      defaultOf: entry.defaultOf ?? undefined,
      applyDefaultToNull: entry.applyDefaultToNull,
      normalize: entry.normalize ?? undefined,
    });
    declaredCalls.push({ path: entry.path, calls: outcome.calls });
  }
  return {
    plan: compileSchema(declarations, createBranchExecutor()),
    declaredCalls,
  };
}
