import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";

const DEFAULT_CODE = "CUSTOM_VALIDATION_FAILED";

// Types that custom can be applied to
const supportedTypes = [
  "string",
  "number",
  "boolean",
  "date",
  "array",
  "object",
  "tuple",
  "union",
] as const;

/**
 * @luq-plugin
 * @name custom
 * @category standard
 * @description Allows custom validation logic
 * @allowedTypes ["string", "number", "boolean", "date", "array", "object", "tuple", "union"]
 * @example
 * ```typescript
 * // Basic custom validation
 * builder.v("username", b => b.string
 *   .custom((value) => {
 *     return !reservedUsernames.includes(value);
 *   }, {
 *     code: 'RESERVED_USERNAME',
 *     messageFactory: ({ path }) => `${path} username is reserved`
 *   })
 * )
 *
 * // With access to all values
 * builder.v("confirmPassword", b => b.string
 *   .custom((value, rootData) => {
 *     return value === rootData.password;
 *   }, {
 *     code: 'PASSWORD_MISMATCH',
 *     messageFactory: ({ path }) => `${path} passwords do not match`
 *   })
 * )
 * ```
 * @params
 * - validator: (value: any, rootData?: any) => boolean - Custom validation function
 * - options?: { code?: string; messageFactory?: (context: MessageContext) => string } - Error customization
 * @returns Validation function with custom logic
 * @customError
 * ```typescript
 * .custom(
 *   (value) => value.length > 5,
 *   {
 *     messageFactory: ({ path, value }) =>
 *       `${path} custom validation failed (received: ${value})`
 *   }
 * )
 * ```
 */
export const customPlugin = plugin({
  name: "custom",
  methodName: "custom",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (
    validator: (
      value: any,
      rootData?: any
    ) => boolean | { valid: boolean; message?: string },
    options?: ValidationOptions & { messageFactory?: (context: MessageContext) => string }
  ) => {
    const code = options?.code || DEFAULT_CODE;
    const defaultMessage = "Custom validation failed";
    const messageFactory =
      options?.messageFactory || ((ctx: MessageContext) => `${ctx.path} ${defaultMessage.toLowerCase()}`);

    // Store dynamic message from validator result
    let dynamicMessage: string | undefined;

    // Return hoisted validator format
    return {
      check: (value: any, rootData?: any) => {
        try {
          const result = validator(value, rootData);
          // Handle both boolean and object return types
          if (typeof result === "boolean") {
            return result;
          } else if (
            result &&
            typeof result === "object" &&
            "valid" in result
          ) {
            // Store the message for later use
            dynamicMessage = result.message;
            return result.valid;
          }
          return false;
        } catch (error) {
          // If validator throws, treat as failed validation
          return false;
        }
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        // Use dynamic message if available, otherwise use default
        if (dynamicMessage) {
          return dynamicMessage;
        }
        const ctx = { path, value, code };
        return messageFactory(ctx);
      },
      params: [validator, options],
    };
  },
});
