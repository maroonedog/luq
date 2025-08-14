import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

// Module-level regex (compiled once)
const ALPHANUMERIC_REGEX = /^[a-zA-Z0-9]+$/;
const ALPHANUMERIC_WITH_SPACES_REGEX = /^[a-zA-Z0-9\s]+$/;

// Local error constants
const DEFAULT_CODE = "stringAlphanumeric";
const DEFAULT_CODE_WITH_SPACES = "stringAlphanumeric_with_spaces";

// Local error message factory
const getErrorMessage = (allowSpaces: boolean) =>
  allowSpaces
    ? "String must contain only alphanumeric characters and spaces"
    : "String must contain only alphanumeric characters";

const supportedTypes = ["string"] as const;

/**
 * @luq-plugin
 * @name stringAlphanumeric
 * @category standard
 * @description Validates that a string contains only alphanumeric characters (letters and numbers)
 * @allowedTypes ["string"]
 * @example
 * ```typescript
 * // Basic usage - only letters and numbers allowed
 * const validator = Builder()
 *   .use(stringAlphanumericPlugin)
 *   .for<UserData>()
 *   .v("username", (b) => b.string.alphanumeric())
 *   .v("userId", (b) => b.string.required().alphanumeric())
 *   .build();
 *
 * // Allow spaces in addition to alphanumeric characters
 * builder.v("displayName", b => b.string.alphanumeric(true))
 *
 * // Combined with length validation
 * builder.v("productCode", b => b.string.alphanumeric().min(3).max(20))
 * ```
 * @params
 * - allowSpaces?: boolean - Whether to allow spaces (default: false)
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if string contains only allowed characters
 * @customError
 * ```typescript
 * .alphanumeric(false, {
 *   messageFactory: ({ path, value }) =>
 *     `${path} must contain only letters and numbers (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const stringAlphanumericPlugin = plugin({
  name: "stringAlphanumeric",
  methodName: "alphanumeric",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (allowSpaces: boolean = false, options?: ValidationOptions) => {
    const regex = allowSpaces
      ? ALPHANUMERIC_WITH_SPACES_REGEX
      : ALPHANUMERIC_REGEX;

    const defaultErrorCode = allowSpaces
      ? DEFAULT_CODE_WITH_SPACES
      : DEFAULT_CODE;

    const code = options?.code || defaultErrorCode;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: MessageContext & { allowSpaces: boolean }) =>
        getErrorMessage(ctx.allowSpaces));

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        // Skip validation for non-strings
        if (typeof value !== "string") return true;
        return regex.test(value);
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const ctx = { path, value, code, allowSpaces };
        return messageFactory(ctx);
      },
      params: [allowSpaces, options],
    };
  },
});
