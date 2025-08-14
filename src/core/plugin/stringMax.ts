import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

// Type-safe context for stringMax plugin
export interface StringMaxContext extends MessageContext {
  max: number;
  actual: number;
}

const DEFAULT_CODE = "stringMax" as const;

const supportedTypes = ["string"] as const;

/**
 * @luq-plugin
 * @name stringMax
 * @category standard
 * @description Validates that a string does not exceed the specified maximum length
 * @allowedTypes ["string"]
 * @example
 * ```typescript
 * // Basic usage - set maximum string length
 * const validator = Builder()
 *   .use(stringMaxPlugin)
 *   .for<UserProfile>()
 *   .v("username", (b) => b.string.max(20))
 *   .v("bio", (b) => b.string.max(500))
 *   .build();
 *
 * // Combined with min for length range
 * builder.v("description", b => b.string.min(10).max(200))
 * ```
 * @params
 * - max: number - Maximum character count
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if string length is within the maximum
 * @customError
 * ```typescript
 * .max(100, {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must not exceed ${params.max} characters (current: ${value.length})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const stringMaxPlugin = plugin({
  name: "stringMax",
  methodName: "max",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (maxLength: number, options?: ValidationOptions<StringMaxContext>) => {
    const code = options?.code || DEFAULT_CODE;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: StringMaxContext) =>
        `String must have at most ${ctx.max} characters, but got ${ctx.actual}`);

    // Validate parameter
    if (typeof maxLength !== "number" || maxLength < 0) {
      throw new Error(`Invalid maxLength: ${maxLength}`);
    }

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        if (typeof value !== "string") return true;
        return value.length <= maxLength;
      },
      code: code,
      getErrorMessage: (value: any, path: string) => {
        const actual = typeof value === "string" ? value.length : 0;
        const ctx: StringMaxContext = {
          path,
          value,
          code,
          max: maxLength,
          actual: actual,
        };
        return messageFactory(ctx);
      },
      params: [maxLength, options],
    };
  },
});
