// Core exports only (no plugins)
export { Builder } from "./src/core/builder/core/builder";
export { createPluginRegistry } from "./src/core/registry/plugin-registry";
export type { 
  PluginRegistry,
  FieldRule,
  ExtractFieldRuleType,
  FieldRuleDefinition 
} from "./src/core/registry/plugin-registry";
export type {
  FieldBuilder,
  TransformAwareValidator,
  ApplyFieldTransforms,
  ExtractFieldType,
  TypedPlugin,
  PluginType,
  PluginCategory,
  TypeName,
  BuilderExtensionPlugin,
  BuilderExtensionMethod,
} from "./src/core/builder/plugins/plugin-types";
export { ValidationResult } from "./src/core/builder/plugins/plugin-types";
export type {
  ValidationOptions,
  MessageContext,
  SEVERITY,
} from "./src/core/plugin/types";
export type {
  PluginValidationResult as BasicValidationResult,
  StandardPluginImplementation,
  ConditionalPluginImplementation,
  TransformPluginImplementation,
  FieldReferencePluginImplementation,
  ArrayElementPluginImplementation,
} from "./src/core/builder/plugins/plugin-interfaces";
export {
  plugin,
  pluginPredefinedTransform,
  pluginConfigurableTransform,
  pluginBuilderExtension,
} from "./src/core/builder/plugins/plugin-creator";
export type { PluginImplementation } from "./src/core/builder/plugins/plugin-creator";
export { Result } from "./src/types/result";
export {
  GlobalConfig,
  globalConfig,
  setGlobalConfig,
  getGlobalConfig,
  resetGlobalConfig,
} from "./src/core/global-config";