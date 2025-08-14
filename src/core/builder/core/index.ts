/**
 * Builder module exports
 *
 * This module contains all the core functionality for creating and managing plugins
 */

// Export builder
export { Builder } from "./builder";

// Export plugin interfaces
export {
  PluginValidationResult as BasicValidationResult,
  StandardPluginImplementation,
  ConditionalPluginImplementation,
  TransformPluginImplementation,
  FieldReferencePluginImplementation,
  ArrayElementPluginImplementation,
} from "../plugins/plugin-interfaces";

// Export from plugin-creator
export {
  plugin,
  PluginImplementation,
  pluginPredefinedTransform,
  pluginConfigurableTransform,
} from "../plugins/plugin-creator";

// Export field builder types
export * from "../plugins/plugin-types";
export { FieldBuilder, createFieldBuilderImpl } from "./field-builder";
export {
  createFieldContext,
  createOptimizedFieldContext,
} from "../context/field-context";

// Export composable plugin
export {
  createComposablePlugin,
  attachComposablePlugin,
  createValidator,
  createValidatorResult,
  createSingleValidatorResult,
  createCompositionBuilder,
  mergeValidatorResults,
  VALID_RESULT,
  INVALID_RESULT,
} from "../plugins/composable-plugin";
export type {
  ComposablePlugin,
  ComposableValidatorResult,
  ValidatorDefinition,
  TransformFunction,
  CompositionBuilder,
} from "../plugins/composable-plugin";

// Export composable-conditional plugin
export { createComposableConditionalPlugin } from "../plugins/composable-conditional-plugin";
export type { ComposableConditionalPlugin } from "../plugins/composable-conditional-plugin";

// Export composable-directly plugin
export { createComposableDirectlyPlugin } from "../plugins/composable-directly-plugin";
export type { ComposableDirectlyPlugin } from "../plugins/composable-directly-plugin";
