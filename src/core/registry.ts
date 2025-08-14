/**
 * Luq Registry - Plugin registry functionality
 * 
 * This entry point exports the plugin registry system.
 */

export { 
  createPluginRegistry,
  type PluginRegistry,
  type FieldRule,
  type ExtractFieldRuleType,
  type FieldRuleDefinition,
  type TypedPluginRegistry
} from "./registry/plugin-registry";