import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationResultWithFlags, SkipFurtherValidationFlag } from "./types";
import { VALID_RESULT } from "./shared-constants";

// V8 Optimization: Module-level frozen constants
const SKIP_VALIDATION_RESULT = Object.freeze({
  valid: true,
  __skipFurtherValidation: true,
}) as any;

// All types that optional can be applied to
const allTypes = [
  "string",
  "number",
  "boolean",
  "array",
  "object",
  "date",
  "union",
] as const;

/**
 * @luq-plugin
 * @name optional
 * @category standard
 * @description Allows a field to be undefined (but not null or empty string)
 * @allowedTypes ["string", "number", "boolean", "array", "object", "date", "union"]
 * @example
 * ```typescript
 * // Basic usage - field can be undefined
 * const validator = Builder()
 *   .use(optionalPlugin)
 *   .for<UserProfile>()
 *   .v("nickname", (b) => b.string.optional().min(3))
 *   .v("age", (b) => b.number.optional().min(0))
 *   .build();
 *
 * // Arrays and objects can be optional
 * builder.v("hobbies", b => b.array.optional().minLength(1))
 * builder.v("settings", b => b.object.optional())
 * ```
 * @params
 * No parameters - this is a modifier plugin
 * @returns Validation function that returns true and skips further validation if value is undefined
 * @customError
 * This plugin does not generate errors - it allows undefined values
 * @since 0.1.0-alpha
 */
export const optionalPlugin = plugin({
  name: "optional",
  methodName: "optional",
  allowedTypes: allTypes,
  category: "standard",
  impl: () => {
    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Reject null values explicitly
        if (value === null) {
          return false;
        }
        // Accept undefined and all other values
        return true;
      },
      code: "optional",

      getErrorMessage: (value: any, path: string) => {
        if (value === null) {
          return `${path} cannot be null (use undefined for optional fields)`;
        }
        return "Optional validation error (should not happen)";
      },
      params: [],
      // Special flag to indicate this handles undefined values
      isOptional: true,
      skipForUndefined: true,
    };
  },
});
