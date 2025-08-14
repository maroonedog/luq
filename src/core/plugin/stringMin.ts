import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import { VALID_RESULT, INVALID_RESULT } from "./shared-constants";

// Type-safe context for stringMin plugin
export interface StringMinContext extends MessageContext {
  min: number;
  actual: number;
}

const TYPE_STRING = "string";
const ERROR_CODE = "stringMin";

const supportedTypes = [TYPE_STRING] as const;

/**
 * @luq-plugin
 * @name stringMin
 * @category standard
 * @description Validates that a string has at least the specified minimum length
 * @allowedTypes ["string"]
 * @example
 * ```typescript
 * // Basic usage - set minimum string length
 * const validator = Builder()
 *   .use(stringMinPlugin)
 *   .for<UserProfile>()
 *   .v("password", (b) => b.string.min(8))
 *   .v("username", (b) => b.string.min(3))
 *   .build();
 *
 * // Combined with other validators
 * builder.v("bio", b => b.string.required().min(10).max(500))
 * ```
 * @params
 * - min: number - Minimum character count
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if string length is at least the minimum
 * @customError
 * ```typescript
 * .min(8, {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must be at least ${params.min} characters (current: ${value.length})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const stringMinPlugin = plugin({
  name: "stringMin",
  methodName: "min",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (minLength: number, options?: ValidationOptions<StringMinContext>) => {
    // V8 Optimization: Pre-compute values during plugin initialization
    const code = options?.code || ERROR_CODE;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: MessageContext & { min: number; actual: number }) =>
        `String must have at least ${ctx.min} characters, but got ${ctx.actual}`);

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        // Skip validation for non-strings (including null/undefined)
        if (typeof value !== "string") return true;
        // Validate string length including empty strings
        return value.length >= minLength;
      },
      code: code,
      getErrorMessage: (value: any, path: string) => {
        const actual = typeof value === "string" ? value.length : 0;
        if (typeof messageFactory === "function") {
          // Handle different error function signatures
          const factory = messageFactory as any;
          if (factory.length === 0) {
            // Simple () => string function
            return factory();
          } else if (factory.length === 2) {
            // GenericMessageFactory (code, params) => string
            return factory(code, {
              path,
              value,
              min: minLength,
              actual: actual,
            });
          } else {
            // MessageFactory (ctx) => string
            const ctx = {
              path,
              value,
              code,
              min: minLength,
              actual: actual,
            };
            return factory(ctx);
          }
        }
        // Fallback to default message
        return `String must have at least ${minLength} characters, but got ${actual}`;
      },
      params: [minLength, options],
    };
  },
});
