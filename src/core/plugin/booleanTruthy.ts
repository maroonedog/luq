import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

const DEFAULT_CODE = "booleanTruthy";

// Local error message factory
const getErrorMessage = () => "Value must be truthy";

const supportedTypes = ["boolean"] as const;

/**
 * @luq-plugin
 * @name booleanTruthy
 * @category standard
 * @description Validates that a boolean value is exactly true
 * @allowedTypes ["boolean"]
 * @example
 * ```typescript
 * // Basic usage - ensure value is exactly true
 * const validator = Builder()
 *   .use(booleanTruthyPlugin)
 *   .for<FormData>()
 *   .v("isActive", (b) => b.boolean.truthy())
 *   .v("termsAccepted", (b) => b.boolean.required().truthy())
 *   .build();
 *
 * // For consent checkboxes
 * builder.v("agreeToTerms", b => b.boolean.required().truthy())
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true only if value is exactly true
 * @customError
 * ```typescript
 * .truthy({
 *   messageFactory: ({ path }) =>
 *     `${path} must be checked/accepted`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const booleanTruthyPlugin = plugin({
  name: "booleanTruthy",
  methodName: "truthy",
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
        // Skip validation for non-booleans
        if (typeof value !== "boolean") return true;
        return value === true;
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
