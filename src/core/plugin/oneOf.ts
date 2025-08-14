import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";

// V8 Optimization: Module-level constants

const DEFAULT_CODE = "oneOf";

// Local error message factory
const getErrorMessage = (options: any[]) => {
  if (!Array.isArray(options)) {
    return "Value must be one of the allowed values";
  }
  const optionsStr = options.map((o) => JSON.stringify(o)).join(", ");
  return `Value must be one of: ${optionsStr}`;
};

// Types that oneOf can be applied to
const supportedTypes = ["string", "number", "boolean"] as const;

/**
 * @luq-plugin
 * @name oneOf
 * @category standard
 * @description Validates that a value is one of the specified allowed values (enum-like validation)
 * @allowedTypes ["string", "number", "boolean"]
 * @example
 * ```typescript
 * // String enum validation
 * const validator = Builder()
 *   .use(oneOfPlugin)
 *   .for<FormData>()
 *   .v("status", (b) => b.string.oneOf(["active", "inactive", "pending"]))
 *   .v("role", (b) => b.string.oneOf(["admin", "user", "guest"]))
 *   .build();
 *
 * // Number enum validation
 * builder.v("priority", b => b.number.oneOf([0, 1, 2, 3]))
 *
 * // With TypeScript const for type safety
 * const ROLES = ["admin", "user", "guest"] as const;
 * builder.v("userRole", b => b.string.oneOf(ROLES))
 * ```
 * @params
 * - allowed: Array<string | number | boolean> - Array of allowed values
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if value is in the allowed list
 * @customError
 * ```typescript
 * .oneOf(["A", "B", "C"], {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must be one of: ${params.allowed.join(", ")} (received: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const oneOfPlugin = plugin({
  name: "oneOf",
  methodName: "oneOf",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (allowedValues: readonly any[], options?: ValidationOptions) => {
    // Parameter validation
    if (!Array.isArray(allowedValues) || allowedValues.length === 0) {
      throw new Error("oneOf requires a non-empty array of allowed values");
    }

    const code = options?.code || DEFAULT_CODE;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: MessageContext & { options: any[] }) =>
        getErrorMessage(ctx.options));

    // Freeze a copy of allowed values for issue context
    const frozenOptions = Object.freeze([...allowedValues]);

    // Use Set for O(1) lookup if array is large
    const useSet = allowedValues.length > 7;
    const allowedSet = useSet ? new Set(allowedValues) : null;

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        // Let nullable plugin handle null and optional plugin handle undefined
        if (value === null || value === undefined) return true;

        // Use appropriate lookup method
        const isAllowed = useSet
          ? allowedSet!.has(value)
          : allowedValues.includes(value);

        return isAllowed;
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const ctx = { path, value, code, options: [...frozenOptions] };
        return messageFactory(ctx);
      },
      params: [allowedValues, options],
      // Store allowed values for debugging
      allowedValues: frozenOptions,
    };
  },
});
