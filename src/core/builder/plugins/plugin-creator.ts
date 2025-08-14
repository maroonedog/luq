import { TypedPlugin, TypeName, PluginCategory, BuilderExtensionPlugin, BuilderExtensionMethod } from "../plugins/plugin-types";
import { PluginImplementation } from "../types/types";
import {
  PredefinedTransformImplementation,
  ConfigurableTransformImplementation,
} from "../plugins/plugin-interfaces";

/**
 * Plugin Creator with Type-Safe Interfaces (Optimized)
 *
 * This module provides an intuitive API for creating plugins
 * with proper type guidance and IntelliSense support.
 * Optimized for smaller bundle size while maintaining the same interface.
 */

// Re-export types from types.ts
export type { PluginImplementation, PluginDefinition } from "../types/types";

/**
 * Chain method creator based on category
 */
/**
 * Helper type to inject pluginName into ValidatorFormat
 */
type WithPluginName<T> = T extends (...args: any[]) => infer R
  ? R extends { check: any; code: string }
    ? (...args: Parameters<T>) => R & { pluginName: string }
    : T
  : T;
const createImpl = <TCategory extends PluginCategory, TImpl extends Function>(
  category: TCategory,
  methodName: string,
  impl: TImpl,
  pluginName: string
): WithPluginName<TImpl> => {
  // Create a wrapper that automatically injects pluginName into the returned validation object
  const wrapImpl = (originalImpl: TImpl): TImpl => {
    return ((...args: any[]) => {
      const result = originalImpl(...args);
      // If the result is an object with validation properties, inject pluginName
      if (result && typeof result === "object" && "check" in result) {
        return {
          ...result,
          pluginName,
        };
      }
      return result;
    }) as unknown as WithPluginName<TImpl>;
  };

  const wrappedImpl = wrapImpl(impl);

  switch (category) {
    case "conditional":
      return ((
        condition: (allValues: any, arrayContext?: any) => boolean,
        ...args: any[]
      ) => wrappedImpl(condition, ...args)) as unknown as WithPluginName<TImpl>;
    case "fieldReference":
      return ((fieldPath: string, ...args: any[]) =>
        wrappedImpl(fieldPath, ...args)) as unknown as WithPluginName<TImpl>;
    case "multiFieldReference":
      // Preserve generic type parameters for multiFieldReference
      return wrappedImpl as WithPluginName<TImpl>;
    case "transform":
      return ((transformFn: (value: any) => any) =>
        wrappedImpl(transformFn)) as unknown as WithPluginName<TImpl>;
    case "arrayElement":
      return ((element: any, ...args: any[]) =>
        wrappedImpl(element, ...args)) as unknown as WithPluginName<TImpl>;
    case "context":
      return ((contextOptions: any) =>
        wrappedImpl(contextOptions)) as unknown as WithPluginName<TImpl>;
    default: // standard
      return wrappedImpl as WithPluginName<TImpl>;
  }
};

export function plugin<
  TPluginName extends string,
  TMethodName extends string,
  TTypes extends readonly TypeName[],
  TCategory extends PluginCategory,
  TImpl extends PluginImplementation<TCategory, TTypes>,
>(args: {
  name: TPluginName;
  methodName: TMethodName;
  allowedTypes: TTypes;
  category: TCategory;
  impl: TImpl;
}): TypedPlugin<
  TPluginName,
  TMethodName,
  TImpl,
  TTypes,
  "validator",
  TCategory
> {
  const { name, methodName, allowedTypes, category, impl } = args;
  return {
    name,
    methodName,
    allowedTypes,
    category,
    create: () => createImpl(category, methodName, impl, name), // Pass plugin name
  };
}

export function pluginPredefinedTransform<
  TName extends string,
  TTypes extends readonly TypeName[],
  TInput,
  TOutput,
>(args: {
  name: TName;
  allowedTypes: TTypes;
  impl: PredefinedTransformImplementation<TInput, TOutput>;
}): TypedPlugin<TName, TName, () => any, TTypes, "transform", "transform"> {
  const { name, allowedTypes, impl } = args;
  const fn = () => impl();
  return {
    name,
    methodName: name,
    allowedTypes,
    category: "transform",
    create: () => fn,
  };
}

export function pluginConfigurableTransform<
  TName extends string,
  TTypes extends readonly TypeName[],
  TConfig extends any[],
  TInput,
  TOutput,
>(args: {
  name: TName;
  allowedTypes: TTypes;
  impl: ConfigurableTransformImplementation<TConfig, TInput, TOutput>;
}): TypedPlugin<
  TName,
  TName,
  (...args: TConfig) => any,
  TTypes,
  "transform",
  "transform"
> {
  const { name, allowedTypes, impl } = args;
  const fn = (...config: TConfig) => impl(...config);
  return {
    name,
    methodName: name,
    allowedTypes,
    category: "transform",
    create: () => fn,
  };
}

/**
 * Builder extension plugin factory function
 * Creates a plugin that extends the builder with additional methods
 */
export function pluginBuilderExtension<
  TName extends string,
  TMethodName extends string,
  TMethodSignature extends BuilderExtensionMethod = BuilderExtensionMethod,
>(args: {
  name: TName;
  methodName: TMethodName;
  impl: () => TMethodSignature;
  extendBuilder: (builderInstance: any) => void;
}): BuilderExtensionPlugin<TName, TMethodName, TMethodSignature> {
  const { name, methodName, impl, extendBuilder } = args;
  return {
    name,
    methodName,
    category: "builder-extension" as const,
    impl: impl(),
    extendBuilder,
  };
}
