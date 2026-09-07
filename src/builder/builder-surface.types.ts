// ===========================================================================
// L6  src/builder/builder-surface.types.ts — THE ERASED TWINS.
//
// Every public builder type is written in terms of type parameters the VALUE
// side cannot produce: `B & BagEntry<P>` grows with each use(), `TDeclared | K`
// grows with each v(), and both `.v()` and `.strict()` return a CONDITIONAL
// type. No implementation object can be assignable to those, so the runtime is
// written against the twins below — same member names, same arity, no type
// parameters — and src/builder/create-builder.ts re-types the whole graph once
// through eraseBuilderSurface.
//
// The twins are what makes that single erasure auditable: the implementation is
// still fully type-checked against them, so the only thing the erasure invents
// is the type PARAMETERS, never a member.
// ===========================================================================
import type { AnyChain } from "../chain/field-chain.types";
import type { FieldSlots } from "../chain/field-slots.types";
import type { PluginBag } from "../chain/plugin-bag.types";
import type { AnyPlugin } from "../plugin-kit/plugin-definition";
import type { PlanFieldValidator } from "../runtime/create-field-validator";
import type { GlobalConfig } from "../types/global-config";
import type {
  ValidateOptions,
  ValidationResult,
} from "../types/validation-result.types";
import type { FieldOptions } from "./field-options.types";

/** The erased twin of SubsetValidator<TRoot, TPaths>. */
export interface PlanSubsetValidator {
  readonly paths: readonly string[];
  validate(
    value: unknown,
    options?: ValidateOptions
  ): ValidationResult<unknown>;
}

/** The erased twin of Validator<T>: the same four members. */
export interface PlanBackedValidator {
  validate(
    value: unknown,
    options?: ValidateOptions
  ): ValidationResult<unknown>;
  parse(value: unknown, options?: ValidateOptions): ValidationResult<unknown>;
  pick(key: string): PlanFieldValidator;
  pickAll(paths: readonly string[]): PlanSubsetValidator;
}

/** What `.v()` is handed. Erased on both ends: any root, any field type. */
export type ErasedFieldDefine = (
  slots: FieldSlots<unknown, PluginBag, unknown>
) => AnyChain;

/**
 * The erased twin of FieldBuilder<T, B, TDeclared>. `v` returns a NEW surface —
 * the declaration list is never mutated — and `strict` returns the receiver,
 * because strictness is a type-level obligation with no runtime effect
 * (docs/legacy-spec/documented-promises.md, strict()).
 */
export interface FieldBuilderSurface {
  v(
    path: string,
    define: ErasedFieldDefine,
    options?: FieldOptions<unknown>
  ): FieldBuilderSurface;
  strict(): FieldBuilderSurface;
  build(): PlanBackedValidator;
}

/** The erased twin of Builder<B>. `use` mutates and returns the receiver. */
export interface BuilderSurface {
  use(plugin: AnyPlugin): BuilderSurface;
  withConfig(config: GlobalConfig): BuilderSurface;
  for(): FieldBuilderSurface;
}
