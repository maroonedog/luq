/**
 * Composable Conditional Plugin Pattern - For guard-like conditional validation
 *
 * This module provides utilities for creating composable plugins that apply
 * conditional validation based on type guards or conditions. This is specifically
 * designed for union type validation where different rules apply based on the value type.
 */

import type { TypeName } from "../plugins/plugin-types";
import {
  createComposablePlugin,
  type ComposableValidatorResult,
} from "../plugins/composable-plugin";

/**
 * Interface for Composable Conditional Plugin
 */
export interface ComposableConditionalPlugin<
  TName extends string,
  TMethodName extends string,
  TAllowedTypes extends readonly TypeName[],
> {
  name: TName;
  methodName: TMethodName;
  allowedTypes: TAllowedTypes;
  category: "composable-conditional";

  /**
   * Create a Composer that accumulates conditional validations
   */
  createComposer<TPlugins>(
    fieldPath: string,
    plugins: TPlugins
  ): any;
}

/**
 * Creates a composable conditional plugin for guard-based validation
 * 
 * @param name - The unique name of the plugin
 * @param methodName - The method name that will be added to the field builder
 * @param allowedTypes - Array of type names this plugin can be applied to
 * @param builderFn - Function that builds validators from accumulated conditions
 * @returns A composable conditional plugin instance
 */
export function createComposableConditionalPlugin<
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
): ComposableConditionalPlugin<TName, TMethodName, TAllowedTypes> {
  // Reuse the composable plugin implementation but with different category
  const basePlugin = createComposablePlugin(
    name,
    methodName,
    allowedTypes,
    builderFn
  );

  return {
    ...basePlugin,
    category: "composable-conditional" as const,
  };
}