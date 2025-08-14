import type { JSONSchema7 } from "json-schema";

/**
 * Schema reference resolution utilities
 * Pure functions for resolving JSON Schema $ref
 */

export const resolveRef = (
  ref: string,
  rootSchema: JSONSchema7,
  definitions?: Record<string, JSONSchema7>
): JSONSchema7 => {
  if (!ref.startsWith('#')) {
    throw new Error(`External $ref not supported: ${ref}`);
  }
  
  const path = ref.slice(1).split('/');
  let current: any = rootSchema;
  
  for (const segment of path) {
    if (!segment) continue; // Skip empty segments from leading #/
    
    if (segment === 'definitions' || segment === '$defs') {
      current = current.definitions || current.$defs || {};
    } else {
      current = current[segment];
    }
    
    if (current === undefined) {
      throw new Error(`Cannot resolve $ref: ${ref}`);
    }
  }
  
  return current;
};

/**
 * Check if schema has $ref and resolve it
 */
export const resolveSchemaRef = (
  schema: JSONSchema7,
  rootSchema?: JSONSchema7,
  definitions?: Record<string, JSONSchema7>
): JSONSchema7 => {
  if (!schema.$ref) {
    return schema;
  }
  
  if (!rootSchema) {
    throw new Error('Root schema required for $ref resolution');
  }
  
  return resolveRef(schema.$ref, rootSchema, definitions);
};

/**
 * Recursively resolve all $refs in a schema
 */
export const resolveAllRefs = (
  schema: JSONSchema7,
  rootSchema: JSONSchema7,
  visited = new Set<string>()
): JSONSchema7 => {
  if (schema.$ref) {
    if (visited.has(schema.$ref)) {
      throw new Error(`Circular reference detected: ${schema.$ref}`);
    }
    visited.add(schema.$ref);
    const resolved = resolveRef(schema.$ref, rootSchema);
    return resolveAllRefs(resolved, rootSchema, visited);
  }
  
  // Deep resolve refs in nested schemas
  const result: JSONSchema7 = { ...schema };
  
  if (schema.properties) {
    result.properties = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (typeof prop === 'object') {
        result.properties[key] = resolveAllRefs(prop, rootSchema, new Set(visited));
      } else {
        result.properties[key] = prop;
      }
    }
  }
  
  if (schema.items) {
    if (Array.isArray(schema.items)) {
      result.items = schema.items.map(item => {
        if (typeof item === 'boolean') {
          return item;
        }
        return resolveAllRefs(item, rootSchema, new Set(visited));
      });
    } else if (typeof schema.items === 'object') {
      result.items = resolveAllRefs(schema.items, rootSchema, new Set(visited));
    } else {
      result.items = schema.items; // boolean
    }
  }
  
  // Resolve refs in schema composition
  if (schema.allOf) {
    result.allOf = schema.allOf.map(s => {
      if (typeof s === 'boolean') {
        return s;
      }
      return resolveAllRefs(s, rootSchema, new Set(visited));
    });
  }
  if (schema.anyOf) {
    result.anyOf = schema.anyOf.map(s => {
      if (typeof s === 'boolean') {
        return s;
      }
      return resolveAllRefs(s, rootSchema, new Set(visited));
    });
  }
  if (schema.oneOf) {
    result.oneOf = schema.oneOf.map(s => {
      if (typeof s === 'boolean') {
        return s;
      }
      return resolveAllRefs(s, rootSchema, new Set(visited));
    });
  }
  if (schema.not && typeof schema.not === 'object') {
    result.not = resolveAllRefs(schema.not, rootSchema, new Set(visited));
  }
  
  // Resolve refs in conditionals
  if (schema.if && typeof schema.if === 'object') {
    result.if = resolveAllRefs(schema.if, rootSchema, new Set(visited));
  }
  if (schema.then && typeof schema.then === 'object') {
    result.then = resolveAllRefs(schema.then, rootSchema, new Set(visited));
  }
  if (schema.else && typeof schema.else === 'object') {
    result.else = resolveAllRefs(schema.else, rootSchema, new Set(visited));
  }
  
  return result;
};