import { ValidationOptions, ValidationResult } from ".";

export interface Validator<TObject, TValue> {
  validate(
    value: TValue,
    options?: ValidationOptions
  ): ValidationResult<TValue>;
}

export interface FieldValidator<
  TObject,
  TValue,
  TRequiredKeys extends keyof TObject = never,
> {
  validate(
    value: unknown,
    allValues: TRequiredKeys extends never ? TObject | undefined : TObject,
    options?: ValidationOptions
  ): ValidationResult<TValue>;
}

export interface ValidatorStrategy<TObject, TValue> {
  validate(
    value: unknown,
    options?: ValidationOptions
  ): ValidationResult<TValue>;
}
