import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";

// V8 Optimization: Module-level constants

const DEFAULT_CODE = "stringStartsWith";

// Local error message factory
const getErrorMessage = (prefix: string) =>
  `String must start with "${prefix}"`;

const supportedTypes = ["string"] as const;

/**
 * @luq-plugin
 * @name stringStartsWith
 * @category standard
 * @description Validates that a string begins with a specific prefix
 * @allowedTypes ["string"]
 * @example
 * ```typescript
 * // Basic usage - checks if string starts with prefix
 * const validator = Builder()
 *   .use(stringStartsWithPlugin)
 *   .for<ApiData>()
 *   .v("url", (b) => b.string.startsWith("https://"))
 *   .v("apiKey", (b) => b.string.required().startsWith("sk_"))
 *   .build();
 *
 * // For protocol validation
 * builder.v("secureUrl", b => b.string.startsWith("https://").url())
 *
 * // For ID prefixes
 * builder.v("orderId", b => b.string.startsWith("ORD-").pattern(/^ORD-\d{8}$/))
 * ```
 * @params
 * - prefix: string - The prefix that the string must start with
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if string starts with the prefix
 * @customError
 * ```typescript
 * .startsWith("REF-", {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must start with '${params.prefix}' (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const stringStartsWithPlugin = plugin({
  name: "stringStartsWith",
  methodName: "startsWith",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (prefix: string, options?: ValidationOptions) => {
    const code = options?.code || DEFAULT_CODE;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: MessageContext & { prefix: string }) => getErrorMessage(ctx.prefix));

    // Validate parameter
    if (typeof prefix !== "string") {
      throw new Error(`Invalid prefix: ${prefix}`);
    }

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        // Skip validation for non-strings
        if (typeof value !== "string") return true;
        // Fast path for empty prefix
        if (prefix.length === 0) return true;
        return value.startsWith(prefix);
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const ctx = { path, value, code, prefix };
        return messageFactory(ctx);
      },
      params: [prefix, options],
    };
  },
});
