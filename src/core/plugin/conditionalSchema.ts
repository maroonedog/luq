import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import { JSONSchema7 } from "json-schema";

export interface ConditionalSchemaOptions extends ValidationOptions {
  ifSchema: JSONSchema7;
  thenSchema?: JSONSchema7;
  elseSchema?: JSONSchema7;
  validator?: (value: any, schema: JSONSchema7) => boolean;
}

/**
 * Conditional Schema Plugin (if/then/else)
 *
 * Handles JSON Schema Draft-07 conditional validation
 * @luq-plugin
 * @name conditionalSchema
 * @category advanced
 * @description Validates based on if/then/else conditions
 * @allowedTypes ["object"]
 */
export const conditionalSchemaPlugin = plugin({
  name: "conditionalSchema",
  methodName: "conditionalSchema",
  allowedTypes: ["object"] as const,
  category: "standard" as const,
  impl: (options: ConditionalSchemaOptions) => {
    const code = options?.code || "CONDITIONAL_SCHEMA";
    const messageFactory =
      options?.messageFactory ||
      ((ctx: MessageContext) => {
        // Evaluate the if condition for error message
        const ifResult = options.validator
          ? options.validator(ctx.value, options.ifSchema)
          : evaluateSchema(ctx.value, options.ifSchema);

        if (ifResult && options.thenSchema) {
          return `Value at ${ctx.path} must match "then" schema`;
        } else if (!ifResult && options.elseSchema) {
          return `Value at ${ctx.path} must match "else" schema`;
        }

        return `Conditional validation failed at ${ctx.path}`;
      });

    return {
      check: (value: any) => {
        if (value === null || value === undefined) {
          return true; // Skip validation for null/undefined
        }

        // Evaluate the if condition
        const ifResult = options.validator
          ? options.validator(value, options.ifSchema)
          : evaluateSchema(value, options.ifSchema);

        if (ifResult && options.thenSchema) {
          // If condition is true, validate against 'then' schema
          return options.validator
            ? options.validator(value, options.thenSchema)
            : evaluateSchema(value, options.thenSchema);
        } else if (!ifResult && options.elseSchema) {
          // If condition is false, validate against 'else' schema
          return options.validator
            ? options.validator(value, options.elseSchema)
            : evaluateSchema(value, options.elseSchema);
        }

        // If no then/else applies, validation passes
        return true;
      },
      code: code,
      getErrorMessage: (value: any, path: string) => {
        const ctx = { path, value, code };
        return messageFactory(ctx);
      },
      params: options ? [options] : [],
    };
  },
});

// Helper function to evaluate a basic schema
function evaluateSchema(value: any, schema: JSONSchema7): boolean {
  // Check type
  if (schema.type) {
    const type = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = getType(value);
    if (!type.includes(actualType)) {
      return false;
    }
  }

  // Check properties for objects
  if (schema.properties && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      // Check if property matches its schema
      if (key in value) {
        // For if/then/else, we typically just check if a property has a specific value
        if (typeof propSchema === "object" && !Array.isArray(propSchema)) {
          const ps = propSchema as JSONSchema7;
          if (ps.const !== undefined && value[key] !== ps.const) {
            return false;
          }
          if (ps.enum && !ps.enum.includes(value[key])) {
            return false;
          }
        }
      }
    }
  }

  // Check const
  if (schema.const !== undefined && value !== schema.const) {
    return false;
  }

  // Check enum
  if (schema.enum && !schema.enum.includes(value)) {
    return false;
  }

  return true;
}

function getType(value: any): any {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number" && Number.isInteger(value)) return "integer";
  return typeof value;
}
