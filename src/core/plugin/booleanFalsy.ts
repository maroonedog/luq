import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

const DEFAULT_CODE = "booleanFalsy";

// Local error message factory
const getErrorMessage = () => "Value must be falsy";

const supportedTypes = ["boolean"] as const;

/**
 * @luq-plugin
 * @name booleanFalsy
 * @category standard
 * @description Validates that a boolean value is exactly false
 * @allowedTypes ["boolean"]
 * @example
 * ```typescript
 * // Basic usage - ensures value is exactly false
 * const validator = Builder()
 *   .use(booleanFalsyPlugin)
 *   .for<Settings>()
 *   .v("isActive", (b) => b.boolean.falsy())
 *   .v("debugMode", (b) => b.boolean.required().falsy())
 *   .build();
 *
 * // Privacy settings
 * builder.v("shareData", b => b.boolean.falsy())
 *
 * // Security flags
 * builder.v("allowExternalAccess", b => b.boolean.required().falsy())
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if value is exactly false
 * @customError
 * ```typescript
 * .falsy({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be set to false (current: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const booleanFalsyPlugin = plugin({
  name: "booleanFalsy",
  methodName: "falsy",
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
        return value === false;
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
