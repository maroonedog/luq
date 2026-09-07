// ===========================================================================
// src/field-rule/field-rule.types.ts — ONE FIELD, LIFTED OUT OF EVERY OBJECT.
//
// A FieldRule is a `.v()` callback that has been given a name and a plugin bag
// and nothing else. It is deliberately NOT a validator of its own: everything
// it can do, it does by handing that callback back to the L6 builder, which is
// why `define` is a plain typed member here and not the legacy
// `_getInternalValidators(): { validators: any[]; transforms: any[];
// executionPlan: any }` escape hatch (docs/legacy-spec/anti-patterns.md:149).
//
// TRoot is `unknown` in FieldRuleDefine ON PURPOSE. `FieldPath<unknown>` is
// `never`, so a rule that does not know which object it will be attached to
// cannot name a sibling field — a compareField inside a reusable rule would
// otherwise compile against one root and be spliced into another.
// ===========================================================================
import type { FieldOptions } from "../builder/field-options.types";
import type { AnyChain } from "../chain/field-chain.types";
import type { FieldSlots } from "../chain/field-slots.types";
import type { PluginBag } from "../chain/plugin-bag.types";
import type {
  ValidateOptions,
  ValidationResult,
} from "../types/validation-result.types";

/** The one-key object a standalone rule is validated through. */
export interface FieldRuleSubject<TValue> {
  readonly value: TValue;
}

/** The user's chain callback, stored unrun. */
export type FieldRuleDefine<TValue, B extends PluginBag> = (
  b: FieldSlots<unknown, B, TValue>
) => AnyChain;

/**
 * Legacy shape (docs/legacy-spec/documented-promises.md:238):
 *   createFieldRule(fn, { name, description?, fieldOptions? })
 */
export interface FieldRuleOptions<TValue> {
  readonly name?: string;
  readonly description?: string;
  /** Carried to `.v()`'s third argument, at useField() as well as standalone. */
  readonly fieldOptions?: FieldOptions<TValue>;
}

/**
 * `validate` is generic over the INPUT rather than returning
 * `ValidationResult<TValue>`, because validate() hands back the very value it
 * was given: typing the result as the argument is the honest description and it
 * needs no assertion. `parse` may hand back a different object, so it is typed
 * by the rule's value type, exactly as Validator<T>.parse is.
 */
export interface FieldRule<TValue, B extends PluginBag = PluginBag> {
  readonly name: string;
  readonly description: string | undefined;
  readonly define: FieldRuleDefine<TValue, B>;
  readonly fieldOptions: FieldOptions<TValue> | undefined;
  validate<TInput extends TValue | null | undefined>(
    value: TInput,
    options?: ValidateOptions
  ): ValidationResult<TInput>;
  parse(
    value: TValue | null | undefined,
    options?: ValidateOptions
  ): ValidationResult<TValue>;
}

/** The legacy `ExtractFieldRuleType`, under a name that says what it reads. */
export type ExtractFieldRuleValue<R> =
  R extends FieldRule<infer TValue, PluginBag> ? TValue : never;
