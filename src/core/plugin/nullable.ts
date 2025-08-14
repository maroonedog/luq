import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationResultWithFlags, NullableFlag } from "./types";

import { VALID_RESULT } from "./shared-constants";

// V8 Optimization: Module-level constants
const NULLABLE_RESULT = Object.freeze({
  valid: true,
  __isNullable: true,
}) as any;

// All types that nullable can be applied to
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
 * @name nullable
 * @category standard
 * @description Allows a field to accept null as a valid value
 * @allowedTypes ["string", "number", "boolean", "array", "object", "date", "union"]
 * @example
 * ```typescript
 * // Basic usage - field can be null or valid string
 * const validator = Builder()
 *   .use(nullablePlugin)
 *   .for<UserProfile>()
 *   .v("middleName", (b) => b.string.nullable().min(3))
 *   .v("avatar", (b) => b.string.nullable().url())
 *   .build();
 *
 * // With other validations - null bypasses all validators
 * builder.v("score", b => b.number.nullable().min(0).max(100))
 * ```
 * @params
 * No parameters - this is a modifier plugin
 * @returns Validation function that returns true for null values and continues validation for non-null values
 * @customError
 * This plugin does not generate errors - it allows null values
 * @since 0.1.0-alpha
 */
export const nullablePlugin = plugin({
  name: "nullable",
  methodName: "nullable",
  allowedTypes: allTypes,
  category: "standard",
  impl: () => {
    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        // Nullable only validates type, not null/undefined handling
        // The skipForNull flag tells the executor to skip validation for null
        return true;
      },
      code: "nullable",

      getErrorMessage: (value: any, path: string) => {
        if (value === undefined) {
          return `${path} cannot be undefined (use null for nullable fields)`;
        }
        return "Nullable validation error (should not happen)";
      },
      params: [],
      // Special flag to indicate this handles null values
      isNullable: true,
      skipForNull: true,
    };
  },
});
