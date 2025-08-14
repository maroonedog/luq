import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

const DEFAULT_CODE = "arrayUnique";

// Local error message factory
const getErrorMessage = () => "Array must contain unique values";

const supportedTypes = ["array"] as const;

/**
 * @luq-plugin
 * @name arrayUnique
 * @category standard
 * @description Validates that all elements in an array are unique (no duplicates)
 * @allowedTypes ["array"]
 * @example
 * ```typescript
 * // Basic usage - ensures all array elements are unique
 * const validator = Builder()
 *   .use(arrayUniquePlugin)
 *   .for<FormData>()
 *   .v("emails", (b) => b.array.unique())
 *   .v("userIds", (b) => b.array.required().unique())
 *   .build();
 *
 * // For tags or categories
 * builder.v("tags", b => b.array.unique().minLength(1).maxLength(10))
 *
 * // Combining with other array validations
 * builder.v("productCodes", b => b.array.unique().includes("PRIMARY"))
 * ```
 * @params
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if all array elements are unique
 * @customError
 * ```typescript
 * .unique({
 *   messageFactory: ({ path, value }) =>
 *     `${path} contains duplicate values`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const arrayUniquePlugin = plugin({
  name: "arrayUnique",
  methodName: "unique",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (options?: ValidationOptions) => {
    const code = options?.code || DEFAULT_CODE;
    const messageFactory =
      options?.messageFactory || ((ctx: MessageContext) => getErrorMessage());

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        // Skip validation for non-arrays
        if (!Array.isArray(value)) return true;

        const len = value.length;
        if (len <= 10) {
          // For small arrays, simple loop is faster than Set
          for (let i = 0; i < len; i++) {
            const item = value[i];
            for (let j = i + 1; j < len; j++) {
              if (item === value[j]) return false;
            }
          }
        } else {
          // For larger arrays, use Set for O(n) complexity
          const seen = new Set();
          for (let i = 0; i < len; i++) {
            const item = value[i];
            if (seen.has(item)) return false;
            seen.add(item);
          }
        }
        return true;
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const ctx = { path, value, code };
        return messageFactory(ctx);
      },
      params: options ? [options] : [],
    };
  },
  // Metadata for optimized error handling
});
