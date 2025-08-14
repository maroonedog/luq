import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";

// Local error code
const ERROR_CODE = "type_mismatch";

// Local error constants
const ERROR_MSG = "Not an object";

// Local error message function
function getErrorMessage(ctx: MessageContext): string {
  return ERROR_MSG;
}

// V8 Optimization: Module-level constants

const supportedTypes = ["object"] as const;

/**
 * @luq-plugin
 * @name object
 * @category standard
 * @description Validates that a value is a plain object (not null, array, or other types)
 * @allowedTypes ["object"]
 * @example
 * ```typescript
 * // Basic usage - validates that value is an object
 * const validator = Builder()
 *   .use(objectPlugin)
 *   .for<FormData>()
 *   .v("settings", (b) => b.object.object())
 *   .v("config", (b) => b.object.required().object())
 *   .build();
 *
 * // For nested object validation
 * builder.v("data", b => b.object.object())
 *   .v("data.name", b => b.string.required())
 *   .v("data.age", b => b.number.min(0))
 *
 * // Combined with required for mandatory objects
 * builder.v("user", b => b.object.required().object())
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if value is a plain object
 * @customError
 * ```typescript
 * .object({
 *   messageFactory: ({ path, value }) =>
 *     `${path} must be an object (received: ${typeof value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */

export const objectPlugin = plugin({
  name: "object",
  methodName: "object",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (options?: ValidationOptions) => {
    const code = options?.code || ERROR_CODE;
    const messageFactory = options?.messageFactory || getErrorMessage;

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        // Check for plain object: typeof === 'object' && not null && not array
        return (
          value !== null && typeof value === "object" && !Array.isArray(value)
        );
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
