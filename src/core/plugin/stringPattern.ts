import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import { VALID_RESULT, INVALID_RESULT } from "./shared-constants";

const DEFAULT_CODE = "stringPattern";

const supportedTypes = ["string"] as const;

/**
 * @luq-plugin
 * @name stringPattern
 * @category standard
 * @description Validates that a string matches a regular expression pattern
 * @allowedTypes ["string"]
 * @example
 * ```typescript
 * // Basic usage - validate against regex pattern
 * const validator = Builder()
 *   .use(stringPatternPlugin)
 *   .for<UserData>()
 *   .v("phone", (b) => b.string.pattern(/^\d{3}-\d{3}-\d{4}$/))
 *   .v("zipCode", (b) => b.string.pattern(/^\d{5}(-\d{4})?$/))
 *   .build();
 *
 * // Common patterns
 * builder.v("hexColor", b => b.string.pattern(/^#[0-9A-Fa-f]{6}$/))
 * builder.v("slug", b => b.string.pattern(/^[a-z0-9-]+$/))
 * ```
 * @params
 * - pattern: RegExp - Regular expression to match against
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if string matches the pattern
 * @customError
 * ```typescript
 * .pattern(/^[A-Z]{2}\d{4}$/, {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must match pattern ${params.pattern} (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const stringPatternPlugin = plugin({
  name: "stringPattern",
  methodName: "pattern",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (regex: RegExp | string, options?: ValidationOptions) => {
    const code = options?.code || DEFAULT_CODE;
    const messageFactory =
      options?.messageFactory || ((ctx: MessageContext) => "Invalid format");
    const patternString = regex.toString();
    const regexInternal = typeof regex === "string" ? new RegExp(regex) : regex;

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        if (typeof value !== "string") return true;
        return regexInternal.test(value);
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const ctx = {
          path,
          value,
          code,
          pattern: patternString,
        };
        return messageFactory(ctx);
      },
      params: [regex, options],
    };
  },
});
