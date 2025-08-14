import type { JSONSchema7 } from "json-schema";
import { LuqFieldDSL, LuqConstraints, JsonSchemaOptions } from "./types";
import { resolveSchemaRef } from "./ref-resolver";
import { validateValueAgainstSchema } from "./validation-core";

/**
 * DSL conversion utilities
 * Convert JSON Schema to Luq DSL and back
 */

/**
 * Convert JSON Schema to Luq DSL field definitions
 */
export const convertJsonSchemaToLuqDSL = (
  schema: JSONSchema7,
  parentPath: string = "",
  rootSchema?: JSONSchema7
): LuqFieldDSL[] => {
  const fields: LuqFieldDSL[] = [];
  const resolvedSchema = schema.$ref && rootSchema ? resolveSchemaRef(schema, rootSchema) : schema;
  
  // Handle root-level composition constraints (oneOf, anyOf, allOf at root level)
  if (parentPath === "" && (resolvedSchema.oneOf || resolvedSchema.anyOf || resolvedSchema.allOf)) {
    const constraints = extractConstraints(resolvedSchema, {}, "");
    const type = resolvedSchema.type ? mapJsonSchemaType(Array.isArray(resolvedSchema.type) ? resolvedSchema.type[0] : resolvedSchema.type) : "string";
    
    fields.push({
      path: "",
      type,
      constraints
    });
    
    return fields;
  }
  
  // Handle root-level constraints (for object schemas)
  if (resolvedSchema.type === "object" && parentPath === "") {
    const rootConstraints = extractRootConstraints(resolvedSchema);
    if (Object.keys(rootConstraints).length > 0) {
      fields.push({
        path: "",
        type: "object",
        constraints: rootConstraints
      });
    }
  }
  
  // Process object properties
  if (resolvedSchema.properties) {
    for (const [propertyName, propertySchema] of Object.entries(resolvedSchema.properties)) {
      if (typeof propertySchema === 'object') {
        const propertyPath = parentPath ? `${parentPath}.${propertyName}` : propertyName;
        const propertyFields = convertPropertyToLuqDSL(
          propertyName,
          propertySchema,
          propertyPath,
          resolvedSchema,
          rootSchema
        );
        fields.push(...propertyFields);
      }
    }
  }
  
  // Handle pattern properties
  if (resolvedSchema.patternProperties) {
    for (const [pattern, patternSchema] of Object.entries(resolvedSchema.patternProperties)) {
      if (typeof patternSchema === 'object') {
        const patternPath = parentPath ? `${parentPath}.*` : "*";
        const patternFields = convertPropertyToLuqDSL(
          pattern,
          patternSchema,
          patternPath,
          resolvedSchema,
          rootSchema
        );
        fields.push(...patternFields);
      }
    }
  }
  
  return fields;
};

/**
 * Convert a single property to Luq DSL
 */
const convertPropertyToLuqDSL = (
  propertyName: string,
  propertySchema: JSONSchema7,
  propertyPath: string,
  parentSchema: JSONSchema7,
  rootSchema?: JSONSchema7
): LuqFieldDSL[] => {
  const fields: LuqFieldDSL[] = [];
  const resolvedSchema = propertySchema.$ref && rootSchema ? 
    resolveSchemaRef(propertySchema, rootSchema) : propertySchema;
  
  // Handle multiple types
  const { type, nullable, multipleTypes } = processSchemaTypes(resolvedSchema);
  
  // Extract constraints
  const constraints = extractConstraints(resolvedSchema, parentSchema, propertyName);
  
  // Create field DSL
  const fieldDSL: LuqFieldDSL = {
    path: propertyPath,
    type,
    nullable,
    multipleTypes,
    constraints
  };
  
  fields.push(fieldDSL);
  
  // Handle nested objects
  if (resolvedSchema.type === "object" || (Array.isArray(resolvedSchema.type) && resolvedSchema.type.includes("object"))) {
    if (resolvedSchema.properties) {
      for (const [nestedName, nestedSchema] of Object.entries(resolvedSchema.properties)) {
        if (typeof nestedSchema === 'object') {
          const nestedPath = `${propertyPath}.${nestedName}`;
          const nestedFields = convertPropertyToLuqDSL(
            nestedName,
            nestedSchema,
            nestedPath,
            resolvedSchema,
            rootSchema
          );
          fields.push(...nestedFields);
        }
      }
    }
  }
  
  // Handle array items
  if (resolvedSchema.type === "array" || (Array.isArray(resolvedSchema.type) && resolvedSchema.type.includes("array"))) {
    if (resolvedSchema.items && !Array.isArray(resolvedSchema.items) && typeof resolvedSchema.items === 'object') {
      const itemPath = `${propertyPath}[*]`;
      const itemFields = convertPropertyToLuqDSL(
        `${propertyName}[*]`,
        resolvedSchema.items,
        itemPath,
        resolvedSchema,
        rootSchema
      );
      fields.push(...itemFields);
    }
  }
  
  return fields;
};

/**
 * Process schema types to determine type, nullable, and multipleTypes
 */
const processSchemaTypes = (schema: JSONSchema7) => {
  let type: LuqFieldDSL['type'] = "string";
  let nullable = false;
  let multipleTypes: string[] | undefined;
  
  if (schema.type) {
    if (Array.isArray(schema.type)) {
      // Handle multiple types
      const types = schema.type.filter(t => t !== "null");
      const hasNull = schema.type.includes("null");
      
      if (hasNull) {
        nullable = true;
      }
      
      if (types.length === 1) {
        type = mapJsonSchemaType(types[0]);
      } else if (types.length > 1) {
        type = mapJsonSchemaType(types[0]); // Primary type
        multipleTypes = types.map(mapJsonSchemaType);
      }
    } else {
      type = mapJsonSchemaType(schema.type);
    }
  } else if (schema.enum) {
    // Infer type from enum values
    type = inferTypeFromEnum(schema.enum);
  } else if (schema.const !== undefined) {
    // Infer type from const value
    type = inferTypeFromValue(schema.const);
  }
  
  return { type, nullable, multipleTypes };
};

/**
 * Map JSON Schema type to Luq DSL type
 */
const mapJsonSchemaType = (jsonType: string): LuqFieldDSL['type'] => {
  switch (jsonType) {
    case "string": return "string";
    case "number": return "number";
    case "integer": return "number"; // integer is a subtype of number in Luq
    case "boolean": return "boolean";
    case "array": return "array";
    case "object": return "object";
    case "null": return "null";
    default: return "string"; // fallback
  }
};

/**
 * Infer type from enum values
 */
const inferTypeFromEnum = (enumValues: any[]): LuqFieldDSL['type'] => {
  if (enumValues.length === 0) return "string";
  
  const firstValue = enumValues[0];
  if (typeof firstValue === "string") return "string";
  if (typeof firstValue === "number") return "number";
  if (typeof firstValue === "boolean") return "boolean";
  if (Array.isArray(firstValue)) return "array";
  if (typeof firstValue === "object" && firstValue !== null) return "object";
  
  return "string";
};

/**
 * Infer type from const value
 */
const inferTypeFromValue = (value: any): LuqFieldDSL['type'] => {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object" && value !== null) return "object";
  if (value === null) return "null";
  
  return "string";
};

/**
 * Extract root-level constraints from object schema
 */
const extractRootConstraints = (schema: JSONSchema7): LuqConstraints => {
  const constraints: LuqConstraints = {};
  
  if (schema.additionalProperties !== undefined) {
    constraints.additionalProperties = schema.additionalProperties;
  }
  
  if (schema.propertyNames) {
    constraints.propertyNames = schema.propertyNames as JSONSchema7;
  }
  
  if (schema.minProperties !== undefined) {
    constraints.minProperties = schema.minProperties;
  }
  
  if (schema.maxProperties !== undefined) {
    constraints.maxProperties = schema.maxProperties;
  }
  
  if (schema.patternProperties) {
    constraints.patternProperties = schema.patternProperties;
  }
  
  // dependentRequired is from JSON Schema draft-2019-09, not available in draft-07
  // We can access it through type assertion if needed
  if ((schema as any).dependentRequired) {
    constraints.dependentRequired = (schema as any).dependentRequired;
  }
  
  return constraints;
};

/**
 * Extract constraints from schema
 */
const extractConstraints = (
  schema: JSONSchema7,
  parentSchema: JSONSchema7,
  propertyName: string
): LuqConstraints => {
  const constraints: LuqConstraints = {};
  
  // Required constraint
  if (parentSchema.required && parentSchema.required.includes(propertyName)) {
    constraints.required = true;
  }
  
  // String constraints
  if (schema.minLength !== undefined) constraints.minLength = schema.minLength;
  if (schema.maxLength !== undefined) constraints.maxLength = schema.maxLength;
  if (schema.pattern) constraints.pattern = schema.pattern;
  if (schema.format) constraints.format = schema.format;
  if (schema.contentEncoding) constraints.contentEncoding = schema.contentEncoding;
  if (schema.contentMediaType) constraints.contentMediaType = schema.contentMediaType;
  
  // Number constraints
  if (schema.minimum !== undefined) constraints.min = schema.minimum;
  if (schema.maximum !== undefined) constraints.max = schema.maximum;
  if (schema.exclusiveMinimum !== undefined) {
    if (typeof schema.exclusiveMinimum === 'number') {
      constraints.min = schema.exclusiveMinimum;
      constraints.exclusiveMin = true;
    } else {
      constraints.exclusiveMin = schema.exclusiveMinimum;
    }
  }
  if (schema.exclusiveMaximum !== undefined) {
    if (typeof schema.exclusiveMaximum === 'number') {
      constraints.max = schema.exclusiveMaximum;
      constraints.exclusiveMax = true;
    } else {
      constraints.exclusiveMax = schema.exclusiveMaximum;
    }
  }
  if (schema.multipleOf !== undefined) {
    // Convert to custom validation since Luq doesn't have native multipleOf
    constraints.multipleOf = schema.multipleOf;
  }
  
  // Track integer type
  if (schema.type === "integer" || (Array.isArray(schema.type) && schema.type.includes("integer"))) {
    constraints.integer = true;
  }
  
  // Array constraints
  if (schema.minItems !== undefined) constraints.minItems = schema.minItems;
  if (schema.maxItems !== undefined) constraints.maxItems = schema.maxItems;
  if (schema.uniqueItems) constraints.uniqueItems = schema.uniqueItems;
  if (schema.items) constraints.items = schema.items as JSONSchema7 | JSONSchema7[];
  if (schema.contains) constraints.contains = schema.contains as JSONSchema7;
  
  // Object constraints
  if (schema.minProperties !== undefined) constraints.minProperties = schema.minProperties;
  if (schema.maxProperties !== undefined) constraints.maxProperties = schema.maxProperties;
  if (schema.additionalProperties !== undefined) constraints.additionalProperties = schema.additionalProperties;
  if (schema.propertyNames) constraints.propertyNames = schema.propertyNames as JSONSchema7;
  if (schema.patternProperties) constraints.patternProperties = schema.patternProperties;
  
  // Value constraints
  if (schema.enum) constraints.enum = schema.enum;
  if (schema.const !== undefined) constraints.const = schema.const;
  
  // Schema composition
  if (schema.allOf) constraints.allOf = schema.allOf as JSONSchema7[];
  if (schema.anyOf) constraints.anyOf = schema.anyOf as JSONSchema7[];
  if (schema.oneOf) constraints.oneOf = schema.oneOf as JSONSchema7[];
  if (schema.not) constraints.not = schema.not as JSONSchema7;
  
  // Conditional validation
  if (schema.if) constraints.if = schema.if as JSONSchema7;
  if (schema.then) constraints.then = schema.then as JSONSchema7;
  if (schema.else) constraints.else = schema.else as JSONSchema7;
  
  return constraints;
};

/**
 * Convert DSL field definition to builder function
 */
export const convertDSLToFieldDefinition = (
  dsl: LuqFieldDSL,
  customFormats?: Record<string, (value: any) => boolean>
): (builder: any) => any => {
  return (builder: any) => {
    let chain = builder;
    
    // Handle multiple types first
    if (dsl.multipleTypes && dsl.multipleTypes.length > 1) {
      const typeSchemas = dsl.multipleTypes.map(type => ({
        type,
        constraints: filterConstraintsForType(dsl.constraints, type)
      }));
      
      return builder.oneOf(typeSchemas.map(schema => (b: any) => 
        applyTypeAndConstraints(b, schema.type, schema.constraints, customFormats)
      ));
    }
    
    // Apply base type
    chain = applyBaseType(chain, dsl.type);
    
    // Apply nullable
    if (dsl.nullable) {
      chain = chain.nullable();
    }
    
    // Apply constraints
    chain = applyConstraints(chain, dsl.constraints, customFormats);
    
    return chain;
  };
};

/**
 * Apply base type to builder chain
 */
export const applyBaseType = (chain: any, type: LuqFieldDSL['type']): any => {
  switch (type) {
    case "string": return chain.string || chain;
    case "number": return chain.number || chain;
    case "boolean": return chain.boolean || chain;
    case "array": return chain.array || chain;
    case "object": return chain.object || chain;
    case "date": return chain.date || chain;
    case "null": return chain.literal(null);
    default: return chain;
  }
};

/**
 * Apply type and constraints to builder
 */
const applyTypeAndConstraints = (
  builder: any,
  type: string,
  constraints: LuqConstraints,
  customFormats?: Record<string, (value: any) => boolean>
): any => {
  let chain = applyBaseType(builder, type as LuqFieldDSL['type']);
  return applyConstraints(chain, constraints, customFormats);
};

/**
 * Filter constraints that apply to a specific type
 */
const filterConstraintsForType = (constraints: LuqConstraints, type: string): LuqConstraints => {
  const filtered: LuqConstraints = {};
  
  // String-specific constraints
  if (type === "string") {
    if (constraints.minLength !== undefined) filtered.minLength = constraints.minLength;
    if (constraints.maxLength !== undefined) filtered.maxLength = constraints.maxLength;
    if (constraints.pattern) filtered.pattern = constraints.pattern;
    if (constraints.format) filtered.format = constraints.format;
  }
  
  // Number-specific constraints
  if (type === "number" || type === "integer") {
    if (constraints.min !== undefined) filtered.min = constraints.min;
    if (constraints.max !== undefined) filtered.max = constraints.max;
    if (constraints.exclusiveMin !== undefined) filtered.exclusiveMin = constraints.exclusiveMin;
    if (constraints.exclusiveMax !== undefined) filtered.exclusiveMax = constraints.exclusiveMax;
  }
  
  // Array-specific constraints
  if (type === "array") {
    if (constraints.minItems !== undefined) filtered.minItems = constraints.minItems;
    if (constraints.maxItems !== undefined) filtered.maxItems = constraints.maxItems;
    if (constraints.uniqueItems) filtered.uniqueItems = constraints.uniqueItems;
    if (constraints.items) filtered.items = constraints.items;
  }
  
  // Common constraints
  if (constraints.enum) filtered.enum = constraints.enum;
  if (constraints.const !== undefined) filtered.const = constraints.const;
  if (constraints.required !== undefined) filtered.required = constraints.required;
  
  return filtered;
};

/**
 * Apply constraints to builder chain
 */
export const applyConstraints = (
  chain: any,
  constraints: LuqConstraints,
  customFormats?: Record<string, (value: any) => boolean>
): any => {
  // Handle literal values first
  if (constraints.const !== undefined) {
    return chain.literal ? chain.literal(constraints.const) : chain;
  }
  
  // String constraints
  if (constraints.minLength !== undefined && chain.min) {
    chain = chain.min(constraints.minLength);
  }
  if (constraints.maxLength !== undefined && chain.max) {
    chain = chain.max(constraints.maxLength);
  }
  if (constraints.pattern && chain.pattern) {
    chain = chain.pattern(constraints.pattern);
  }
  
  // Format handling
  if (constraints.format) {
    if (customFormats && customFormats[constraints.format]) {
      if (chain.refine) {
        chain = chain.refine(customFormats[constraints.format]);
      }
    } else {
      // Built-in format methods
      switch (constraints.format) {
        case "email":
          chain = chain.email ? chain.email() : chain;
          break;
        case "uri":
        case "url":
          chain = chain.url ? chain.url() : chain;
          break;
        case "uuid":
          chain = chain.uuid ? chain.uuid() : chain;
          break;
        case "date-time":
        case "datetime":
          chain = chain.datetime ? chain.datetime() : chain;
          break;
      }
    }
  }
  
  // Number constraints
  if (constraints.min !== undefined && chain.min) {
    const exclusive = constraints.exclusiveMin === true || typeof constraints.exclusiveMin === 'number';
    if (constraints.exclusiveMin !== undefined) {
      if (exclusive) {
        chain = chain.min(constraints.min, { exclusive: true });
      } else {
        chain = chain.min(constraints.min, { exclusive: false });
      }
    } else {
      chain = chain.min(constraints.min);
    }
  }
  if (constraints.max !== undefined && chain.max) {
    const exclusive = constraints.exclusiveMax === true || typeof constraints.exclusiveMax === 'number';
    if (constraints.exclusiveMax !== undefined) {
      if (exclusive) {
        chain = chain.max(constraints.max, { exclusive: true });
      } else {
        chain = chain.max(constraints.max);
      }
    } else {
      chain = chain.max(constraints.max);
    }
  }
  if (constraints.multipleOf !== undefined && chain.multipleOf) {
    chain = chain.multipleOf(constraints.multipleOf);
  }
  
  // Array constraints
  if (constraints.items && Array.isArray(constraints.items)) {
    // Tuple validation
    if (chain.tupleBuilder) {
      return chain.tupleBuilder(constraints.items);
    }
  }
  if (constraints.minItems !== undefined && chain.minItems) {
    chain = chain.minItems(constraints.minItems);
  }
  if (constraints.maxItems !== undefined && chain.maxItems) {
    chain = chain.maxItems(constraints.maxItems);
  }
  if (constraints.uniqueItems && chain.unique) {
    chain = chain.unique();
  }
  
  // Object constraints
  if (constraints.minProperties !== undefined && chain.minProperties) {
    chain = chain.minProperties(constraints.minProperties);
  }
  if (constraints.maxProperties !== undefined && chain.maxProperties) {
    chain = chain.maxProperties(constraints.maxProperties);
  }
  if (constraints.additionalProperties !== undefined && chain.additionalProperties) {
    chain = chain.additionalProperties(constraints.additionalProperties);
  }
  if (constraints.propertyNames && chain.propertyNames) {
    chain = chain.propertyNames(constraints.propertyNames);
  }
  
  // Schema composition
  if (constraints.allOf && chain.custom) {
    chain = chain.custom((value: any) => {
      return constraints.allOf!.every(schema => 
        validateValueAgainstSchema(value, schema as JSONSchema7)
      );
    });
  }
  
  if (constraints.anyOf && chain.custom) {
    chain = chain.custom((value: any) => {
      return constraints.anyOf!.some(schema => 
        validateValueAgainstSchema(value, schema as JSONSchema7)
      );
    });
  }
  
  if (constraints.oneOf && chain.custom) {
    chain = chain.custom((value: any) => {
      const validCount = constraints.oneOf!.filter(schema => 
        validateValueAgainstSchema(value, schema as JSONSchema7)
      ).length;
      return validCount === 1;
    });
  }
  
  // Required constraint
  if (constraints.required && chain.required) {
    chain = chain.required();
  }
  
  return chain;
};