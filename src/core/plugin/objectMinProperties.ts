import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";

const ERROR_CODE = "objectMinProperties";

const supportedTypes = ["object"] as const;

/**
 * @luq-plugin
 * @name objectMinProperties
 * @category standard
 * @description Validates that an object has at least the specified minimum number of properties
 * @allowedTypes ["object"]
 * @example
 * ```typescript
 * // Basic usage - ensure object has minimum properties
 * const validator = Builder()
 *   .use(objectMinPropertiesPlugin)
 *   .for<ConfigObject>()
 *   .v("metadata", (b) => b.object.minProperties(2))
 *   .v("settings", (b) => b.object.minProperties(1))
 *   .build();
 *
 * // With custom error message
 * builder.v("config", b => b.object.minProperties(3, {
 *   messageFactory: ({ path, params }) =>
 *     `${path} must have at least ${params.min} properties`
 * }))
 * ```
 * @params
 * - min: number - Minimum number of properties required
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if object has at least minimum properties
 * @customError
 * ```typescript
 * .minProperties(3, {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} requires at least ${params.min} properties (has ${Object.keys(value).length})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const objectMinPropertiesPlugin = plugin({
  name: "objectMinProperties",
  methodName: "minProperties",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (minValue: number, options?: ValidationOptions) => {
    const code = options?.code || ERROR_CODE;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: MessageContext & { min: number; actual: number }) =>
        `Must have at least ${ctx.min} properties, but has ${ctx.actual}`);

    // Pre-validate the minValue parameter
    if (typeof minValue !== "number" || isNaN(minValue) || minValue < 0) {
      throw new Error(
        `Invalid minValue: ${minValue}. Must be a non-negative number.`
      );
    }

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        if (typeof value !== "object" || value === null) return true;

        // Count enumerable properties
        const propertyCount = Object.keys(value).length;
        return propertyCount >= minValue;
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
          min: minValue,
          actual: actual,
        };
        return messageFactory(ctx);
      },
      params: [minValue, options],
    };
  },
});
