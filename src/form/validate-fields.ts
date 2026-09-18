import type { Validator } from "../builder/validator.types";
import type { ValidateOptions } from "../types/validation-result.types";
import { createPartialValidator } from "./create-partial-validator";
import type {
  FormFieldPath,
  PartialValidationResult,
} from "./partial-validator.types";

export function validateFields<T extends object, TParsed>(
  validator: Validator<T, TParsed>,
  value: unknown,
  paths: readonly FormFieldPath<T>[],
  options?: ValidateOptions
): PartialValidationResult {
  return createPartialValidator(validator, paths).validate(value, options);
}
