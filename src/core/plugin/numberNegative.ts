import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

const DEFAULT_CODE = "numberNegative";

// Local error message factory
const getErrorMessage = () => "Value must be negative";

const supportedTypes = ["number"] as const;

/**
 * @luq-plugin
 * @name numberNegative
 * @category standard
 * @description Validates that a number is strictly negative (less than zero)
 * @allowedTypes ["number"]
 * @example
 * ```typescript
 * // Basic usage - ensures number is negative (< 0)
 * const validator = Builder()
 *   .use(numberNegativePlugin)
 *   .for<TemperatureData>()
 *   .v("temperature", (b) => b.number.negative())
 *   .v("debt", (b) => b.number.required().negative())
 *   .build();
 *
 * // For temperature below freezing
 * builder.v("celsius", b => b.number.negative().max(-1))
 *
 * // For negative offsets or adjustments
 * builder.v("adjustment", b => b.number.negative().integer())
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if number is less than zero
 * @customError
 * ```typescript
 * .negative({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be negative (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const numberNegativePlugin = plugin({
  name: "numberNegative",
  methodName: "negative",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (options?: ValidationOptions) => {
    const code = options?.code || DEFAULT_CODE;
    const messageFactory =
      options?.messageFactory || ((ctx: MessageContext) => getErrorMessage());

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        // Only validate numbers
        if (typeof value !== "number") return true;
        return value < 0;
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const ctx = { path, value, code };
        return messageFactory(ctx);
      },
      params: options ? [options] : [],
    };
  },
  // Metadata for optimized error handling
});
