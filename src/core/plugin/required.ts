import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import { VALID_RESULT, INVALID_RESULT } from "./shared-constants";

const ERROR_CODE = "required";
const getErrorMessage = (field: string) => `${field} is required`;

const supportedTypes = [
  "array",
  "boolean",
  "number",
  "object",
  "string",
  "date",
  "union",
  "tuple",
] as const;

/**
 * @luq-plugin
 * @name required
 * @category standard
 * @description Validates that a field is required (not null, undefined, or empty string)
 * @allowedTypes ["string", "number", "boolean", "date", "array", "object", "tuple", "union"]
 * @example
 * ```typescript
 * // Basic usage
 * const validator = Builder()
 *   .use(requiredPlugin)
 *   .for<UserProfile>()
 *   .v("name", (b) => b.string.required())
 *   .v("age", (b) => b.number.required())
 *   .v("terms", (b) => b.boolean.required())
 *   .build();
 *
 * // Custom error message
 * builder.v("email", b => b.string.required({
 *   messageFactory: ({ path }) => `${path} is required`
 * }))
 * ```
 * @params
 * - messageFactory?: (context: MessageContext) => string - Custom error message factory
 * @returns Validation function that returns true if value exists (not null/undefined/empty string)
 * @customError
 * ```typescript
 * .required({
 *   messageFactory: ({ path, value }) =>
 *     `${path} field is required (current value: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const requiredPlugin = plugin({
  name: "required",
  methodName: "required",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (options?: ValidationOptions & { allowNull?: boolean }) => {
    // V8 Optimization: Pre-compute values during plugin initialization
    const code = options?.code || ERROR_CODE;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: MessageContext & { field: string }) => getErrorMessage(ctx.field));
    const fieldName = options?.fieldName;
    const allowNull = options?.allowNull || false;

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        if (allowNull) {
          // Allow null but not undefined or empty string
          return !(value === undefined || value === "");
        }

        // NaN is considered a valid value (it's still a number type)
        // Check for null, undefined, or empty string
        return !(value === null || value === undefined || value === "");
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const ctx = { field: fieldName || path, path, value, code };
        return messageFactory(ctx);
      },
      params: options ? [options] : [],
    };
  },
});
