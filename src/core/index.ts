/**
 * Luq Core - Plugin-based validation library core
 *
 * This module provides only minimal core functionality.
 * Add specific validation features as plugins.
 */

// Export new chainable builder system
export { Builder } from "./builder/core/builder";

// Export plugin registry system
export { 
  createPluginRegistry,
  type PluginRegistry,
  type FieldRule,
  type ExtractFieldRuleType,
  type FieldRuleDefinition
} from "./registry/plugin-registry";

// Export types from builder
export {
  type FieldBuilder,
  type TransformAwareValidator,
  type ApplyFieldTransforms,
  type ExtractFieldType,
} from "./builder/plugins/plugin-types";

// Export ValidationResult from builder as the primary one
export { ValidationResult } from "./builder/plugins/plugin-types";

// Export other types from plugin/types
export {
  type ValidationOptions,
  type MessageContext,
  type SEVERITY,
} from "./plugin/types";

// Export only plugins used in benchmarks (for optimal tree-shaking)
export { requiredPlugin } from "./plugin/required";
export { optionalPlugin } from "./plugin/optional";

// String plugins (used in benchmarks)
export { stringMinPlugin } from "./plugin/stringMin";
export { stringMaxPlugin } from "./plugin/stringMax";
export { stringEmailPlugin } from "./plugin/stringEmail";
export { stringPatternPlugin } from "./plugin/stringPattern";

// Number plugins (used in benchmarks)
export { numberMinPlugin } from "./plugin/numberMin";
export { numberMaxPlugin } from "./plugin/numberMax";
export { numberPositivePlugin } from "./plugin/numberPositive";
export { numberIntegerPlugin } from "./plugin/numberInteger";

// Boolean plugins (used in benchmarks)
export { booleanTruthyPlugin } from "./plugin/booleanTruthy";
export { booleanFalsyPlugin } from "./plugin/booleanFalsy";

// Array plugins (used in benchmarks)
export { arrayMinLengthPlugin } from "./plugin/arrayMinLength";
export { arrayMaxLengthPlugin } from "./plugin/arrayMaxLength";
export { arrayUniquePlugin } from "./plugin/arrayUnique";

// Object plugins (used in benchmarks)
export { objectPlugin } from "./plugin/object";

// Common plugins (used in benchmarks)
export { oneOfPlugin } from "./plugin/oneOf";
export { literalPlugin } from "./plugin/literal";
export { compareFieldPlugin } from "./plugin/compareField";

// Transform plugin (used in benchmarks)
export { transformPlugin } from "./plugin/transform";

// Conditional plugins (used in benchmarks)
export { requiredIfPlugin } from "./plugin/requiredIf";
export { validateIfPlugin } from "./plugin/validateIf";
export { skipPlugin } from "./plugin/skip";

// GlobalConfig
export {
  GlobalConfig,
  globalConfig,
  setGlobalConfig,
  getGlobalConfig,
  resetGlobalConfig,
} from "./global-config";

// JsonSchema plugin
export { jsonSchemaPlugin } from "./plugin/jsonSchema";
