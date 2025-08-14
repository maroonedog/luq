/**
 * Enhanced integration with better type inference
 */

import { FieldBuilder, createFieldBuilderImpl } from "./field-builder";
import { IChainableBuilder, BuilderExtensions } from "../types/types";

// Re-export types from types.ts
export type {
  ChainableBuilder,
  IChainableBuilder,
  PluginMapFromArray,
  BuilderExtensions,
} from "../types/types";

/**
 * Alternative implementation with better type inference
 */
function createChainableBuilder<
  TInput,
  TPlugins = {},
  TExtensions extends object = {},
>(): IChainableBuilder<TInput, TPlugins, TExtensions> & TExtensions {
  const pluginMethods: Record<string, any> = {};

  const builder: any = {
    for<TInputType extends object>(): FieldBuilder<
      TInputType,
      unknown,
      TPlugins,
      never
    > {
      return createFieldBuilderImpl<TInputType, unknown, TPlugins, never>(
        pluginMethods as TPlugins,
        builder as any,
        undefined,
        false
      ) as any;
    },

    use(...args: any[]): any {
      // Handle both single and multiple plugins
      if (args.length === 0) {
        return builder;
      }

      // Process each plugin
      for (let i = 0; i < args.length; i++) {
        const plugin = args[i];

        // Skip null/undefined
        if (!plugin) {
          continue;
        }

        // Validate plugin structure
        if (typeof plugin !== "object" || !plugin.name) {
          console.error("Invalid plugin:", plugin);
          throw new Error(
            `Invalid plugin at index ${i}: plugin must be an object with a 'name' property`
          );
        }

        // Store the plugin with a unique key
        const key = plugin.name;
        if (pluginMethods[key]) {
          // Skip if already added (avoid duplicates)
          continue;
        }
        pluginMethods[key] = plugin;

        // Check if this is a builder extension plugin
        if (
          plugin.category === "builder-extension" &&
          plugin.extendBuilder &&
          typeof plugin.extendBuilder === "function"
        ) {
          // Add the method using methodName and impl
          if (plugin.methodName && plugin.impl) {
            (builder as any)[plugin.methodName] = plugin.impl;
          }
          
          // Apply any additional extensions
          plugin.extendBuilder(builder);

          // Verify the method was added
          if (
            plugin.methodName &&
            !(builder as any)[plugin.methodName]
          ) {
            console.warn(
              `BuilderExtensionPlugin ${plugin.name} did not add ${plugin.methodName} method`
            );
          }
        }
      }

      // Return builder with accumulated extensions
      // The type system should recognize this through the interface definition
      return builder;
    },
  };

  return builder as IChainableBuilder<TInput, TPlugins, TExtensions> &
    TExtensions;
}

/**
 * Factory function with better type inference
 */
function createBuilder<TInput = any>(): IChainableBuilder<TInput, {}, {}> {
  return createChainableBuilder<TInput, {}, {}>();
}

export const Builder = createBuilder;
