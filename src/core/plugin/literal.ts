import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

const DEFAULT_CODE = "literal";

// Local error message factory
const getErrorMessage = (expected: string | number | boolean) => {
  const expectedStr =
    typeof expected === "string" ? `"${expected}"` : String(expected);
  return `Value must be ${expectedStr}`;
};

// Types that literal can be applied to
const supportedTypes = ["string", "number", "boolean", "null"] as const;

/**
 * @luq-plugin
 * @name literal
 * @category standard
 * @description Validates that a value exactly matches a specific literal value
 * @allowedTypes ["string", "number", "boolean", "null"]
 * @example
 * ```typescript
 * // String literal - exact value match
 * const validator = Builder()
 *   .use(literalPlugin)
 *   .for<Config>()
 *   .v("type", (b) => b.string.literal("user"))
 *   .v("version", (b) => b.string.literal("v1"))
 *   .build();
 *
 * // Number and boolean literals
 * builder.v("maxRetries", b => b.number.literal(3))
 * builder.v("enabled", b => b.boolean.literal(true))
 * ```
 * @params
 * - expected: string | number | boolean | null - The exact value to match
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true only if value exactly matches expected
 * @customError
 * ```typescript
 * .literal("active", {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must be exactly "${params.expected}" (received: "${value}")`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const literalPlugin = plugin({
  name: "literal",
  methodName: "literal",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: <TValue extends string | number | boolean | null>(
    expectedValue: TValue,
    options?: ValidationOptions
  ) => {
    const code = options?.code || DEFAULT_CODE;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: MessageContext & { expected: typeof expectedValue }) =>
        getErrorMessage(ctx.expected ?? 'null'));

    // V8 Optimization: For number literals, pre-check for special values
    const isExpectedNaN =
      typeof expectedValue === "number" && isNaN(expectedValue);

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        // Handle NaN special case
        if (isExpectedNaN) {
          return typeof value === "number" && isNaN(value);
        }
        return value === expectedValue;
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const ctx = { path, value, code, expected: expectedValue };
        return messageFactory(ctx);
      },
      params: [expectedValue, options],
    };
  },
});
