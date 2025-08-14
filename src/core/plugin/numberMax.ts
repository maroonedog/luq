import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

// Type-safe context for numberMax plugin
export interface NumberMaxContext extends MessageContext {
  max: number;
  actual: number;
  exclusive: boolean;
}

const DEFAULT_CODE = "numberMax" as const;

const supportedTypes = ["number"] as const;

/**
 * @luq-plugin
 * @name numberMax
 * @category standard
 * @description Validates that a number is less than or equal to the specified maximum value
 * @allowedTypes ["number"]
 * @example
 * ```typescript
 * // Basic usage - set maximum allowed value
 * const validator = Builder()
 *   .use(numberMaxPlugin)
 *   .for<Settings>()
 *   .v("percentage", (b) => b.number.max(100))
 *   .v("discount", (b) => b.number.max(50))
 *   .v("temperature", (b) => b.number.max(40))
 *   .build();
 *
 * // For percentages with range
 * builder.v("successRate", b => b.number.min(0).max(100))
 * ```
 * @params
 * - max: number - Maximum allowed value (inclusive)
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if number is less than or equal to maximum
 * @customError
 * ```typescript
 * .max(100, {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must not exceed ${params.max} (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const numberMaxPlugin = plugin({
  name: "numberMax",
  methodName: "max",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (
    maxValue: number,
    options?: ValidationOptions<NumberMaxContext> & { exclusive?: boolean }
  ) => {
    const code = options?.code || DEFAULT_CODE;
    const exclusive = options?.exclusive || false;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: NumberMaxContext) => {
        if (ctx.exclusive) {
          return `Value must be less than ${ctx.max}, but got ${ctx.actual}`;
        }
        return `Value must be at most ${ctx.max}, but got ${ctx.actual}`;
      });

    // Validate parameter
    if (typeof maxValue !== "number" || isNaN(maxValue)) {
      throw new Error(`Invalid maxValue: ${maxValue}`);
    }

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        if (typeof value !== "number") return true;
        return exclusive ? value < maxValue : value <= maxValue;
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const actual = value;
        const ctx: NumberMaxContext = {
          path,
          value,
          code,
          max: maxValue,
          actual: actual,
          exclusive: exclusive,
        };
        return messageFactory(ctx);
      },
      params: [maxValue, options],
    };
  },
});
