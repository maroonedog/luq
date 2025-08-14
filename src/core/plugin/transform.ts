import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions } from "./types";

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
 * @name transform
 * @category transform
 * @description Transforms values after successful validation (type conversion, normalization, computed values)
 * @allowedTypes ["string", "number", "boolean", "array", "object", "date", "union"]
 * @example
 * ```typescript
 * // String transformation (lowercase)
 * const validator = Builder()
 *   .use(transformPlugin)
 *   .for<UserData>()
 *   .v("email", (b) =>
 *     b.string.required().email().transform(v => v.toLowerCase())
 *   )
 *   .build();
 *
 * // Number to string conversion
 * builder.v("age", b =>
 *   b.number.required().min(0).transform(v => String(v))
 * )
 *
 * // Array element transformation
 * builder.v("tags", b =>
 *   b.array.transform(tags => tags.map(t => t.trim().toLowerCase()))
 * )
 * ```
 * @params
 * - transformFn: (value: T) => U - Transform function that takes input value and returns transformed value
 * @returns Validation function with transformation
 * @customError
 * Transform plugin does not generate errors. Errors in transform function are treated as exceptions.
 * @since 0.1.0-alpha
 */

// Export using standard plugin API
export const transformPlugin = plugin({
  name: "transform",
  methodName: "transform",
  allowedTypes: allTypes,
  category: "transform",
  impl: ((transformFn: (value: any) => any, options?: ValidationOptions) => {
    const code = options?.code || "transform";

    // Return hoisted validator format using __transformFn only
    const result: import("../builder/plugins/plugin-interfaces").ValidatorFormat = {
      check: (value: any) => {
        // Transform plugin always passes validation
        // The actual transformation is handled by the field-builder
        return true;
      },
      code: code,
      getErrorMessage: (value: any, path: string) => {
        // Transform plugin doesn't generate validation errors
        // Errors in transform function are treated as exceptions
        return "Transform operation failed";
      },
      params: [transformFn, options],
      // Special marker for transform functionality
      __isTransform: true,
      __transformFn: transformFn,
    };

    return result;
  }) as import("../builder/plugins/plugin-interfaces").TransformPluginImplementation,
  // Metadata for optimized error handling
});
