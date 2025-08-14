/**
 * @luq-plugin
 * @name arrayContains
 * @category array
 * @description Validates that an array contains at least one item matching the specified schema or value
 * @allowedTypes ["array"]
 * @example
 * ```typescript
 * // Contains specific value
 * const validator = Builder()
 *   .use(arrayContainsPlugin)
 *   .for<{ tags: string[] }>()
 *   .v("tags", (b) => b.array.contains("important"))
 *   .build();
 *
 * // Contains matching schema
 * builder.v("items", b => b.array.contains({
 *   validator: (value) => typeof value === 'number' && value > 10,
 *   message: "Array must contain at least one number greater than 10"
 * }))
 * ```
 * @params
 * - schema: any | { validator: (value: any) => boolean, message?: string } - Value or validation schema
 * @returns Validation function that checks if array contains matching item
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { JSONSchema7 } from "json-schema";

export interface ContainsSchema {
  validator: (value: any) => boolean;
  message?: string;
}

// Helper to validate against JSON Schema (simplified)
const validateAgainstSchema = (value: any, schema: JSONSchema7): boolean => {
  if (schema.type) {
    switch (schema.type) {
      case "string":
        if (typeof value !== "string") return false;
        break;
      case "number":
        if (typeof value !== "number") return false;
        break;
      case "boolean":
        if (typeof value !== "boolean") return false;
        break;
      case "array":
        if (!Array.isArray(value)) return false;
        break;
      case "object":
        if (!value || typeof value !== "object" || Array.isArray(value)) return false;
        break;
      case "null":
        if (value !== null) return false;
        break;
    }
  }

  // Additional constraints
  if (typeof value === "string") {
    if (schema.minLength && value.length < schema.minLength) return false;
    if (schema.maxLength && value.length > schema.maxLength) return false;
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) return false;
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) return false;
    if (schema.maximum !== undefined && value > schema.maximum) return false;
    if (schema.multipleOf && value % schema.multipleOf !== 0) return false;
  }

  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.const !== undefined && value !== schema.const) return false;

  return true;
};

export const arrayContainsPlugin = plugin({
  name: "arrayContains",
  methodName: "contains",
  allowedTypes: ["array"] as const,
  category: "standard" as const,
  impl: (schema: any | ContainsSchema | JSONSchema7) => ({
    check: (value: any[]) => {
      if (!Array.isArray(value)) return false;
      
      // If it's a simple value, check for direct inclusion
      if (
        typeof schema !== "object" ||
        schema === null ||
        Array.isArray(schema)
      ) {
        return value.includes(schema);
      }

      // If it's a ContainsSchema with validator function
      if ("validator" in schema && typeof schema.validator === "function") {
        return value.some((item) => schema.validator(item));
      }

      // If it's a JSON Schema object
      if (typeof schema === "object" && schema !== null) {
        return value.some((item) => validateAgainstSchema(item, schema as JSONSchema7));
      }

      return false;
    },
    code: "ARRAY_CONTAINS",
    getErrorMessage: (value: any[], path: string) => {
      if (typeof schema === "object" && schema !== null && "message" in schema) {
        return schema.message || `${path} must contain at least one matching item`;
      }
      
      if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
        return `${path} must contain ${JSON.stringify(schema)}`;
      }

      return `${path} must contain at least one item matching the schema`;
    },
    params: [schema],
  }),
});