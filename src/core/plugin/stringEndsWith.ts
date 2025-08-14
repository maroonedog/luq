import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

const DEFAULT_CODE = "stringEndsWith";

// Local error message factory
const getErrorMessage = (suffix: string) => `String must end with "${suffix}"`;

const supportedTypes = ["string"] as const;

/**
 * @luq-plugin
 * @name stringEndsWith
 * @category standard
 * @description Validates that a string ends with a specific suffix
 * @allowedTypes ["string"]
 * @example
 * ```typescript
 * // Basic usage - checks if string ends with suffix
 * const validator = Builder()
 *   .use(stringEndsWithPlugin)
 *   .for<FileData>()
 *   .v("filename", (b) => b.string.endsWith(".pdf"))
 *   .v("configFile", (b) => b.string.required().endsWith(".json"))
 *   .build();
 *
 * // For file extension validation
 * builder.v("document", b => b.string.endsWith(".pdf").min(5))
 *
 * // Email domain validation
 * builder.v("email", b => b.string.email().endsWith("@company.com"))
 * ```
 * @params
 * - suffix: string - The suffix that the string must end with
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if string ends with the suffix
 * @customError
 * ```typescript
 * .endsWith(".json", {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must end with '${params.suffix}' (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const stringEndsWithPlugin = plugin({
  name: "stringEndsWith",
  methodName: "endsWith",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (suffix: string, options?: ValidationOptions) => {
    const code = options?.code || DEFAULT_CODE;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: MessageContext & { suffix: string }) => getErrorMessage(ctx.suffix));

    // Validate parameter
    if (typeof suffix !== "string") {
      throw new Error(`Invalid suffix: ${suffix}`);
    }

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        // Skip validation for non-strings
        if (typeof value !== "string") return true;
        // Fast path for empty suffix
        if (suffix.length === 0) return true;
        return value.endsWith(suffix);
      },
      code: code,
      getErrorMessage: (value: any, path: string) => {
        const ctx = { path, value, code, suffix };
        return messageFactory(ctx);
      },
      params: [suffix, options],
    };
  },
});
