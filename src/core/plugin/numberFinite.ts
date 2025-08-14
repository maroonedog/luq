import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

const DEFAULT_CODE = "numberFinite";

// Local error message factory
const getErrorMessage = () => "Value must be a finite number";

const supportedTypes = ["number"] as const;

/**
 * @luq-plugin
 * @name numberFinite
 * @category standard
 * @description Validates that a number is finite (not Infinity, -Infinity, or NaN)
 * @allowedTypes ["number"]
 * @example
 * ```typescript
 * // Basic usage - ensures number is finite
 * const validator = Builder()
 *   .use(numberFinitePlugin)
 *   .for<CalculationResult>()
 *   .v("score", (b) => b.number.finite())
 *   .v("ratio", (b) => b.number.required().finite())
 *   .build();
 *
 * // For division results that might be infinite
 * builder.v("average", b => b.number.finite().min(0))
 *
 * // For mathematical calculations
 * builder.v("result", b => b.number.required().finite().range(-1000, 1000))
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if number is finite
 * @customError
 * ```typescript
 * .finite({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be a finite number (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const numberFinitePlugin = plugin({
  name: "numberFinite",
  methodName: "finite",
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
        return Number.isFinite(value);
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
