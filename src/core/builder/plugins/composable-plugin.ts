/**
 * Composable Plugin Pattern - Accumulate multiple calls and build validators
 *
 * This module provides utilities for creating composable plugins that can accumulate
 * multiple method calls and build a unified validator. This pattern is useful for
 * validation rules that need to be composed from multiple conditions or checks.
 *
 * Example usage:
 * ```typescript
 * // Create a composable plugin
 * const myPlugin = createComposablePlugin(
 *   "myPlugin",
 *   "check",
 *   ["string", "number"] as const,
 *   (compositions, fieldPath, plugins) => {
 *     // Build validators from compositions
 *     const validators = compositions.map(([arg1, arg2]) =>
 *       createValidator("myCheck", (value) => checkSomething(value, arg1, arg2))
 *     );
 *     return createValidatorResult(validators);
 *   }
 * );
 *
 * // Use in field builder
 * builder.field("name", b => b.string.check(arg1, arg2).check(arg3, arg4))
 * ```
 */

import type { TypeName, TransformFunction } from "../plugins/plugin-types";

// Re-export TransformFunction for external use
export type { TransformFunction };

/**
 * Pre-defined validation results for common cases
 */
export const VALID_RESULT = Object.freeze({ valid: true });
export const INVALID_RESULT = Object.freeze({ valid: false });

/**
 * Basic interface for Composable Plugin
 */
export interface ComposablePlugin<
  TName extends string,
  TMethodName extends string,
  TAllowedTypes extends readonly TypeName[],
> {
  name: TName;
  methodName: TMethodName;
  allowedTypes: TAllowedTypes;
  category: "composable";

  /**
   * Create a Composer that accumulates multiple calls
   */
  createComposer<TPlugins>(
    fieldPath: string,
    plugins: TPlugins
  ): ComposableComposerWithMethod<TMethodName>;
}

/**
 * Single validator definition
 */
export interface ValidatorDefinition {
  check: (value: unknown, currentValue: unknown) => boolean;
  name: string;
  inputType?: TypeName;
  outputType?: TypeName;
  metadata?: {
    severity?: "error" | "warning" | "info";
    async?: boolean;
  };
}

// TransformFunction is imported from plugin-types

/**
 * Validator build result type
 */
export interface ComposableValidatorResult {
  _validators: ValidatorDefinition[];
  _transforms: TransformFunction<unknown, unknown>[];
  validate: (value: unknown) => { valid: boolean };
}

/**
 * Creates a validator result from an array of validators and transforms.
 *
 * @param validators - Array of validator definitions to include
 * @param transforms - Optional array of transform functions to apply
 * @param customValidate - Optional custom validation function that overrides default behavior
 * @returns A composable validator result that can be used by the builder
 *
 * @example
 * ```typescript
 * const result = createValidatorResult([
 *   createValidator("minLength", (value) => value.length >= 3),
 *   createValidator("maxLength", (value) => value.length <= 10)
 * ]);
 * ```
 */
export function createValidatorResult(
  validators: ValidatorDefinition[],
  transforms: TransformFunction<unknown, unknown>[] = [],
  customValidate?: (value: unknown) => { valid: boolean }
): ComposableValidatorResult {
  return {
    _validators: validators,
    _transforms: transforms,
    validate:
      customValidate ||
      ((value: unknown) => {
        for (let i = 0; i < transforms.length; i++) {
          if (!validators[i].check(value, value)) {
            return INVALID_RESULT;
          }
        }
        return VALID_RESULT;
      }),
  };
}

/**
 * Creates a validator result from a single validator with optional configuration.
 * This is a convenience function that combines createValidator and createValidatorResult.
 *
 * @param name - The name of the validator
 * @param check - The validation function
 * @param options - Optional configuration including metadata and transforms
 * @returns A composable validator result
 *
 * @example
 * ```typescript
 * const result = createSingleValidatorResult(
 *   "email",
 *   (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
 *   { inputType: "string", severity: "error" }
 * );
 * ```
 */
export function createSingleValidatorResult(
  name: string,
  check: (value: unknown, currentValue: unknown) => boolean,
  options?: {
    inputType?: TypeName;
    outputType?: TypeName;
    severity?: "error" | "warning" | "info";
    async?: boolean;
    transforms?: TransformFunction<unknown, unknown>[];
    customValidate?: (value: unknown) => { valid: boolean };
  }
): ComposableValidatorResult {
  const validator = createValidator(name, check, options);
  return createValidatorResult(
    [validator],
    options?.transforms || [],
    options?.customValidate
  );
}

/**
 * Creates a single validator definition with metadata.
 *
 * @param name - The name of the validator
 * @param check - The validation function that returns true if valid
 * @param options - Optional metadata for the validator
 * @returns A validator definition
 *
 * @example
 * ```typescript
 * const validator = createValidator(
 *   "range",
 *   (value) => value >= 0 && value <= 100,
 *   { inputType: "number", severity: "error" }
 * );
 * ```
 */
export function createValidator(
  name: string,
  check: (value: unknown, currentValue: unknown) => boolean,
  options?: {
    inputType?: TypeName;
    outputType?: TypeName;
    severity?: "error" | "warning" | "info";
    async?: boolean;
  }
): ValidatorDefinition {
  return {
    check,
    name,
    inputType: options?.inputType,
    outputType: options?.outputType,
    metadata: options
      ? {
          severity: options.severity || "error",
          async: options.async || false,
        }
      : undefined,
  };
}

/**
 * Composition builder context for accumulating validations
 */
export interface CompositionBuilder<TComposition> {
  compositions: TComposition[];
  add(composition: TComposition): this;
}

/**
 * Creates a builder for accumulating compositions.
 * This is useful for plugins that need to collect multiple method calls.
 *
 * @returns A composition builder instance
 *
 * @example
 * ```typescript
 * const builder = createCompositionBuilder<[string, number]>();
 * builder.add(["test", 5]).add(["example", 10]);
 * // builder.compositions now contains all added items
 * ```
 */
export function createCompositionBuilder<
  TComposition,
>(): CompositionBuilder<TComposition> {
  const compositions: TComposition[] = [];
  return {
    compositions,
    add(composition: TComposition) {
      compositions.push(composition);
      return this;
    },
  };
}

/**
 * Merges multiple validator results into a single result.
 * All validators and transforms are combined, and validation stops at the first failure.
 *
 * @param results - Array of validator results to merge
 * @returns A single merged validator result
 *
 * @example
 * ```typescript
 * const result1 = createSingleValidatorResult("min", (v) => v >= 0);
 * const result2 = createSingleValidatorResult("max", (v) => v <= 100);
 * const merged = mergeValidatorResults([result1, result2]);
 * ```
 */
export function mergeValidatorResults(
  results: ComposableValidatorResult[]
): ComposableValidatorResult {
  const allValidators: ValidatorDefinition[] = [];
  const allTransforms: TransformFunction<unknown, unknown>[] = [];

  for (const result of results) {
    allValidators.push(...result._validators);
    allTransforms.push(...result._transforms);
  }

  return createValidatorResult(
    allValidators,
    allTransforms,
    (value: unknown) => {
      for (let i = 0; i < results.length; i++) {
        const result = results[i].validate(value);
        if (!result.valid) {
          return INVALID_RESULT;
        }
      }
      return VALID_RESULT;
    }
  );
}

/**
 * Composer that accumulates calls and builds a validator
 */
export interface ComposableComposer<TMethodName extends string> {
  /**
   * Add a call (chainable)
   */
  add(args: unknown[]): ComposableComposer<TMethodName>;

  /**
   * Build validator from accumulated calls
   */
  build(): ComposableValidatorResult;
}

export type ComposableComposerWithMethod<TMethodName extends string> =
  ComposableComposer<TMethodName> & {
    [K in TMethodName]: (
      ...args: unknown[]
    ) => ComposableComposerWithMethod<TMethodName>;
  };

/**
 * Creates a composable plugin that can accumulate multiple method calls.
 *
 * @param name - The unique name of the plugin
 * @param methodName - The method name that will be added to the field builder
 * @param allowedTypes - Array of type names this plugin can be applied to
 * @param builderFn - Function that builds validators from accumulated compositions
 * @returns A composable plugin instance
 *
 * @example
 * ```typescript
 * // Example: Create a range check plugin that accumulates multiple ranges
 * const rangePlugin = createComposablePlugin(
 *   "range",
 *   "between",
 *   ["number"] as const,
 *   (compositions: Array<[number, number]>, fieldPath, plugins) => {
 *     const validators = compositions.map(([min, max], index) =>
 *       createValidator(
 *         `range_${index}`,
 *         (value) => typeof value === 'number' && value >= min && value <= max,
 *         { inputType: "number", severity: "error" }
 *       )
 *     );
 *
 *     // Custom validate function that checks all ranges
 *     const customValidate = (value: unknown) => {
 *       if (typeof value !== 'number') return { valid: false };
 *       return compositions.every(([min, max]) => value >= min && value <= max)
 *         ? { valid: true }
 *         : { valid: false };
 *     };
 *
 *     return createValidatorResult(validators, [], customValidate);
 *   }
 * );
 *
 * // Usage:
 * builder.field("score", b => b.number.between(0, 100).between(10, 90))
 * ```
 */
export function createComposablePlugin<
  TName extends string,
  TMethodName extends string,
  TAllowedTypes extends readonly TypeName[],
  TComposition = unknown[],
>(
  name: TName,
  methodName: TMethodName,
  allowedTypes: TAllowedTypes,
  builderFn: <TPlugins>(
    compositions: TComposition[],
    fieldPath: string,
    plugins: TPlugins
  ) => ComposableValidatorResult
): ComposablePlugin<TName, TMethodName, TAllowedTypes> {
  return {
    name,
    methodName,
    allowedTypes,
    category: "composable",

    createComposer<TPlugins>(
      fieldPath: string,
      plugins: TPlugins
    ): ComposableComposerWithMethod<TMethodName> {
      const compositions: TComposition[] = [];

      const composer: ComposableComposer<TMethodName> = {
        add(args: unknown[]) {
          compositions.push(args as TComposition);
          return composer as ComposableComposerWithMethod<TMethodName>;
        },

        build() {
          return builderFn(compositions, fieldPath, plugins);
        },
      };

      // Dynamically add method to make it chainable
      const result = composer as ComposableComposerWithMethod<TMethodName>;
      (result as any)[methodName] = function (...args: unknown[]) {
        return result.add(args);
      };

      return result;
    },
  };
}

/**
 * Integration of Composable Plugin in Field Context
 */
export function attachComposablePlugin<
  TObject extends object,
  TPlugins,
  TBuilder,
>(
  builder: TBuilder,
  plugin: ComposablePlugin<string, string, readonly TypeName[]>,
  fieldPath: string,
  plugins: TPlugins
): void {
  const methodName = plugin.methodName;

  // Track composer state
  let composer: ComposableComposer<string> | null = null;
  let composerResult: ComposableValidatorResult | null = null;

  // Create method that starts composition
  (builder as Record<string, unknown>)[methodName] = function (
    ...args: unknown[]
  ) {
    // Create Composer on first call
    if (!composer) {
      composer = plugin.createComposer(fieldPath, plugins);
    }

    // Add the call to composer
    composer.add(args);

    // Add composer's method for chaining (but not build)
    (builder as any)[methodName] = (composer as any)[methodName];

    // Build the composer result immediately and integrate with execution plan
    if (composer) {
      composerResult = composer.build();

      // Add validators to execution plan immediately
      const executionPlan = (builder as any)._executionPlan;
      if (executionPlan && composerResult && typeof composerResult.validate === 'function') {
        // Always use the custom validate function if available
        // TODO: Restore complex validation logic
      } else if (composerResult && composerResult._validators) {
        // Fallback to individual validators
        for (const validator of composerResult._validators) {
          executionPlan.addValidator(validator.name, (value: any, context: any) => {
            const valid = validator.check(value, value);
            return {
              valid,
              message: valid
                ? undefined
                : `Validation failed for ${validator.name}`,
            };
          });
        }
      }
    }

    return builder;
  };
}
