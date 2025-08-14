import type { JSONSchema7 } from "json-schema";
import { validateFormat } from "./format-validators";
import { resolveSchemaRef } from "./ref-resolver";

/**
 * Core JSON Schema validation functions
 * Pure functions for validating values against JSON Schema
 */

/**
 * Deep equality check for schema validation
 */
const deepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  
  if (a == null || b == null) return a === b;
  
  if (typeof a !== typeof b) return false;
  
  if (typeof a !== 'object') return a === b;
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  return keysA.every(key => deepEqual(a[key], b[key]));
};

/**
 * Check if array has duplicate items
 */
const hasDuplicates = (arr: any[]): boolean => {
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (deepEqual(arr[i], arr[j])) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Type validation functions
 */
export const validateType = (value: any, type: string): boolean => {
  switch (type) {
    case 'null':
      return value === null;
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value) && !isNaN(value);
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return false;
  }
};

/**
 * Validate value against multiple types (JSON Schema type array)
 */
export const validateMultipleTypes = (value: any, types: string[]): boolean => {
  return types.some(type => validateType(value, type));
};

/**
 * Validate string constraints
 */
export const validateStringConstraints = (
  value: string, 
  schema: JSONSchema7,
  customFormats?: Record<string, (value: string) => boolean>
): boolean => {
  // Length constraints
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    return false;
  }
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    return false;
  }
  
  // Pattern validation
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
    return false;
  }
  
  // Format validation
  if (schema.format && !validateFormat(value, schema.format, customFormats)) {
    return false;
  }
  
  // Content encoding validation
  if (schema.contentEncoding) {
    if (schema.contentEncoding === 'base64') {
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(value) || (value.length > 0 && value.length % 4 !== 0)) {
        return false;
      }
    }
    // Add other encodings as needed
  }
  
  // Content media type validation
  // For now, we don't validate the actual content
  // This would require decoding and validating the content
  
  return true;
};

/**
 * Validate number constraints (including integer)
 */
export const validateNumberConstraints = (value: number, schema: JSONSchema7): boolean => {
  // Minimum/Maximum constraints
  if (schema.minimum !== undefined && value < schema.minimum) {
    return false;
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    return false;
  }
  
  // Exclusive constraints (Draft-07 format)
  if (schema.exclusiveMinimum !== undefined) {
    if (typeof schema.exclusiveMinimum === 'number') {
      if (value <= schema.exclusiveMinimum) return false;
    } else if (schema.exclusiveMinimum === true && schema.minimum !== undefined) {
      if (value <= schema.minimum) return false;
    }
  }
  
  if (schema.exclusiveMaximum !== undefined) {
    if (typeof schema.exclusiveMaximum === 'number') {
      if (value >= schema.exclusiveMaximum) return false;
    } else if (schema.exclusiveMaximum === true && schema.maximum !== undefined) {
      if (value >= schema.maximum) return false;
    }
  }
  
  // MultipleOf constraint
  if (schema.multipleOf !== undefined) {
    const division = value / schema.multipleOf;
    if (!Number.isInteger(division)) {
      return false;
    }
  }
  
  return true;
};

/**
 * Validate array constraints
 */
export const validateArrayConstraints = (
  value: any[], 
  schema: JSONSchema7,
  customFormats?: Record<string, (value: string) => boolean>,
  rootSchema?: JSONSchema7
): boolean => {
  // Length constraints
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    return false;
  }
  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    return false;
  }
  
  // Unique items constraint
  if (schema.uniqueItems && hasDuplicates(value)) {
    return false;
  }
  
  // Items validation
  if (schema.items) {
    if (Array.isArray(schema.items)) {
      // Tuple validation
      for (let i = 0; i < value.length; i++) {
        if (i < schema.items.length) {
          if (typeof schema.items[i] === 'boolean') {
            if (!schema.items[i]) return false;
          } else if (!validateValueAgainstSchema(value[i], schema.items[i] as JSONSchema7, customFormats, rootSchema)) {
            return false;
          }
        } else if (schema.additionalItems === false) {
          return false;
        } else if (schema.additionalItems && typeof schema.additionalItems === 'object') {
          if (!validateValueAgainstSchema(value[i], schema.additionalItems, customFormats, rootSchema)) {
            return false;
          }
        }
      }
    } else {
      // Single schema for all items
      for (const item of value) {
        if (typeof schema.items === 'boolean') {
          if (!schema.items) return false;
        } else if (!validateValueAgainstSchema(item, schema.items, customFormats, rootSchema)) {
          return false;
        }
      }
    }
  }
  
  // Contains constraint
  if (schema.contains !== undefined) {
    if (typeof schema.contains === 'boolean') {
      if (!schema.contains) {
        return false; // false means no items can satisfy
      }
      // true means at least one item must exist
      if (value.length === 0) {
        return false;
      }
    } else {
      const hasMatchingItem = value.some(item => 
        validateValueAgainstSchema(item, schema.contains as JSONSchema7, customFormats, rootSchema)
      );
      if (!hasMatchingItem) {
        return false;
      }
    }
  }
  
  return true;
};

/**
 * Validate object constraints
 */
export const validateObjectConstraints = (
  value: Record<string, any>, 
  schema: JSONSchema7,
  customFormats?: Record<string, (value: string) => boolean>,
  rootSchema?: JSONSchema7
): boolean => {
  const keys = Object.keys(value);
  
  // Property count constraints
  if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
    return false;
  }
  if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) {
    return false;
  }
  
  // Required properties
  if (schema.required) {
    for (const requiredProp of schema.required) {
      if (!(requiredProp in value)) {
        return false;
      }
    }
  }
  
  // Property validation
  if (schema.properties) {
    for (const [propName, propValue] of Object.entries(value)) {
      const propSchema = schema.properties[propName];
      if (propSchema && typeof propSchema === 'object') {
        if (!validateValueAgainstSchema(propValue, propSchema, customFormats, rootSchema)) {
          return false;
        }
      }
    }
  }
  
  // Pattern properties
  if (schema.patternProperties) {
    for (const [propName, propValue] of Object.entries(value)) {
      for (const [pattern, patternSchema] of Object.entries(schema.patternProperties)) {
        if (new RegExp(pattern).test(propName) && typeof patternSchema === 'object') {
          if (!validateValueAgainstSchema(propValue, patternSchema, customFormats, rootSchema)) {
            return false;
          }
        }
      }
    }
  }
  
  // Additional properties
  if (schema.additionalProperties === false) {
    const allowedProps = new Set([
      ...(schema.properties ? Object.keys(schema.properties) : []),
      ...keys.filter(key => {
        if (!schema.patternProperties) return false;
        return Object.keys(schema.patternProperties).some(pattern => 
          new RegExp(pattern).test(key)
        );
      })
    ]);
    
    for (const key of keys) {
      if (!allowedProps.has(key)) {
        return false;
      }
    }
  } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    const definedProps = new Set(schema.properties ? Object.keys(schema.properties) : []);
    for (const [propName, propValue] of Object.entries(value)) {
      if (!definedProps.has(propName)) {
        if (!validateValueAgainstSchema(propValue, schema.additionalProperties, customFormats, rootSchema)) {
          return false;
        }
      }
    }
  }
  
  // Property names validation
  if (schema.propertyNames !== undefined) {
    if (typeof schema.propertyNames === 'boolean') {
      if (!schema.propertyNames) {
        // false means no property names are valid
        if (keys.length > 0) return false;
      }
      // true means all property names are valid
    } else {
      for (const propName of keys) {
        if (!validateValueAgainstSchema(propName, schema.propertyNames, customFormats, rootSchema)) {
          return false;
        }
      }
    }
  }
  
  return true;
};

/**
 * Main validation function
 */
export const validateValueAgainstSchema = (
  value: any,
  schema: JSONSchema7,
  customFormats?: Record<string, (value: string) => boolean>,
  rootSchema?: JSONSchema7
): boolean => {
  // Resolve $ref if present
  if (schema.$ref && rootSchema) {
    schema = resolveSchemaRef(schema, rootSchema);
  }
  
  // Handle null/undefined values
  if (value === undefined) {
    return false; // undefined is never valid in JSON Schema
  }
  
  if (value === null) {
    if (schema.type === 'null' || (Array.isArray(schema.type) && schema.type.includes('null'))) {
      return true;
    }
    // Allow null to be validated against enum and const
    if (!schema.enum && schema.const === undefined) {
      return false;
    }
  }
  
  // Type validation
  if (schema.type) {
    if (Array.isArray(schema.type)) {
      if (!validateMultipleTypes(value, schema.type)) {
        return false;
      }
    } else {
      if (!validateType(value, schema.type)) {
        return false;
      }
    }
  }
  
  // Const validation
  if (schema.const !== undefined) {
    return deepEqual(value, schema.const);
  }
  
  // Enum validation
  if (schema.enum) {
    return schema.enum.some(enumValue => deepEqual(value, enumValue));
  }
  
  // Type-specific validations
  if (typeof value === 'string') {
    if (!validateStringConstraints(value, schema, customFormats)) {
      return false;
    }
  } else if (typeof value === 'number') {
    if (!validateNumberConstraints(value, schema)) {
      return false;
    }
  } else if (Array.isArray(value)) {
    if (!validateArrayConstraints(value, schema, customFormats, rootSchema)) {
      return false;
    }
  } else if (typeof value === 'object' && value !== null) {
    if (!validateObjectConstraints(value, schema, customFormats, rootSchema)) {
      return false;
    }
  }
  
  // Schema composition validation
  if (schema.allOf) {
    for (const subSchema of schema.allOf) {
      if (typeof subSchema === 'boolean') {
        if (!subSchema) return false;
        continue;
      }
      if (!validateValueAgainstSchema(value, subSchema, customFormats, rootSchema)) {
        return false;
      }
    }
  }
  
  if (schema.anyOf) {
    const passesAny = schema.anyOf.some(subSchema => {
      if (typeof subSchema === 'boolean') return subSchema;
      return validateValueAgainstSchema(value, subSchema, customFormats, rootSchema);
    });
    if (!passesAny) {
      return false;
    }
  }
  
  if (schema.oneOf) {
    let validCount = 0;
    for (const subSchema of schema.oneOf) {
      if (typeof subSchema === 'boolean') {
        if (subSchema) validCount++;
        continue;
      }
      if (validateValueAgainstSchema(value, subSchema, customFormats, rootSchema)) {
        validCount++;
      }
    }
    if (validCount !== 1) {
      return false;
    }
  }
  
  if (schema.not) {
    if (typeof schema.not === 'boolean') {
      if (schema.not) return false;
    } else if (validateValueAgainstSchema(value, schema.not, customFormats, rootSchema)) {
      return false;
    }
  }
  
  // Conditional validation (if/then/else)
  if (schema.if) {
    const ifResult = typeof schema.if === 'boolean' 
      ? schema.if 
      : validateValueAgainstSchema(value, schema.if, customFormats, rootSchema);
    
    if (ifResult && schema.then !== undefined) {
      const thenResult = typeof schema.then === 'boolean' 
        ? schema.then 
        : validateValueAgainstSchema(value, schema.then, customFormats, rootSchema);
      return thenResult;
    } else if (!ifResult && schema.else !== undefined) {
      const elseResult = typeof schema.else === 'boolean' 
        ? schema.else 
        : validateValueAgainstSchema(value, schema.else, customFormats, rootSchema);
      return elseResult;
    }
  }
  
  return true;
};