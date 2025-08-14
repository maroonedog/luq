/**
 * @luq-plugin
 * @name tupleBuilder
 * @category composable-directly
 * @description Validates tuple types (fixed-length arrays with different types for each element)
 * @allowedTypes ["tuple"]
 * @example
 * ```typescript
 * // Fixed-length tuple - no options needed
 * type Coordinates = [number, number];
 *
 * const validator = Builder()
 *   .use(tupleBuilderPlugin)
 *   .for<{ location: Coordinates }>()
 *   .v("location", (b) => b.tuple
 *     .required()
 *     .builder(
 *       (a) => a.number.required().min(0),
 *       (b) => b.number.required().min(0)
 *     )
 *   )
 *   .build();
 *
 * // Variable-length tuple with rest elements
 * type UserData = [string, number, boolean, ...string[]];
 *
 * const userValidator = Builder()
 *   .use(tupleBuilderPlugin)
 *   .for<{ data: UserData }>()
 *   .v("data", (b) => b.tuple
 *     .required()
 *     .builder(
 *       (a) => a.string.required().min(3),     // name
 *       (b) => b.number.required().min(0),     // age
 *       (c) => c.boolean.required(),           // isActive
 *       { rest: (r) => r.string.optional() }   // rest elements
 *     )
 *   )
 *   .build();
 * ```
 * @params
 * - ...builderFns: Array<(context: FieldBuilderContext) => any> - Builder functions for each tuple element
 * - options?: { rest?: (context: FieldBuilderContext) => any } - Optional configuration (automatically defaults to {} when omitted)
 * @returns Composable validation function
 * @customError
 * - Returns false if value is not an array
 * - Returns false if array length doesn't match tuple definition (without rest)
 * - Returns false if any element validation fails
 * @since 0.1.0-alpha
 */

import { createComposableDirectlyPlugin } from "../builder/plugins/composable-directly-plugin";
import {
  createValidatorResult,
  createValidator,
  VALID_RESULT,
  INVALID_RESULT,
  type ComposableValidatorResult,
} from "../builder/plugins/composable-plugin";
import { createFieldContext } from "../builder/context/field-context";
import type { FieldBuilderContext } from "../builder/plugins/plugin-types";

export interface TupleBuilderFunction<TObject extends object, TPlugins> {
  (context: FieldBuilderContext<TObject, TPlugins, any>): any;
}

export interface RestBuilderFunction<TObject extends object, TPlugins> {
  (context: FieldBuilderContext<TObject, TPlugins, any>): any;
}

// Options for tuple builder including optional rest
export interface TupleBuilderOptions<TObject extends object, TPlugins> {
  rest?: RestBuilderFunction<TObject, TPlugins>;
  messageFactory?: {
    notArray?: (value: unknown) => string;
    lengthMismatch?: (expected: number, actual: number) => string;
    tooShort?: (minimum: number, actual: number) => string;
  };
}

/**
 * Tuple Builder Composable Plugin - V8 Optimized Version
 *
 * Optimization strategies:
 * 1. Pre-compute all validators during build phase
 * 2. Use monomorphic functions for array checks
 * 3. Minimize object allocations in hot paths
 * 4. Cache rest validator to avoid rebuilding
 * 5. Use fast paths for common cases
 */

// Type for tuple builder composition - stores all arguments as unknown[]
type TupleBuilderComposition = unknown[];

// V8 optimization: Monomorphic array check function
const isArray = Array.isArray;

// V8 optimization: Pre-defined error objects to avoid allocations
const NOT_ARRAY_ERROR = Object.freeze({
  code: "TUPLE_NOT_ARRAY",
  message: "Value must be an array",
});

const LENGTH_MISMATCH_ERROR = Object.freeze({
  code: "TUPLE_LENGTH_MISMATCH",
  prefix: "Tuple must have exactly",
  suffix: "elements, got",
});

const TOO_SHORT_ERROR = Object.freeze({
  code: "TUPLE_TOO_SHORT",
  prefix: "Tuple must have at least",
  suffix: "elements, got",
});

export const tupleBuilderPlugin = createComposableDirectlyPlugin<
  "tupleBuilder",
  "builder",
  readonly ["tuple"],
  TupleBuilderComposition
>(
  "tupleBuilder",
  "builder",
  ["tuple"] as const,
  <TPlugins>(
    compositions: Array<TupleBuilderComposition>,
    fieldPath: string,
    plugins: TPlugins
  ): ComposableValidatorResult => {
    // Since builder() should only be called once, take the first composition
    const args = compositions[0] || [];

    // Fast path for empty args
    if (args.length === 0) {
      return createValidatorResult([
        createValidator("tupleBuilder", () => false, {
          inputType: "tuple",
          outputType: "tuple",
        }),
      ]);
    }

    // Separate builder functions from options using overload pattern
    let builderFns: TupleBuilderFunction<object, unknown>[] = [];
    let restBuilderFn: RestBuilderFunction<object, unknown> | undefined;

    // V8 optimization: Use explicit length check
    const argsLength = args.length;
    const lastArg = args[argsLength - 1];

    // V8 optimization: Simplified options detection
    const isOptions =
      lastArg &&
      typeof lastArg === "object" &&
      typeof lastArg !== "function" &&
      (Object.prototype.hasOwnProperty.call(lastArg, "rest") ||
        Object.keys(lastArg).length === 0);

    let options: TupleBuilderOptions<object, unknown> = {};

    if (isOptions) {
      // Last argument is options
      builderFns = args.slice(0, -1) as TupleBuilderFunction<object, unknown>[];
      options = lastArg as TupleBuilderOptions<object, unknown>;
      restBuilderFn = options.rest;
    } else {
      // All arguments are builder functions
      builderFns = args as TupleBuilderFunction<object, unknown>[];
    }

    // Pre-compute tuple length for fast access
    const tupleLength = builderFns.length;
    const hasRest = !!restBuilderFn;

    // Pre-compute validators for each tuple element
    const elementValidators = new Array(tupleLength);
    for (let i = 0; i < tupleLength; i++) {
      const elementContext = createFieldContext(
        `${fieldPath}[${i}]`,
        plugins as any
      );

      const elementBuilder = builderFns[i](elementContext as any);

      if (elementBuilder && typeof elementBuilder.build === "function") {
        elementValidators[i] = elementBuilder.build();
      } else {
        elementValidators[i] = null;
      }
    }

    // Pre-compute rest validator if needed
    let restValidator: any = null;
    if (restBuilderFn) {
      const restContext = createFieldContext(
        `${fieldPath}[rest]`,
        plugins as any
      );
      const restBuilder = restBuilderFn(restContext as any);

      if (restBuilder && typeof restBuilder.build === "function") {
        restValidator = restBuilder.build();
      }
    }

    // V8 optimization: Monomorphic validation functions
    const validateFixedLength = (value: any[]): boolean => {
      // Fast path: exact length check
      if (value.length !== tupleLength) return false;

      // Validate each element
      for (let i = 0; i < tupleLength; i++) {
        const validator = elementValidators[i];
        if (validator && !validator.validate(value[i]).valid) {
          return false;
        }
      }
      return true;
    };

    const validateWithRest = (value: any[]): boolean => {
      const valueLength = value.length;

      // Fast path: minimum length check
      if (valueLength < tupleLength) return false;

      // Validate fixed elements
      for (let i = 0; i < tupleLength; i++) {
        const validator = elementValidators[i];
        if (validator && !validator.validate(value[i]).valid) {
          return false;
        }
      }

      // Validate rest elements if present
      if (restValidator && valueLength > tupleLength) {
        for (let i = tupleLength; i < valueLength; i++) {
          if (!restValidator.validate(value[i]).valid) {
            return false;
          }
        }
      }

      return true;
    };

    // Create the main validator with optimized check function
    const validator = createValidator(
      "tupleBuilder",
      (value: unknown) => {
        // V8 optimization: Monomorphic type check
        if (!isArray(value)) return false;

        // Use pre-selected validation function
        return hasRest ? validateWithRest(value) : validateFixedLength(value);
      },
      {
        inputType: "tuple",
        outputType: "tuple",
        severity: "error",
        async: false,
      }
    );

    // Custom validate function with detailed error reporting
    const customValidate = (value: unknown) => {
      if (!isArray(value)) {
        return {
          ...INVALID_RESULT,
          errors: [
            {
              path: fieldPath,
              message: options.messageFactory?.notArray
                ? options.messageFactory.notArray(value)
                : NOT_ARRAY_ERROR.message,
              code: NOT_ARRAY_ERROR.code,
            },
          ],
        };
      }

      const valueLength = value.length;

      // Length validation
      if (!hasRest && valueLength !== tupleLength) {
        return {
          ...INVALID_RESULT,
          errors: [
            {
              path: fieldPath,
              message: options.messageFactory?.lengthMismatch
                ? options.messageFactory.lengthMismatch(tupleLength, valueLength)
                : `${LENGTH_MISMATCH_ERROR.prefix} ${tupleLength} ${LENGTH_MISMATCH_ERROR.suffix} ${valueLength}`,
              code: LENGTH_MISMATCH_ERROR.code,
            },
          ],
        };
      }

      if (hasRest && valueLength < tupleLength) {
        return {
          ...INVALID_RESULT,
          errors: [
            {
              path: fieldPath,
              message: options.messageFactory?.tooShort
                ? options.messageFactory.tooShort(tupleLength, valueLength)
                : `${TOO_SHORT_ERROR.prefix} ${tupleLength} ${TOO_SHORT_ERROR.suffix} ${valueLength}`,
              code: TOO_SHORT_ERROR.code,
            },
          ],
        };
      }

      // Element validation with error collection
      const errors: any[] = [];

      // Validate fixed elements
      for (let i = 0; i < tupleLength; i++) {
        const validator = elementValidators[i];
        if (validator) {
          const elementValue = value[i];
          // Call validate with both value and allValues (parent object)
          const result = validator.validate(elementValue, value);
          if (!result.isValid()) {
            // V8 optimization: Pre-compute path
            const elementPath = `${fieldPath}[${i}]`;
            if (result.errors && result.errors.length > 0) {
              for (const error of result.errors) {
                errors.push({
                  ...error,
                  path: elementPath,
                });
              }
            } else {
              // Fallback if no errors array
              errors.push({
                path: elementPath,
                message: `Validation failed for element ${i}`,
                code: "ELEMENT_INVALID",
              });
            }
          }
        }
      }

      // Validate rest elements
      if (restValidator && valueLength > tupleLength) {
        for (let i = tupleLength; i < valueLength; i++) {
          const result = restValidator.validate(value[i]);
          if (!result.valid && result.errors) {
            // V8 optimization: Pre-compute path
            const elementPath = `${fieldPath}[${i}]`;
            for (const error of result.errors) {
              errors.push({
                ...error,
                path: elementPath,
              });
            }
          }
        }
      }

      return errors.length > 0 ? { ...INVALID_RESULT, errors } : VALID_RESULT;
    };

    // Return the validator result
    return createValidatorResult([validator], [], customValidate);
  }
);
