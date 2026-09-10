// ===========================================================================
// L6  src/builder/create-field-builder.ts — the IMMUTABLE declaration list.
//
// `.v()` does not run the callback and does not touch the receiver: it returns
// a NEW surface carrying one more entry. Two chains branched from the same
// field builder therefore cannot contaminate each other, and — the reason that
// matters more — the user's callback has not run yet, so nothing has been
// decided before build() knows the config and the declared sibling keys.
//
// `.strict()` returns the receiver. Strictness is a type-level obligation with
// no runtime effect (docs/legacy-spec/documented-promises.md): rejecting an
// undeclared property at run time is objectAdditionalProperties' job.
// ===========================================================================
import { collectFieldRules } from "../chain/collect-field-rules";
import type { ChainBuildContext } from "../chain/create-chain-node";
import type { PluginBag } from "../chain/plugin-bag.types";
import type { GlobalConfig } from "../types/global-config";
import type {
  ErasedFieldDefine,
  FieldBuilderSurface,
  PlanBackedValidator,
} from "./builder-surface.types";
import { compileDeclarations } from "./compile-declarations";
import { createPlanBackedValidator } from "./create-plan-validator";
import { rememberDeclaredCalls } from "./declared-calls-store";
import type { FieldEntry } from "./field-entry.types";
import type { FieldOptions } from "./field-options.types";
import { resolveFieldDefault } from "./resolve-field-default";

/** No declaration yet: shared and frozen, so `.for<T>()` allocates nothing. */
const NO_ENTRIES: readonly FieldEntry[] = Object.freeze([]);

/**
 * 計画を作り、同じ一度で控えた宣言をバリデータに結び付ける。
 * 結び付け先は WeakMap なので、Validator のメンバーは増えない。
 */
function buildValidator(
  entries: readonly FieldEntry[],
  configOverride: GlobalConfig | undefined
): PlanBackedValidator {
  const compiled = compileDeclarations(entries, configOverride);
  const validator = createPlanBackedValidator(compiled.plan);
  rememberDeclaredCalls(validator, compiled.declaredCalls);
  return validator;
}

export function createFieldBuilderSurface(
  bag: PluginBag,
  configOverride: GlobalConfig | undefined,
  entries: readonly FieldEntry[] = NO_ENTRIES
): FieldBuilderSurface {
  const surface: FieldBuilderSurface = {
    v: (path, define, options) =>
      createFieldBuilderSurface(bag, configOverride, [
        ...entries,
        toFieldEntry(bag, path, define, options),
      ]),
    strict: () => surface,
    build: () => buildValidator(entries, configOverride),
  };
  return Object.freeze(surface);
}

/**
 * The bag is captured HERE, at `.v()`, and the callback is not. That is the
 * whole of "the callback runs only at build()": collectRules is the only way
 * back to it, compileDeclarations is its only caller, and it calls it once.
 */
function toFieldEntry(
  bag: PluginBag,
  path: string,
  define: ErasedFieldDefine,
  options: FieldOptions<unknown> | undefined
): FieldEntry {
  const policy = resolveFieldDefault(options);
  return {
    path,
    defaultOf: policy.defaultOf,
    applyDefaultToNull: policy.applyDefaultToNull,
    normalize: options?.normalize ?? null,
    collectRules: (context: ChainBuildContext) =>
      collectFieldRules<unknown, PluginBag, unknown>(bag, context, define),
  };
}
