/**
 * @luq-plugin
 * @name objectPropertyNames
 * @category object
 * @description Validates that all property names in an object match a specified pattern or schema
 * @allowedTypes ["object"]
 * @example
 * ```typescript
 * // Property names must match pattern
 * const validator = Builder()
 *   .use(objectPropertyNamesPlugin)
 *   .for<{ [key: string]: any }>()
 *   .v("config", (b) => b.object.propertyNames(/^[a-zA-Z_][a-zA-Z0-9_]*$/))
 *   .build();
 *
 * // Property names with custom validator
 * builder.v("data", b => b.object.propertyNames({
 *   validator: (name) => name.length >= 3 && !name.startsWith('_'),
 *   message: "Property names must be at least 3 characters and not start with underscore"
 * }))
 * ```
 * @params
 * - schema: RegExp | string | { validator: (name: string) => boolean, message?: string } - Pattern or validation schema for property names
 * @returns Validation function that checks all property names
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";

export interface PropertyNamesSchema {
  validator: (name: string) => boolean;
  message?: string;
}

export const objectPropertyNamesPlugin = plugin({
  name: "objectPropertyNames",
  methodName: "propertyNames",
  allowedTypes: ["object"] as const,
  category: "standard" as const,
  impl: (schema: RegExp | string | PropertyNamesSchema) => ({
    check: (value: any) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
      }

      const propertyNames = Object.keys(value);

      for (const propertyName of propertyNames) {
        // RegExp pattern
        if (schema instanceof RegExp) {
          if (!schema.test(propertyName)) return false;
        }
        // String pattern (create RegExp)
        else if (typeof schema === "string") {
          const pattern = new RegExp(schema);
          if (!pattern.test(propertyName)) return false;
        }
        // Custom validator
        else if (typeof schema === "object" && schema !== null && "validator" in schema) {
          if (!schema.validator(propertyName)) return false;
        }
        else {
          return false;
        }
      }

      return true;
    },
    code: "PROPERTY_NAMES",
    getErrorMessage: (value: any, path: string) => {
      const invalidNames = Object.keys(value || {}).filter((name) => {
        if (schema instanceof RegExp) {
          return !schema.test(name);
        } else if (typeof schema === "string") {
          return !new RegExp(schema).test(name);
        } else if (typeof schema === "object" && schema !== null && "validator" in schema) {
          return !schema.validator(name);
        }
        return true;
      });

      if (typeof schema === "object" && schema !== null && "message" in schema && schema.message) {
        return schema.message;
      }

      const patternDesc = schema instanceof RegExp 
        ? schema.toString()
        : typeof schema === "string" 
          ? `/${schema}/`
          : "the specified pattern";

      return `${path} has invalid property names: ${invalidNames.join(", ")}. Property names must match ${patternDesc}`;
    },
    params: [schema],
  }),
});