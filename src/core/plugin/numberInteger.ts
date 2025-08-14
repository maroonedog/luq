import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

const TYPE_NUMBER = "number";
const DEFAULT_CODE = "numberInteger";

// Local error message factory
const getErrorMessage = () => "Value must be an integer";

const supportedTypes = [TYPE_NUMBER] as const;

/**
 * @luq-plugin
 * @name numberInteger
 * @category standard
 * @description Validates that a number is an integer (whole number without decimals)
 * @allowedTypes ["number"]
 * @example
 * ```typescript
 * // Basic usage - ensures number is an integer
 * const validator = Builder()
 *   .use(numberIntegerPlugin)
 *   .for<OrderData>()
 *   .v("quantity", (b) => b.number.integer())
 *   .v("count", (b) => b.number.required().integer())
 *   .build();
 *
 * // Combined with range validation
 * builder.v("score", b => b.number.integer().min(0).max(100))
 *
 * // For ID validation
 * builder.v("userId", b => b.number.required().integer().positive())
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if number is an integer
 * @customError
 * ```typescript
 * .integer({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be a whole number (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const numberIntegerPlugin = plugin({
  name: "numberInteger",
  methodName: "integer",
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
        if (typeof value !== TYPE_NUMBER) return true;
        return Number.isInteger(value);
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
