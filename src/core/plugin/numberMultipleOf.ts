import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

const ERROR_CODE = "not_multiple";

// Local error message function
function getErrorMessage(ctx: MessageContext & { divisor?: number }): string {
  return ctx.divisor
    ? `Value must be a multiple of ${ctx.divisor}`
    : "Value must be a multiple of the specified divisor";
}

const supportedTypes = ["number"] as const;

/**
 * @luq-plugin
 * @name numberMultipleOf
 * @category standard
 * @description Validates that a number is a multiple of a specified divisor
 * @allowedTypes ["number"]
 * @example
 * ```typescript
 * // Basic usage - ensures number is a multiple of divisor
 * const validator = Builder()
 *   .use(numberMultipleOfPlugin)
 *   .for<PricingData>()
 *   .v("quantity", (b) => b.number.multipleOf(5))
 *   .v("price", (b) => b.number.required().multipleOf(0.25))
 *   .build();
 *
 * // For time intervals (minutes)
 * builder.v("duration", b => b.number.multipleOf(15).min(0).max(240))
 *
 * // For currency with cents
 * builder.v("amount", b => b.number.multipleOf(0.01).positive())
 * ```
 * @params
 * - divisor: number - The number that the value must be divisible by
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if number is a multiple of divisor
 * @customError
 * ```typescript
 * .multipleOf(0.25, {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must be in increments of ${params.divisor} (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const numberMultipleOfPlugin = plugin({
  name: "numberMultipleOf",
  methodName: "multipleOf",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (divisor: number, options?: ValidationOptions) => {
    // Parameter validation
    if (typeof divisor !== "number" || divisor === 0) {
      throw new Error(
        `Invalid divisor: ${divisor}. Must be a non-zero number.`
      );
    }

    const code = options?.code || ERROR_CODE;
    const messageFactory = options?.messageFactory || getErrorMessage;

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        // Skip validation for non-numbers
        if (typeof value !== "number") return true;
        return value % divisor === 0;
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const ctx = { path, value, code, divisor };
        return messageFactory(ctx);
      },
      params: [divisor, options],
    };
  },
});
