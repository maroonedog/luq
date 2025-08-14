import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import { NestedKeyOf } from "../../types/util";
import { createFieldAccessor } from "./utils/field-accessor";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

const ERROR_CODE = "equals";

// Local error message function
function getErrorMessage(
  ctx: MessageContext & { fieldPath?: string; targetValue?: any }
): string {
  return ctx.fieldPath
    ? `Value must be equal to ${ctx.fieldPath}`
    : "Values must be equal";
}

// Types that compareField can be applied to - all types supported
const supportedTypes = [
  "string",
  "number",
  "boolean",
  "date",
  "object",
  "array",
  "tuple",
  "union",
] as const;

// Comparison function type
type CompareFn = (value: any, targetValue: any) => boolean;

// Default comparison function (strict equality)
const defaultCompareFn: CompareFn = (value, targetValue) =>
  value === targetValue;

// Comparison options
interface CompareFieldOptions extends ValidationOptions {
  compareFn?: CompareFn;
}

/**
 * @luq-plugin
 * @name compareField
 * @category standard
 * @description Validates a field's value by comparing it with another field's value using a custom comparison function
 * @allowedTypes ["string", "number", "boolean", "date", "object", "array", "null", "undefined"]
 * @example
 * ```typescript
 * // Default usage - strict equality
 * const validator = Builder()
 *   .use(compareFieldPlugin)
 *   .for<SignupForm>()
 *   .v("password", (b) => b.string.required().min(8))
 *   .v("confirmPassword", (b) => b.string.required().compareField("password"))
 *   .build();
 *
 * // Custom comparison - date before
 * builder.v("endDate", (b) => b.string.datetime().compareField("startDate", {
 *   compareFn: (endDate, startDate) => new Date(endDate) > new Date(startDate),
 *   messageFactory: () => "End date must be after start date"
 * }))
 *
 * // Number comparison
 * builder.v("maxValue", (b) => b.number.compareField("minValue", {
 *   compareFn: (max, min) => max >= min,
 *   messageFactory: () => "Max value must be greater than or equal to min value"
 * }))
 * ```
 * @params
 * - fieldPath: string - Path to the field to compare against (supports dot notation)
 * - options?: { compareFn?: (value, targetValue) => boolean, messageFactory?: (context) => string } - Optional configuration
 * @returns Validation function that returns true if comparison passes
 * @customError
 * ```typescript
 * .compareField("startDate", {
 *   compareFn: (end, start) => new Date(end) > new Date(start),
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must be after ${params.fieldPath}`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const compareFieldPlugin = plugin({
  name: "compareField",
  methodName: "compareField",
  allowedTypes: supportedTypes,
  category: "fieldReference",
  impl: (fieldPath: string, options?: CompareFieldOptions) => {
    const fieldAccessor = createFieldAccessor(fieldPath);
    const code = options?.code || ERROR_CODE;
    const messageFactory = options?.messageFactory || getErrorMessage;
    const compareFn = options?.compareFn || defaultCompareFn;

    // Return hoisted validator format
    return {
      check: (value: any, allValues?: any) => {
        // For field reference plugins, we need access to allValues
        if (!allValues) {
          // If allValues not provided, validation fails
          return false;
        }

        // Get the value of the target field using optimized accessor
        const targetValue = fieldAccessor(allValues);

        // Use the comparison function
        return compareFn(value, targetValue);
      },
      code: code,

      getErrorMessage: (value: any, path: string, allValues?: any) => {
        const targetValue = allValues ? fieldAccessor(allValues) : undefined;
        const ctx = {
          path,
          value,
          code,
          fieldPath,
          targetValue,
        };
        return messageFactory(ctx);
      },
      params: [fieldPath, options],
      // Store field reference information for debugging
      fieldReference: {
        fieldPath,
        compareFn,
      },
    };
  },
});
