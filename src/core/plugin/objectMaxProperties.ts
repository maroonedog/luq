import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

const ERROR_CODE = "objectMaxProperties";

const supportedTypes = ["object"] as const;

/**
 * @luq-plugin
 * @name objectMaxProperties
 * @category standard
 * @description Validates that an object has at most the specified maximum number of properties
 * @allowedTypes ["object"]
 * @example
 * ```typescript
 * // Basic usage - ensure object doesn't exceed maximum properties
 * const validator = Builder()
 *   .use(objectMaxPropertiesPlugin)
 *   .for<ConfigObject>()
 *   .v("metadata", (b) => b.object.maxProperties(5))
 *   .v("settings", (b) => b.object.maxProperties(10))
 *   .build();
 *
 * // With custom error message
 * builder.v("config", b => b.object.maxProperties(3, {
 *   messageFactory: ({ path, params }) =>
 *     `${path} can have at most ${params.max} properties`
 * }))
 * ```
 * @params
 * - max: number - Maximum number of properties allowed
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if object has at most maximum properties
 * @customError
 * ```typescript
 * .maxProperties(3, {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} can have at most ${params.max} properties (has ${Object.keys(value).length})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const objectMaxPropertiesPlugin = plugin({
  name: "objectMaxProperties",
  methodName: "maxProperties",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (maxValue: number, options?: ValidationOptions) => {
    const code = options?.code || ERROR_CODE;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: MessageContext & { max: number; actual: number }) =>
        `Must have at most ${ctx.max} properties, but has ${ctx.actual}`);

    // Pre-validate the maxValue parameter
    if (typeof maxValue !== "number" || isNaN(maxValue) || maxValue < 0) {
      throw new Error(
        `Invalid maxValue: ${maxValue}. Must be a non-negative number.`
      );
    }

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        if (typeof value !== "object" || value === null) return true;

        // Count enumerable properties
        const propertyCount = Object.keys(value).length;
        return propertyCount <= maxValue;
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const actual =
          typeof value === "object" && value !== null
            ? Object.keys(value).length
            : 0;
        const ctx = {
          path,
          value,
          code,
          max: maxValue,
          actual: actual,
        };
        return messageFactory(ctx);
      },
      params: [maxValue, options],
    };
  },
});
