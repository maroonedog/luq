import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

// Type-safe context for numberMin plugin
export interface NumberMinContext extends MessageContext {
  min: number;
  actual: number;
  exclusive: boolean;
}

const ERROR_CODE = "numberMin";

const supportedTypes = ["number"] as const;

/**
 * @luq-plugin
 * @name numberMin
 * @category standard
 * @description Validates that a number is greater than or equal to the specified minimum value
 * @allowedTypes ["number"]
 * @example
 * ```typescript
 * // Basic usage - set minimum allowed value
 * const validator = Builder()
 *   .use(numberMinPlugin)
 *   .for<OrderForm>()
 *   .v("age", (b) => b.number.min(18))
 *   .v("quantity", (b) => b.number.min(1))
 *   .v("price", (b) => b.number.min(0.01))
 *   .build();
 *
 * // Combined with max for range validation
 * builder.v("percentage", b => b.number.min(0).max(100))
 * ```
 * @params
 * - min: number - Minimum allowed value (inclusive)
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if number is greater than or equal to minimum
 * @customError
 * ```typescript
 * .min(18, {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must be at least ${params.min} (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const numberMinPlugin = plugin({
  name: "numberMin",
  methodName: "min",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (
    minValue: number,
    options?: ValidationOptions<NumberMinContext> & { exclusive?: boolean }
  ) => {
    const code = options?.code || ERROR_CODE;
    const exclusive = options?.exclusive || false;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: NumberMinContext) => {
        if (ctx.exclusive) {
          return `Value must be greater than ${ctx.min}, but got ${ctx.actual}`;
        }
        return `Value must be at least ${ctx.min}, but got ${ctx.actual}`;
      });

    // Pre-validate the minValue parameter
    if (typeof minValue !== "number" || isNaN(minValue)) {
      throw new Error(`Invalid minValue: ${minValue}`);
    }

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        if (typeof value !== "number") return true;
        return exclusive ? value > minValue : value >= minValue;
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const actual = value;
        const ctx: NumberMinContext = {
          path,
          value,
          code,
          min: minValue,
          actual: actual,
          exclusive: exclusive,
        };
        return messageFactory(ctx);
      },
      params: [minValue, options],
    };
  },
});
