/**
 * JsonSchema Plugin - Main Entry Point
 * Modular JSON Schema to Luq validator conversion
 */

export { LuqFieldDSL, LuqConstraints, JsonSchemaOptions, ValidationError } from "./types";
export { resolveRef, resolveSchemaRef, resolveAllRefs } from "./ref-resolver";
export { formatValidators, validateFormat, getSupportedFormats, isFormatSupported } from "./format-validators";
export { 
  validateValueAgainstSchema, 
  validateType, 
  validateMultipleTypes,
  validateStringConstraints,
  validateNumberConstraints,
  validateArrayConstraints,
  validateObjectConstraints
} from "./validation-core";
export { getDetailedValidationErrors, getSpecificValidationErrors } from "./error-generation";
export { 
  convertJsonSchemaToLuqDSL, 
  convertDSLToFieldDefinition,
  applyConstraints,
  applyBaseType,
  applyBaseType as getBaseChain
} from "./dsl-converter";

// Re-export the main plugin
export { jsonSchemaPlugin } from "./plugin";