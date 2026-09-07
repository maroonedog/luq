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
import { getGlobalConfig } from "./global-config-store";

export function compileDeclarations(
  entries: readonly FieldEntry[],
  configOverride: GlobalConfig | undefined
): ValidationPlan {
  const config = resolveGlobalConfig(configOverride, getGlobalConfig());
  const childKeysOf = indexDeclaredChildKeys(
    entries.map((entry) => entry.path)
  );
  const declarations: readonly FieldDeclaration[] = entries.map((entry) => ({
    path: entry.path,
    rules: entry.collectRules({
      fieldPath: entry.path,
      declaredSiblingKeys: childKeysOf(entry.path),
      config,
    }),
    defaultOf: entry.defaultOf ?? undefined,
    applyDefaultToNull: entry.applyDefaultToNull,
  }));
  return compileSchema(declarations, createBranchExecutor());
}
