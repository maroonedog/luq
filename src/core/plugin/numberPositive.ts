import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

const DEFAULT_CODE = "numberPositive";

// Local error message factory
const getErrorMessage = () => "Value must be positive";

const supportedTypes = ["number"] as const;

/**
 * @luq-plugin
 * @name numberPositive
 * @category standard
 * @description Validates that a number is strictly positive (greater than zero)
 * @allowedTypes ["number"]
 * @example
 * ```typescript
 * // Basic usage - ensures number is positive (> 0)
 * const validator = Builder()
 *   .use(numberPositivePlugin)
 *   .for<PricingData>()
 *   .v("price", (b) => b.number.positive())
 *   .v("quantity", (b) => b.number.required().positive())
 *   .build();
 *
 * // For monetary values
 * builder.v("payment", b => b.number.positive().multipleOf(0.01))
 *
 * // For counts and quantities
 * builder.v("itemCount", b => b.number.positive().integer())
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if number is greater than zero
 * @customError
 * ```typescript
 * .positive({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be positive (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const numberPositivePlugin = plugin({
  name: "numberPositive",
  methodName: "positive",
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
        if (typeof value !== "number") return true;
        return value > 0;
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
