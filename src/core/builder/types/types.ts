/**
 * Consolidated Type Definitions for Builder Module
 *
 * This file contains type definitions from:
 * - nested-type-utils.ts
 * - types/validation-types.ts
 * - path-to-nested.ts
 */

// ========================================
// FROM: path-to-nested.ts
// ========================================

/**
 * Split a path string into segments
 */
type Split<S extends string> = S extends `${infer Head}.${infer Tail}`
  ? [Head, ...Split<Tail>]
  : [S];

/**
 * Check if a type is an array
 */
type IsArray<T> = T extends Array<any> ? true : false;

/**
 * Build nested object from path segments
 * This is used for simple paths without array consideration
 */
type BuildNested<Path extends string[], Value> = Path extends [
  infer Head,
  ...infer Tail,
]
  ? Head extends string
    ? Tail extends string[]
      ? Tail extends []
        ? { [K in Head]: Value }
        : { [K in Head]: BuildNested<Tail, Value> }
      : never
    : never
  : {};

/**
 * Convert a dotted path and value into a nested object type
 *
 * Examples:
 * PathToNested<"a.b.c", number> => { a: { b: { c: number } } }
 * PathToNested<"user.name", string> => { user: { name: string } }
 */
export type PathToNested<Path extends string, Value> = BuildNested<
  Split<Path>,
  Value
>;

/**
 * Deep merge two types
 * Arrays are replaced, not merged
 * Objects are recursively merged
 */
export type DeepMerge<T, U> = T extends any[]
  ? U extends any[]
    ? U
    : T
  : T extends object
    ? U extends object
      ? {
          [K in keyof T | keyof U]: K extends keyof U
            ? K extends keyof T
              ? T[K] extends any[]
                ? U[K] extends any[]
                  ? U[K]
                  : T[K]
                : T[K] extends object
                  ? U[K] extends object
                    ? DeepMerge<T[K], U[K]>
                    : U[K]
                  : U[K]
              : U[K]
            : K extends keyof T
              ? T[K]
              : never;
        }
      : T
    : U;

// Helper types for array path handling
type FirstKey<Path extends string> = Path extends `${infer Key}.${string}`
  ? Key
  : Path;

type RestPath<Path extends string> = Path extends `${string}.${infer Rest}`
  ? Rest
  : never;

// Build nested object type with array support
type BuildArrayTransform<
  ArrayKey extends string,
  RestPath extends string,
  Value,
> = {
  [K in ArrayKey]: Array<PathToNested<RestPath, Value>>;
};

/**
 * Build nested transformation for paths that include array access
 * Example: "users.0.name" -> { users: Array<{ name: Value }> }
 */
type ArrayPathToNested<Path extends string, Value, OriginalType = any> =
  FirstKey<Path> extends keyof OriginalType
    ? OriginalType[FirstKey<Path>] extends Array<any>
      ? BuildArrayTransform<FirstKey<Path>, RestPath<Path>, Value>
      : PathToNested<Path, Value>
    : PathToNested<Path, Value>;

/**
 * Check if a path references an array element
 */
type IsArrayPath<Path extends string, T = any> =
  FirstKey<Path> extends keyof T
    ? T[FirstKey<Path>] extends Array<any>
      ? RestPath<Path> extends never
        ? false
        : true
      : RestPath<Path> extends never
        ? false
        : IsArrayPath<RestPath<Path>, T[FirstKey<Path>]>
    : false;

// Main transform type that handles both simple and array paths
type CreateNestedFromPath<Path extends string, Value, OriginalType> =
  IsArrayPath<Path, OriginalType> extends true
    ? ArrayPathToNested<Path, Value, OriginalType>
    : PathToNested<Path, Value>;

/**
 * Convert a flat map of path-value pairs to a nested object type
 */
export type FlatMapToNested<TMap, OriginalType = any> =
  TMap extends Record<string, any>
    ? UnionToIntersection<
        {
          [K in keyof TMap & string]: CreateNestedFromPath<
            K,
            TMap[K],
            OriginalType
          >;
        }[keyof TMap & string]
      >
    : {};

// Union to intersection utility
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

// ========================================
// FROM: nested-type-utils.ts
// ========================================

/**
 * Apply multiple nested transformations
 */
export type ApplyNestedTransforms<T, TMap> =
  TMap extends Record<string, any> ? DeepMerge<T, FlatMapToNested<TMap>> : T;

// ========================================
// FROM: types/validation-types.ts
// ========================================

// Re-export validation results from plugin-types.ts
export type {
  ValidationResult,
  FieldValidationResult,
  TransformParseResult,
  FieldValidator,
  TransformAwareValidator,
} from "../plugins/plugin-types";

// Re-export basic validation result from plugin-interfaces.ts
// Note: This is a different type than ValidationResult from smart-plugin
// Keeping both for backward compatibility
export type { PluginValidationResult as BasicValidationResult } from "../plugins/plugin-interfaces";

// Define ValidationOperation type
export interface ValidationOperation {
  validate(value: any, context?: any): { valid: boolean };
}

// Define RecursiveContext here since field-validator doesn't exist
export interface RecursiveContext {
  currentDepth: number;
  rootObject: any;
  parent: any;
  current: any;
}

// Common validation error interface
// This is synthesized from the common structure used across files
export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

// Re-export types that plugin-interfaces needs
export interface ValidationFunction<TObject = any, TTypes = any> {
  (value: any, context: ValidationContext<any, any>): { valid: boolean };
}

export interface ValidationContext<TObject = any, TValue = any> {
  path: string;
  allValues: TObject;
}

// Note: field-validator utility functions are not available in this refactored version
// They have been integrated into field-context.ts

// Re-export TypeName and ValidationOptions from plugin-types
export type { TypeName, ValidationOptions } from "../plugins/plugin-types";

// ========================================
// FROM: plugin-creator.ts
// ========================================

// Import types needed for plugin-creator
import type {
  StandardPluginImplementation,
  ConditionalPluginImplementation,
  FieldReferencePluginImplementation,
  MultiFieldReferencePluginImplementation,
  TransformPluginImplementation,
  ArrayElementPluginImplementation,
  ContextPluginImplementation,
  PreprocessorPluginImplementation,
  StandardValidationMethod,
  ConditionalValidationMethod,
  FieldReferenceValidationMethod,
  MultiFieldReferenceValidationMethod,
  TransformValidationMethod,
  ArrayElementValidationMethod,
  ContextValidationMethod,
} from "../plugins/plugin-interfaces";
import type {
  PluginCategory,
  TransformAwareValidator,
} from "../plugins/plugin-types";
import { Result } from "../../../types/result";

/**
 * Plugin implementation type based on category with Args
 */
export type PluginImplementation<
  TCategory extends PluginCategory,
  TTypes extends readonly TypeName[],
  TArgs extends any[] = any[],
  TInput = any,
  TOutput = any,
> = TCategory extends "standard"
  ? StandardPluginImplementation<TArgs, TTypes>
  : TCategory extends "conditional"
    ? ConditionalPluginImplementation<TTypes>
    : TCategory extends "fieldReference"
      ? FieldReferencePluginImplementation<TTypes>
      : TCategory extends "multiFieldReference"
        ? MultiFieldReferencePluginImplementation<TTypes>
        : TCategory extends "transform"
          ? TransformPluginImplementation<TInput, TOutput>
          : TCategory extends "arrayElement"
            ? ArrayElementPluginImplementation
            : TCategory extends "context"
              ? ContextPluginImplementation<TTypes>
              : TCategory extends "preprocessor"
                ? PreprocessorPluginImplementation<TTypes>
                : never;

/**
 * Plugin definition result
 */
export interface PluginDefinition<
  TName extends string,
  TTypes extends readonly TypeName[],
  TCategory extends PluginCategory,
> {
  name: TName;
  allowedTypes: TTypes;
  category: TCategory;
  methods: Record<string, PluginImplementation<TCategory, TTypes, any[]>>;
  impl: () => Record<string, Function>;
}

/**
 * Method signatures based on category with type placeholders
 */
export type CategoryMethodSignature<
  TCategory extends PluginCategory,
  TObjectPlaceholder = unknown,
  TInputPlaceholder = unknown,
> = TCategory extends "standard"
  ? StandardValidationMethod<any[], any>
  : TCategory extends "conditional"
    ? ConditionalValidationMethod<any, TObjectPlaceholder, TInputPlaceholder>
    : TCategory extends "fieldReference"
      ? FieldReferenceValidationMethod<
          any,
          TObjectPlaceholder,
          TInputPlaceholder
        >
      : TCategory extends "transform"
        ? TransformValidationMethod<any>
        : TCategory extends "arrayElement"
          ? ArrayElementValidationMethod
          : TCategory extends "context"
            ? ContextValidationMethod<any>
            : never;

// ========================================
// FROM: field-builder.ts
// ========================================

// Import types needed for FieldBuilderDefinition
import type {
  FieldBuilderContext,
  FieldDefinitionObject,
} from "../plugins/plugin-types";

/**
 * Field definition for deferred building
 */
export interface FieldBuilderDefinition<TObject extends object = any, TPlugins = any, TFieldType = any> {
  path: string;
  builderFunction: (context: FieldBuilderContext<TObject, TPlugins, TFieldType>) => any;
  inferredType?: string;
  fieldOptions?: import("../types/field-options").FieldOptions<TFieldType>;
  fieldType?: TFieldType;
}

// ========================================
// FROM: builder.ts
// ========================================

// Import types needed for builder
import type { FieldBuilder } from "../plugins/plugin-types";
import type { ComposablePlugin } from "../plugins/composable-plugin";
import type { ComposableConditionalPlugin } from "../plugins/composable-conditional-plugin";
import type { ComposableDirectlyPlugin } from "../plugins/composable-directly-plugin";

/**
 * Base ChainableBuilder interface
 */
export interface ChainableBuilder<TPlugins = {}> {
  for<TInputType extends object>(): FieldBuilder<
    TInputType,
    unknown,
    TPlugins,
    never
  >;
}

/**
 * Map plugin array to plugin map type
 */
export type PluginMapFromArray<
  T extends TypedPlugin<string, any, any, any, any>[],
> = {
  [K in T[number] as K extends TypedPlugin<infer TName, any, any, any, any>
    ? TName
    : never]: K;
};

/**
 * Extract extensions from a plugin
 */
type ExtractPluginExtensions<T> =
  T extends BuilderExtensionPlugin<any, infer TMethodName, infer TMethodSignature>
    ? { [K in TMethodName]: TMethodSignature }
    : {};

/**
 * Helper type to determine builder extensions based on plugins
 * Dynamically extracts extension methods from all builder-extension plugins
 */
export type BuilderExtensions<TPlugins> =
  TPlugins extends Record<string, any>
    ? UnionToIntersection<
        {
          [K in keyof TPlugins]: ExtractPluginExtensions<TPlugins[K]>;
        }[keyof TPlugins]
      >
    : {};

/**
 * Type for any plugin
 */
export type AnyPlugin =
  | TypedPlugin<any, any, any, any, any, any>
  | ComposablePlugin<any, any, any>
  | ComposableConditionalPlugin<any, any, any>
  | ComposableDirectlyPlugin<any, any, any>
  | BuilderExtensionPlugin<any, any>;

/**
 * Extract plugin name from any plugin type
 */
type ExtractPluginName<T> = T extends { name: infer N } ? N : never;

/**
 * Map multiple plugins to plugin map
 */
type PluginsToMap<T extends readonly AnyPlugin[]> = {
  [K in T[number] as ExtractPluginName<K>]: K;
};

/**
 * Extract extensions from a single plugin
 */
type ExtractSinglePluginExtension<T> =
  T extends BuilderExtensionPlugin<any, infer TMethodName, infer TMethodSignature> 
    ? { [K in TMethodName]: TMethodSignature }
    : {};

/**
 * Extract all extensions from multiple plugins
 */
type ExtractAllExtensions<T extends readonly AnyPlugin[]> = UnionToIntersection<
  {
    [K in keyof T]: ExtractSinglePluginExtension<T[K]>;
  }[number]
>;

/**
 * Type utility to inject builder type into extension methods
 * Replaces type parameter T with actual builder type
 */
type InjectBuilderType<TExtensions, TBuilder> = {
  [K in keyof TExtensions]: TExtensions[K] extends <T>(...args: infer Args) => any
    ? (...args: Args) => TBuilder
    : TExtensions[K];
};

/**
 * Extract parameters from BuilderExtensionMethod and create new signature
 * This properly types the method that gets added to the builder
 */
type CreateMethodWithBuilder<
  TMethodSignature extends BuilderExtensionMethod,
  TBuilder
> = TMethodSignature extends <T extends FieldBuilder<infer O, infer M, infer P, infer D>>(
    ...args: infer Args
  ) => T
  ? TBuilder extends IChainableBuilder<infer TInput, infer TPlugins, any>
    ? TInput extends object
      ? (...args: Args) => FieldBuilder<TInput, M, TPlugins, D>
      : (...args: Args) => FieldBuilder<any, M, TPlugins, D>
    : never
  : TMethodSignature extends <T>(...args: infer Args) => T
    ? (...args: Args) => TBuilder
    : never;

/**
 * Type that combines builder interface with accumulated extensions
 */
export type ChainableBuilderWithExtensions<
  TInput,
  TPlugins = {},
  TAccumulatedExtensions extends object = {},
> = IChainableBuilder<TInput, TPlugins, TAccumulatedExtensions> &
  TAccumulatedExtensions;

/**
 * Builder interface with dynamic method addition
 * Now tracks accumulated extensions separately
 */
export interface IChainableBuilder<
  TInput,
  TPlugins = {},
  TAccumulatedExtensions extends object = {},
> extends ChainableBuilder<TPlugins> {
  // Overload for TypedPlugin
  use<
    TName extends string,
    TMethodName extends string,
    TMethod extends Function,
    TAllowedTypes extends readonly TypeName[] | undefined,
    TPluginType extends PluginType = PluginType,
    TCategory extends PluginCategory = PluginCategory,
  >(
    plugin: TypedPlugin<
      TName,
      TMethodName,
      TMethod,
      TAllowedTypes,
      TPluginType,
      TCategory
    >
  ): IChainableBuilder<
    TInput,
    TPlugins & {
      [K in TName]: TypedPlugin<
        TName,
        TMethodName,
        TMethod,
        TAllowedTypes,
        TPluginType,
        TCategory
      >;
    },
    TAccumulatedExtensions
  > &
    TAccumulatedExtensions &
    TPlugins & { [K in TMethodName]: TMethod };

  // Overload for ComposablePlugin
  use<
    TName extends string,
    TMethodName extends string,
    TAllowedTypes extends readonly TypeName[],
  >(
    plugin: ComposablePlugin<TName, TMethodName, TAllowedTypes>
  ): IChainableBuilder<
    TInput,
    TPlugins & {
      [K in TName]: ComposablePlugin<TName, TMethodName, TAllowedTypes>;
    },
    TAccumulatedExtensions
  > &
    TAccumulatedExtensions &
    TPlugins & { [K in TMethodName]: any };

  // Overload for ComposableConditionalPlugin
  use<
    TName extends string,
    TMethodName extends string,
    TAllowedTypes extends readonly TypeName[],
  >(
    plugin: ComposableConditionalPlugin<TName, TMethodName, TAllowedTypes>
  ): IChainableBuilder<
    TInput,
    TPlugins & {
      [K in TName]: ComposableConditionalPlugin<
        TName,
        TMethodName,
        TAllowedTypes
      >;
    },
    TAccumulatedExtensions
  > &
    TAccumulatedExtensions &
    TPlugins & { [K in TMethodName]: any };

  // Overload for ComposableDirectlyPlugin
  use<
    TName extends string,
    TMethodName extends string,
    TAllowedTypes extends readonly TypeName[],
  >(
    plugin: ComposableDirectlyPlugin<TName, TMethodName, TAllowedTypes>
  ): IChainableBuilder<
    TInput,
    TPlugins & {
      [K in TName]: ComposableDirectlyPlugin<TName, TMethodName, TAllowedTypes>;
    },
    TAccumulatedExtensions
  > &
    TAccumulatedExtensions &
    TPlugins & { [K in TMethodName]: any };

  // Overload for BuilderExtensionPlugin with dynamic extensions
  use<
    TName extends string,
    TMethodName extends string,
    TMethodSignature extends BuilderExtensionMethod
  >(
    plugin: BuilderExtensionPlugin<TName, TMethodName, TMethodSignature>
  ): IChainableBuilder<
    TInput,
    TPlugins & {
      [K in TName]: BuilderExtensionPlugin<TName, TMethodName, TMethodSignature>;
    },
    TAccumulatedExtensions & {
      [K in TMethodName]: CreateMethodWithBuilder<
        TMethodSignature,
        IChainableBuilder<
          TInput,
          TPlugins & {
            [K in TName]: BuilderExtensionPlugin<TName, TMethodName, TMethodSignature>;
          },
          TAccumulatedExtensions & { [K in TMethodName]: TMethodSignature }
        >
      >
    }
  > & {
    [K in TMethodName]: CreateMethodWithBuilder<
      TMethodSignature,
      IChainableBuilder<
        TInput,
        TPlugins & {
          [K in TName]: BuilderExtensionPlugin<TName, TMethodName, TMethodSignature>;
        },
        TAccumulatedExtensions & { [K in TMethodName]: TMethodSignature }
      >
    >
  };

  // Overload for multiple plugins (2 plugins)
  use<P1 extends AnyPlugin, P2 extends AnyPlugin>(
    plugin1: P1,
    plugin2: P2
  ): IChainableBuilder<
    TInput,
    TPlugins & PluginsToMap<[P1, P2]>,
    TAccumulatedExtensions & ExtractAllExtensions<[P1, P2]>
  > &
    (TAccumulatedExtensions & ExtractAllExtensions<[P1, P2]>);

  // Overload for multiple plugins (3 plugins)
  use<P1 extends AnyPlugin, P2 extends AnyPlugin, P3 extends AnyPlugin>(
    plugin1: P1,
    plugin2: P2,
    plugin3: P3
  ): IChainableBuilder<
    TInput,
    TPlugins & PluginsToMap<[P1, P2, P3]>,
    TAccumulatedExtensions & ExtractAllExtensions<[P1, P2, P3]>
  > &
    (TAccumulatedExtensions & ExtractAllExtensions<[P1, P2, P3]>);

  // Overload for multiple plugins (4 plugins)
  use<
    P1 extends AnyPlugin,
    P2 extends AnyPlugin,
    P3 extends AnyPlugin,
    P4 extends AnyPlugin,
  >(
    plugin1: P1,
    plugin2: P2,
    plugin3: P3,
    plugin4: P4
  ): IChainableBuilder<
    TInput,
    TPlugins & PluginsToMap<[P1, P2, P3, P4]>,
    TAccumulatedExtensions & ExtractAllExtensions<[P1, P2, P3, P4]>
  > &
    (TAccumulatedExtensions & ExtractAllExtensions<[P1, P2, P3, P4]>);

  // Overload for multiple plugins (5 plugins)
  use<
    P1 extends AnyPlugin,
    P2 extends AnyPlugin,
    P3 extends AnyPlugin,
    P4 extends AnyPlugin,
    P5 extends AnyPlugin,
  >(
    plugin1: P1,
    plugin2: P2,
    plugin3: P3,
    plugin4: P4,
    plugin5: P5
  ): IChainableBuilder<
    TInput,
    TPlugins & PluginsToMap<[P1, P2, P3, P4, P5]>,
    TAccumulatedExtensions & ExtractAllExtensions<[P1, P2, P3, P4, P5]>
  > &
    (TAccumulatedExtensions & ExtractAllExtensions<[P1, P2, P3, P4, P5]>);

  // Overload for array of plugins
  use<T extends readonly AnyPlugin[]>(
    ...plugins: T
  ): IChainableBuilder<
    TInput,
    TPlugins & PluginsToMap<T>,
    TAccumulatedExtensions & ExtractAllExtensions<T>
  > &
    (TAccumulatedExtensions & ExtractAllExtensions<T>);
}

// Import needed types
import type {
  TypedPlugin,
  PluginType,
  BuilderExtensionPlugin,
  BuilderExtensionMethod,
  TypeName,
  ValidationOptions,
} from "../plugins/plugin-types";
import { ValidationResult } from "../../../types";

// ========================================
// FROM: async/async-context.ts
// ========================================

/**
 * Async context behavior options
 */
export interface AsyncContextOptions {
  /** Whether to continue processing even with async errors */
  continueOnError?: boolean;
  /** Timeout duration (milliseconds) */
  timeout?: number;
  /** Default values when individual async operations fail */
  defaultValues?: Record<string, any>;
}

/**
 * Async context type definition (simplified)
 */
export interface AsyncContext<T = Record<string, any>> {
  // Context to store async data
  readonly data: T;

  // Context state (simplified)
  readonly isReady: boolean;
  readonly hasErrors: boolean;
  readonly errors: Array<{ key: string; error: any }>;
}

/**
 * Async-aware validator
 */
export interface AsyncAwareValidator<TObject> {
  validate(
    value: Partial<TObject> | unknown,
    options?: ValidationOptions
  ): Result<TObject>;

  /**
   * Validation with async context (type-safe version)
   * Resolve async context before executing sync validation
   */
  withAsyncContext<TContext extends Record<string, any>>(
    asyncContext: AsyncContext<TContext>
  ): {
    validate(
      value: Partial<TObject> | unknown,
      options?: ValidationOptions
    ): Promise<Result<TObject>>;

    // Type-safe context accessor
    getContextType(): TContext;
  };
}

/**
 * Type definition for usage examples
 */
export interface ExampleAsyncContext {
  hasEmail: boolean;
  userExists: boolean;
  domainValidation: { valid: boolean; message?: string };
}

// ========================================
// FROM: async/async-validator-integration.ts
// ========================================

/**
 * Async support integration in builder
 */
export interface AsyncEnhancedBuilder<TObject extends object> {
  /**
   * Existing build functionality
   */
  build(): AsyncAwareValidator<TObject> & TransformAwareValidator<TObject, any>;

  /**
   * Build with async context
   */
  buildWithAsyncSupport(): AsyncAwareValidator<TObject> &
    TransformAwareValidator<TObject, any>;
}

// ========================================
// FROM: async/async-plugin-extensions.ts
// ========================================

/**
 * Async context-aware validation function type (type-safe version)
 */
export type AsyncContextAwareValidation<
  T,
  TAsyncContext extends Record<string, any> = Record<string, any>,
> = (
  value: T,
  context: ValidationContext<any, any> & { asyncContext?: TAsyncContext }
) => { valid: boolean; message?: string };

/**
 * Type-safe usage example of async plugins
 */
export type AsyncPluginMethods = {
  checkDuplication(): any;
  validateMx(): any;
  checkQuota(): any;
  conditionalCheck(): any;
  fullEmailValidation(): any;
};
