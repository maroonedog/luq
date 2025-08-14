import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";
const DEFAULT_CODE = "arrayIncludes";

// Local error message factory
const getErrorMessage = (element: any) =>
  `Array must include ${JSON.stringify(element)}`;

const supportedTypes = ["array"] as const;

/**
 * @luq-plugin
 * @name arrayIncludes
 * @category standard
 * @description Validates that an array contains a specific required element
 * @allowedTypes ["array"]
 * @example
 * ```typescript
 * // Basic usage - check if array contains specific item
 * const validator = Builder()
 *   .use(arrayIncludesPlugin)
 *   .for<UserData>()
 *   .v("roles", (b) => b.array.includes("admin"))
 *   .v("permissions", (b) => b.array.includes("read"))
 *   .build();
 *
 * // Multiple required items
 * builder.v("features", b => b.array
 *   .includes("core")
 *   .includes("api")
 * )
 * ```
 * @params
 * - expected: any - The element that must be present in the array
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that returns true if array contains the expected element
 * @customError
 * ```typescript
 * .includes("admin", {
 *   messageFactory: ({ path, value, params }) =>
 *     `${path} must include "${params.expected}" (current: [${value.join(", ")}])`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const arrayIncludesPlugin = plugin({
  name: "arrayIncludes",
  methodName: "includes",
  allowedTypes: supportedTypes,
  category: "arrayElement",
  impl: <TElement = any>(element: TElement, options?: ValidationOptions) => {
    const code = options?.code || DEFAULT_CODE;
    const messageFactory =
      options?.messageFactory ||
      ((ctx: MessageContext & { element: any }) => getErrorMessage(ctx.element));

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        // Skip validation for non-arrays
        if (!Array.isArray(value)) return true;
        return value.includes(element);
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const ctx = { path, value, code, element: element };
        return messageFactory(ctx);
      },
      params: [element, options],
    };
  },
});
