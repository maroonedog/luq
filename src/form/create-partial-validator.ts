import type { Validator } from "../builder/validator.types";
import { readValidatorPlan } from "../builder/validator-plan-store";
import { createValidator } from "../runtime/create-validator";
import type { ValidateOptions } from "../types/validation-result.types";
import type {
  FormFieldPath,
  PartialValidator,
} from "./partial-validator.types";
import { selectValidationPlan } from "./select-validation-plan";

/** Preselect declarations for repeated change/blur validation against full form values. */
export function createPartialValidator<
  T extends object,
  TParsed,
  const P extends FormFieldPath<T>,
>(validator: Validator<T, TParsed>, paths: readonly P[]): PartialValidator<P> {
  const stored = readValidatorPlan(validator);
  if (stored === undefined)
    throw new TypeError("Partial validation requires a Luq-built validator.");
  const selected = createValidator(
    selectValidationPlan(stored.plan, paths),
    stored.config
  );
  return Object.freeze({
    paths: Object.freeze(paths.slice()),
    validate(value: unknown, options?: ValidateOptions) {
      const outcome = selected.validate(value, {
        abortEarly: false,
        abortEarlyOnEachField: false,
        ...options,
      });
      return { valid: outcome.valid, issues: outcome.issues };
    },
  });
}
