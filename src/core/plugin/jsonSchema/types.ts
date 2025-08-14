import type { JSONSchema7 } from "json-schema";

/**
 * DSL representation for field definitions
 * Extracted from main jsonSchema.ts for better testability
 */
export interface LuqFieldDSL {
  path: string;
  type: "string" | "number" | "boolean" | "date" | "array" | "object" | "null" | "tuple";
  nullable?: boolean; // Whether to allow null type
  multipleTypes?: string[]; // Support for multiple types
  allowedProperties?: string[]; // For additionalProperties validation
  constraints: LuqConstraints;
}

export interface LuqConstraints {
  required?: boolean;
  min?: number;
  max?: number;
  exclusiveMin?: number | boolean;
  exclusiveMax?: number | boolean;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  contentEncoding?: string;
  contentMediaType?: string;
  enum?: any[];
  const?: any;
  integer?: boolean; // Track if the original type was integer
  items?: JSONSchema7 | JSONSchema7[]; // Support both single schema and tuple
  contains?: JSONSchema7; // Array contains constraint
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  additionalProperties?: boolean | JSONSchema7;
  propertyNames?: JSONSchema7; // Object property names constraint
  patternProperties?: Record<string, any>; // Pattern-based property validation
  dependentRequired?: Record<string, string[]>; // Dependent required fields
  minProperties?: number;
  maxProperties?: number;
  // Schema composition
  allOf?: JSONSchema7[];
  anyOf?: JSONSchema7[];
  oneOf?: JSONSchema7[];
  not?: JSONSchema7;
  // Conditional
  if?: JSONSchema7;
  then?: JSONSchema7;
  else?: JSONSchema7;
  // Custom conditional validation (for parent schemas)
  conditionalValidation?: {
    if: JSONSchema7;
    then?: JSONSchema7;
    else?: JSONSchema7;
  };
  // RequiredIf constraint for conditionally required fields
  requiredIf?: {
    condition: JSONSchema7;
    parentPath: string;
  };
}

export interface JsonSchemaOptions {
  strictRequired?: boolean;
  allowAdditionalProperties?: boolean;
  customFormats?: Record<string, (value: any) => boolean>;
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
  value?: any;
  constraint?: any;
}