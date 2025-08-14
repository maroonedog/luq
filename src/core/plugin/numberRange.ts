import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

// Type-safe context for numberRange plugin
export interface NumberRangeContext extends MessageContext {
  min: number;
  max: number;
  actual: number;
}

const ERROR_CODE = "not_in_range";

const supportedTypes = ["number"] as const;

/**
 * @luq-plugin
 * @name numberRange
 * @category standard
 * @description Validates that a number is within a specified range (inclusive)
 * @allowedTypes ["number"]
 * @example
 * ```typescript
 * // Basic usage - ensures number is within range
 * const validator = Builder()
 *   .use(numberRangePlugin)
 *   .for<FormData>()
 *   .v("age", (b) => b.number.range(18, 65))
 *   .v("percentage", (b) => b.number.required().range(0, 100))
 *   .build();
 *
 * // For ratings
 * builder.v("rating", b => b.number.range(1, 5).integer())
 *
 * // For temperature ranges
 * builder.v("celsius", b => b.number.range(-273.15, 100))
 * ```
 * @params
 * - min: number - Minimum value (inclusive)
 * - max: number - Maximum value (inclusive)
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if number is within range
 * @customError
 * ```typescript
 * .range(0, 100, {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must be between ${params.min} and ${params.max} (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const numberRangePlugin = plugin({
  name: "numberRange",
  methodName: "range",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (
    min: number,
    max: number,
    options?: ValidationOptions<NumberRangeContext>
  ) => {
    const code = options?.code || ERROR_CODE;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: NumberRangeContext) =>
        `Value must be between ${ctx.min} and ${ctx.max}, but got ${ctx.actual}`);

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Handle invalid plugin parameters by always returning false
        if (typeof min !== "number" || typeof max !== "number") return false;
        if (isNaN(min) || isNaN(max)) return false;
        if (min > max) return false;
        
        // Skip validation for non-numbers
        if (typeof value !== "number") return true;
        return value >= min && value <= max;
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        // Provide appropriate error messages for invalid plugin parameters
        if (typeof min !== "number" || typeof max !== "number") {
          return `Plugin configuration error: Invalid range parameters (min=${min}, max=${max})`;
        }
        if (isNaN(min) || isNaN(max)) {
          return `Plugin configuration error: Cannot use NaN values (min=${min}, max=${max})`;
        }
        if (min > max) {
          return `Plugin configuration error: min (${min}) cannot be greater than max (${max})`;
        }
        
        const ctx: NumberRangeContext = {
          path,
          value,
          code,
          min,
          max,
          actual: value,
        };
        return messageFactory(ctx);
      },
      params: [min, max, options],
    };
  },
});
