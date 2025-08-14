/**
 * @luq-plugin
 * @name objectDependentSchemas
 * @category object
 * @description Validates object with dependent schemas that apply when certain properties exist
 * @allowedTypes ["object"]
 * @example
 * ```typescript
 * // Dependent schemas validation
 * const validator = Builder()
 *   .use(objectDependentSchemasPlugin)
 *   .for<{ creditCard?: string; billingAddress?: string; zipCode?: string; }>()
 *   .v("", (b) => b.object.dependentSchemas({
 *     creditCard: {
 *       properties: {
 *         billingAddress: { type: "string", minLength: 10 },
 *         zipCode: { type: "string", pattern: "^[0-9]{5}$" }
 *       },
 *       required: ["billingAddress", "zipCode"]
 *     }
 *   }))
 *   .build();
 * ```
 * @params
 * - schemas: Record<string, JSONSchema7 | SchemaValidator> - Property to schema mapping
 * @returns Validation function that applies schemas when trigger properties exist
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";
import type { JSONSchema7 } from "json-schema";

export interface SchemaValidator {
  validator: (value: any) => boolean;
  message?: string;
}

export type DependentSchemasMapping = Record<
  string,
  JSONSchema7 | SchemaValidator
>;

// Simplified JSON Schema validator
const validateAgainstJsonSchema = (value: any, schema: JSONSchema7): boolean => {
  // Type validation
  if (schema.type && schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
  }

  // Required properties
  if (schema.required && Array.isArray(schema.required)) {
    for (const prop of schema.required) {
      if (!(prop in value) || value[prop] === undefined) {
        return false;
      }
    }
  }

  // Property schemas
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in value) {
        const subSchema = propSchema as JSONSchema7;
        
        // Type checking
        if (subSchema.type) {
          const propValue = value[key];
          switch (subSchema.type) {
            case "string":
              if (typeof propValue !== "string") return false;
              if (subSchema.minLength && propValue.length < subSchema.minLength) return false;
              if (subSchema.maxLength && propValue.length > subSchema.maxLength) return false;
              if (subSchema.pattern && !new RegExp(subSchema.pattern).test(propValue)) return false;
              break;
            case "number":
              if (typeof propValue !== "number") return false;
              if (subSchema.minimum !== undefined && propValue < subSchema.minimum) return false;
              if (subSchema.maximum !== undefined && propValue > subSchema.maximum) return false;
              break;
            case "boolean":
              if (typeof propValue !== "boolean") return false;
              break;
            case "array":
              if (!Array.isArray(propValue)) return false;
              if (subSchema.minItems && propValue.length < subSchema.minItems) return false;
              if (subSchema.maxItems && propValue.length > subSchema.maxItems) return false;
              break;
            case "object":
              if (!propValue || typeof propValue !== "object" || Array.isArray(propValue)) return false;
              break;
          }
        }
        
        // Enum validation
        if (subSchema.enum && !subSchema.enum.includes(value[key])) return false;
        
        // Const validation
        if (subSchema.const !== undefined && value[key] !== subSchema.const) return false;
      }
    }
  }

  return true;
};

export const objectDependentSchemasPlugin = plugin({
  name: "objectDependentSchemas",
  methodName: "dependentSchemas",
  allowedTypes: ["object"] as const,
  category: "standard" as const,
  impl: (schemas: DependentSchemasMapping) => ({
    check: (value: any, allValues?: any) => {
      // Use allValues if provided (for root-level validation), otherwise use value
      const target = allValues !== undefined ? allValues : value;
      
      if (!target || typeof target !== "object" || Array.isArray(target)) {
        return true; // Skip validation for non-objects
      }

      for (const [triggerProperty, schema] of Object.entries(schemas)) {
        // Check if the trigger property exists
        if (triggerProperty in target && target[triggerProperty] !== undefined) {
          // Apply the dependent schema
          if ("validator" in schema && typeof schema.validator === "function") {
            if (!schema.validator(target)) {
              return false;
            }
          } else {
            if (!validateAgainstJsonSchema(target, schema as JSONSchema7)) {
              return false;
            }
          }
        }
      }

      return true;
    },
    code: "DEPENDENT_SCHEMAS",
    getErrorMessage: (value: any, path: string, allValues?: any) => {
      const target = allValues !== undefined ? allValues : value;
      const errors: string[] = [];

      for (const [triggerProperty, schema] of Object.entries(schemas)) {
        if (triggerProperty in target && target[triggerProperty] !== undefined) {
          if ("validator" in schema && typeof schema.validator === "function") {
            if (!schema.validator(target)) {
              const message = schema.message || `Schema validation failed when '${triggerProperty}' is present`;
              errors.push(message);
            }
          } else {
            const jsonSchema = schema as JSONSchema7;
            
            // Check for specific failures
            if (jsonSchema.required) {
              const missingProps = jsonSchema.required.filter(
                prop => !(prop in target) || target[prop] === undefined
              );
              if (missingProps.length > 0) {
                errors.push(`When '${triggerProperty}' is present, the following properties are required: ${missingProps.join(", ")}`);
              }
            }
            
            if (errors.length === 0) {
              errors.push(`Schema validation failed when '${triggerProperty}' is present`);
            }
          }
        }
      }

      const pathPrefix = path && path !== "" ? `${path}: ` : "";
      return errors.length > 0 
        ? `${pathPrefix}${errors.join("; ")}`
        : `${pathPrefix}Dependent schemas validation failed`;
    },
    params: [schemas],
  }),
});