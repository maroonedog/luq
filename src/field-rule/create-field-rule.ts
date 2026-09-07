// ===========================================================================
// src/field-rule/create-field-rule.ts — a rule that can run ON ITS OWN, on the
// ONE engine.
//
// The legacy FieldRule.validate/parse were a THIRD execution semantics: they
// called `validator.check()` directly, ignored getErrorMessage, ignored
// skipForNull/skipForUndefined, used the plugin NAME as the error code instead
// of its code, and re-executed the user's definition on every single call
// (docs/legacy-spec/plugin-contract.md:173).
//
// None of that is here. A standalone rule is exactly
//     Builder().use(...).for<{ value: TValue }>().v("value", define).build()
// built ONCE, at createFieldRule() time, through the public entry point. So the
// rule runs the same compiler, the same plan and the same runtime as every
// other field, and there is no second answer to "what does this rule mean".
// ===========================================================================
import type { Builder } from "../builder/field-builder.types";
import type { FieldOptions } from "../builder/field-options.types";
import type { Validator } from "../builder/validator.types";
import type { PluginBag } from "../chain/plugin-bag.types";
import type {
  FieldRule,
  FieldRuleDefine,
  FieldRuleOptions,
  FieldRuleSubject,
} from "./field-rule.types";

/**
 * The single declared path of the standalone subject, and the default rule
 * name. A rule is not attached to a place yet, so every issue it reports on its
 * own comes back under this path; spliced into an object by useField() the very
 * same rules report under the path that useField was given.
 */
export const FIELD_RULE_SUBJECT_KEY = "value";

/**
 * `.v()` is reached with C inferred as AnyChain, so its union-guard conditional
 * resolves and `.build()` is present. That is what lets this whole file hold no
 * type assertion: the typed Validator comes from the builder's own single
 * erasure, not from a second one here.
 */
function buildSubjectValidator<TValue, B extends PluginBag>(
  builder: Builder<B>,
  define: FieldRuleDefine<TValue, B>,
  fieldOptions: FieldOptions<TValue> | undefined
): Validator<FieldRuleSubject<TValue>> {
  return builder
    .for<FieldRuleSubject<TValue>>()
    .v(FIELD_RULE_SUBJECT_KEY, define, fieldOptions)
    .build();
}

export function createFieldRule<TValue, B extends PluginBag>(
  builder: Builder<B>,
  define: FieldRuleDefine<TValue, B>,
  options?: FieldRuleOptions<TValue>
): FieldRule<TValue, B> {
  const fieldOptions = options?.fieldOptions;
  const validator = buildSubjectValidator(builder, define, fieldOptions);
  const rule: FieldRule<TValue, B> = {
    name: options?.name ?? FIELD_RULE_SUBJECT_KEY,
    description: options?.description,
    define,
    fieldOptions,
    validate(value, validateOptions) {
      const outcome = validator.validate({ value }, validateOptions);
      if (!outcome.valid) return { valid: false, issues: outcome.issues };
      return { valid: true, data: value, issues: outcome.issues };
    },
    parse(value, validateOptions) {
      const outcome = validator.parse({ value }, validateOptions);
      if (!outcome.valid) return { valid: false, issues: outcome.issues };
      return {
        valid: true,
        data: outcome.data.value,
        issues: outcome.issues,
      };
    },
  };
  return Object.freeze(rule);
}
