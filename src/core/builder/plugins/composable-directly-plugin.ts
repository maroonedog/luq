/**
 * Composable Directly Plugin Pattern - For direct builder composition
 *
 * This module provides utilities for creating composable plugins that directly
 * compose builders without conditional logic. This is specifically designed for
 * tuple validation where each element has its own builder.
 */

import type { TypeName } from "../plugins/plugin-types";
import {
  createComposablePlugin,
  type ComposableValidatorResult,
} from "../plugins/composable-plugin";

/**
 * Interface for Composable Directly Plugin
 */
export interface ComposableDirectlyPlugin<
  TName extends string,
  TMethodName extends string,
  TAllowedTypes extends readonly TypeName[],
> {
  name: TName;
  methodName: TMethodName;
  allowedTypes: TAllowedTypes;
  category: "composable-directly";

  /**
   * Create a Composer that directly builds validators
   */
  createComposer<TPlugins>(
    fieldPath: string,
    plugins: TPlugins
  ): any;
}

/**
 * Creates a composable directly plugin for direct builder composition
 * 
 * @param name - The unique name of the plugin
 * @param methodName - The method name that will be added to the field builder
 * @param allowedTypes - Array of type names this plugin can be applied to
 * @param builderFn - Function that builds validators from composed builders
 * @returns A composable directly plugin instance
 */
export function createComposableDirectlyPlugin<
  TName extends string,
  TMethodName extends string,
  TAllowedTypes extends readonly TypeName[],
  TComposition = unknown[],
>(
  name: TName,
  methodName: TMethodName,
  allowedTypes: TAllowedTypes,
  builderFn: <TPlugins>(
    compositions: TComposition[],
    fieldPath: string,
    plugins: TPlugins
  ) => ComposableValidatorResult
): ComposableDirectlyPlugin<TName, TMethodName, TAllowedTypes> {
  // Reuse the composable plugin implementation but with different category
  const basePlugin = createComposablePlugin(
    name,
    methodName,
    allowedTypes,
    builderFn
  );

  return {
    ...basePlugin,
    category: "composable-directly" as const,
  };
}