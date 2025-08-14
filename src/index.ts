/**
 * Luq - TypeScript validation library
 *
 * Single entry point for all Luq functionality.
 * This file exports everything from the library.
 */

// ============================================
// Core Builder and Types
// ============================================

// Export the main Builder
export { Builder } from "./core/builder/core/builder";

// Export plugin registry system
export { 
  createPluginRegistry,
  type PluginRegistry,
  type FieldRule,
  type ExtractFieldRuleType,
  type FieldRuleDefinition
} from "./core/registry/plugin-registry";

// Export field builder and validation types
export {
  type FieldBuilder,
  type TransformAwareValidator,
  type ApplyFieldTransforms,
  type ExtractFieldType,
  type TypedPlugin,
  type PluginType,
  type PluginCategory,
  type TypeName,
  type BuilderExtensionPlugin,
  type BuilderExtensionMethod,
} from "./core/builder/plugins/plugin-types";

// Export ValidationResult
export { ValidationResult } from "./core/builder/plugins/plugin-types";

// Export validation options and context
export {
  type ValidationOptions,
  type MessageContext,
  type SEVERITY,
} from "./core/plugin/types";

// Export plugin interfaces
export {
  type PluginValidationResult as BasicValidationResult,
  type StandardPluginImplementation,
  type ConditionalPluginImplementation,
  type TransformPluginImplementation,
  type FieldReferencePluginImplementation,
  type ArrayElementPluginImplementation,
} from "./core/builder/plugins/plugin-interfaces";

// Export plugin creator functions
export {
  plugin,
  type PluginImplementation,
  pluginPredefinedTransform,
  pluginConfigurableTransform,
  pluginBuilderExtension,
} from "./core/builder/plugins/plugin-creator";

// Export Result type
export { Result } from "./types/result";

// Export GlobalConfig
export {
  GlobalConfig,
  globalConfig,
  setGlobalConfig,
  getGlobalConfig,
  resetGlobalConfig,
} from "./core/global-config";

// ============================================
// All Plugins
// ============================================

// Core validation plugins
export { requiredPlugin } from "./core/plugin/required";
export { optionalPlugin } from "./core/plugin/optional";
export { nullablePlugin } from "./core/plugin/nullable";

// String validation plugins
export { stringMinPlugin } from "./core/plugin/stringMin";
export { stringMaxPlugin } from "./core/plugin/stringMax";
export { stringEmailPlugin } from "./core/plugin/stringEmail";
export { stringPatternPlugin } from "./core/plugin/stringPattern";
export { stringUrlPlugin } from "./core/plugin/stringUrl";
export { stringDatePlugin } from "./core/plugin/stringDate";
export { stringDatetimePlugin } from "./core/plugin/stringDatetime";
export { stringTimePlugin } from "./core/plugin/stringTime";
export { stringIpv4Plugin } from "./core/plugin/stringIpv4";
export { stringIpv6Plugin } from "./core/plugin/stringIpv6";
export { stringHostnamePlugin } from "./core/plugin/stringHostname";
export { stringDurationPlugin } from "./core/plugin/stringDuration";
export { stringBase64Plugin } from "./core/plugin/stringBase64";
export { stringJsonPointerPlugin } from "./core/plugin/stringJsonPointer";
export { stringRelativeJsonPointerPlugin } from "./core/plugin/stringRelativeJsonPointer";
export { stringIriPlugin } from "./core/plugin/stringIri";
export { stringIriReferencePlugin } from "./core/plugin/stringIriReference";
export { stringUriTemplatePlugin } from "./core/plugin/stringUriTemplate";
export { stringContentEncodingPlugin } from "./core/plugin/stringContentEncoding";
export { stringContentMediaTypePlugin } from "./core/plugin/stringContentMediaType";
export { uuidPlugin } from "./core/plugin/uuid";

// Number validation plugins
export { numberMinPlugin } from "./core/plugin/numberMin";
export { numberMaxPlugin } from "./core/plugin/numberMax";
export { numberPositivePlugin } from "./core/plugin/numberPositive";
export { numberNegativePlugin } from "./core/plugin/numberNegative";
export { numberIntegerPlugin } from "./core/plugin/numberInteger";
export { numberMultipleOfPlugin } from "./core/plugin/numberMultipleOf";

// Boolean validation plugins
export { booleanTruthyPlugin } from "./core/plugin/booleanTruthy";
export { booleanFalsyPlugin } from "./core/plugin/booleanFalsy";

// Array validation plugins
export { arrayMinLengthPlugin } from "./core/plugin/arrayMinLength";
export { arrayMaxLengthPlugin } from "./core/plugin/arrayMaxLength";
export { arrayUniquePlugin } from "./core/plugin/arrayUnique";
export { arrayIncludesPlugin } from "./core/plugin/arrayIncludes";
export { arrayContainsPlugin } from "./core/plugin/arrayContains";

// Object validation plugins
export { objectPlugin } from "./core/plugin/object";
export { objectMinPropertiesPlugin } from "./core/plugin/objectMinProperties";
export { objectMaxPropertiesPlugin } from "./core/plugin/objectMaxProperties";
export { objectAdditionalPropertiesPlugin } from "./core/plugin/objectAdditionalProperties";
export { objectPropertyNamesPlugin } from "./core/plugin/objectPropertyNames";
export { objectPatternPropertiesPlugin } from "./core/plugin/objectPatternProperties";
export { objectDependentRequiredPlugin } from "./core/plugin/objectDependentRequired";
export { objectDependentSchemasPlugin } from "./core/plugin/objectDependentSchemas";

// Value validation plugins
export { oneOfPlugin } from "./core/plugin/oneOf";
export { literalPlugin } from "./core/plugin/literal";

// Field reference plugins
export { compareFieldPlugin } from "./core/plugin/compareField";

// Conditional plugins
export { requiredIfPlugin } from "./core/plugin/requiredIf";
export { validateIfPlugin } from "./core/plugin/validateIf";
export { skipPlugin } from "./core/plugin/skip";

// Transform plugin
export { transformPlugin } from "./core/plugin/transform";

// Tuple plugin
export { tupleBuilderPlugin } from "./core/plugin/tupleBuilder";

// Context plugins
export { readOnlyWriteOnlyPlugin } from "./core/plugin/readOnlyWriteOnly";
export { customPlugin } from "./core/plugin/custom";

// JSON Schema plugins
export { jsonSchemaPlugin } from "./core/plugin/jsonSchema";
export { jsonSchemaFullFeaturePlugin } from "./core/plugin/jsonSchemaFullFeature";