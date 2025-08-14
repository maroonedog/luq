import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

// Type-safe context for stringExactLength plugin
export interface StringExactLengthContext extends MessageContext {
  expected: number;
  actual: number;
}

const DEFAULT_CODE = "stringExactLength";

const supportedTypes = ["string"] as const;

/**
 * @luq-plugin
 * @name stringExactLength
 * @category standard
 * @description Validates that a string has exactly the specified length
 * @allowedTypes ["string"]
 * @example
 * ```typescript
 * // Basic usage - requires exact string length
 * const validator = Builder()
 *   .use(stringExactLengthPlugin)
 *   .for<FormData>()
 *   .v("zipCode", (b) => b.string.exactLength(5))
 *   .v("countryCode", (b) => b.string.required().exactLength(2))
 *   .build();
 *
 * // For product codes or SKUs
 * builder.v("productCode", b => b.string.exactLength(8).alphanumeric())
 *
 * // For fixed-format phone extensions
 * builder.v("extension", b => b.string.optional().exactLength(4))
 * ```
 * @params
 * - expectedLength: number - The exact length the string must have
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if string has exact length
 * @customError
 * ```typescript
 * .exactLength(4, {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must be exactly ${params.expected} characters (received: ${params.actual})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const stringExactLengthPlugin = plugin({
  name: "stringExactLength",
  methodName: "exactLength",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (
    expectedLength: number,
    options?: ValidationOptions<StringExactLengthContext>
  ) => {
    // Parameter validation
    if (typeof expectedLength !== "number" || expectedLength < 0) {
      throw new Error(
        `Invalid expectedLength: ${expectedLength}. Must be a non-negative number.`
      );
    }

    const code = options?.code || DEFAULT_CODE;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: StringExactLengthContext) =>
        `String must have exactly ${ctx.expected} characters, but got ${ctx.actual}`);

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        if (typeof value !== "string") return true;
        return value.length === expectedLength;
      },
      code: code,
      getErrorMessage: (value: any, path: string) => {
        const actual = typeof value === "string" ? value.length : 0;
        const ctx: StringExactLengthContext = {
          path,
          value,
          code,
          expected: expectedLength,
          actual: actual,
        };
        return messageFactory(ctx);
      },
      params: [expectedLength, options],
    };
  },
});
