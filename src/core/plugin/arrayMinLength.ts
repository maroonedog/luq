import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

// Type-safe context for arrayMinLength plugin
export interface ArrayMinLengthContext extends MessageContext {
  min: number;
  actual: number;
}

const DEFAULT_CODE = "arrayMinLength" as const;

const supportedTypes = ["array"] as const;

/**
 * @luq-plugin
 * @name arrayMinLength
 * @category standard
 * @description Validates that an array has at least the specified minimum number of elements
 * @allowedTypes ["array"]
 * @example
 * ```typescript
 * // Basic usage - set minimum array length
 * const validator = Builder()
 *   .use(arrayMinLengthPlugin)
 *   .for<FormData>()
 *   .v("tags", (b) => b.array.minLength(1))
 *   .v("items", (b) => b.array.minLength(3))
 *   .build();
 *
 * // Ensure non-empty array
 * builder.v("selectedOptions", b => b.array.required().minLength(1))
 * ```
 * @params
 * - minLength: number - Minimum number of elements required
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if array length is at least the minimum
 * @customError
 * ```typescript
 * .minLength(3, {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must have at least ${params.minLength} items (current: ${value.length})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const arrayMinLengthPlugin = plugin({
  name: "arrayMinLength",
  methodName: "minLength",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (
    minLength: number,
    options?: ValidationOptions<ArrayMinLengthContext>
  ) => {
    const code = options?.code || DEFAULT_CODE;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: ArrayMinLengthContext) =>
        `Array must have at least ${ctx.min} elements, but got ${ctx.actual}`);

    // Validate parameter
    if (typeof minLength !== "number" || minLength < 0) {
      throw new Error(`Invalid minLength: ${minLength}`);
    }

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        if (!Array.isArray(value)) return true;
        return value.length >= minLength;
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const actual = Array.isArray(value) ? value.length : 0;
        const ctx: ArrayMinLengthContext = {
          path,
          value,
          code,
          min: minLength,
          actual: actual,
        };
        return messageFactory(ctx);
      },
      params: [minLength, options],
    };
  },
});
