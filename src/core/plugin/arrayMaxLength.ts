import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

// Type-safe context for arrayMaxLength plugin
export interface ArrayMaxLengthContext extends MessageContext {
  max: number;
  actual: number;
}

const DEFAULT_CODE = "arrayMaxLength" as const;

const supportedTypes = ["array"] as const;

/**
 * @luq-plugin
 * @name arrayMaxLength
 * @category standard
 * @description Validates that an array does not exceed the specified maximum number of elements
 * @allowedTypes ["array"]
 * @example
 * ```typescript
 * // Basic usage - set maximum array length
 * const validator = Builder()
 *   .use(arrayMaxLengthPlugin)
 *   .for<FormData>()
 *   .v("tags", (b) => b.array.maxLength(10))
 *   .v("attachments", (b) => b.array.maxLength(5))
 *   .build();
 *
 * // Limit file uploads with min and max
 * builder.v("files", b => b.array.minLength(1).maxLength(3))
 * ```
 * @params
 * - maxLength: number - Maximum number of elements allowed
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if array length does not exceed maximum
 * @customError
 * ```typescript
 * .maxLength(5, {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} can have at most ${params.maxLength} items (current: ${value.length})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const arrayMaxLengthPlugin = plugin({
  name: "arrayMaxLength",
  methodName: "maxLength",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (
    maxLength: number,
    options?: ValidationOptions<ArrayMaxLengthContext>
  ) => {
    const code = options?.code || DEFAULT_CODE;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: ArrayMaxLengthContext) =>
        `Array must have at most ${ctx.max} elements, but got ${ctx.actual}`);

    // Validate parameter
    if (typeof maxLength !== "number" || maxLength < 0) {
      throw new Error(`Invalid maxLength: ${maxLength}`);
    }

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        if (!Array.isArray(value)) return true;
        return value.length <= maxLength;
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const actual = Array.isArray(value) ? value.length : 0;
        const ctx: ArrayMaxLengthContext = {
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
