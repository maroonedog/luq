/**
 * Smart plugin creation with advanced type inference
 */

import {
  NestedKeyOf,
  ParseOptions,
  TypeOfPath,
  ValidationOptions,
  Validator,
  ValidationError,
  Result,
} from "../../../types";
import type { FieldRule } from "../../registry/plugin-registry";
import { ApplyNestedTransforms } from "../types/types";
import { ValidationFunction } from "../../plugin/types";
import type { ComposablePlugin } from "../plugins/composable-plugin";
import type {
  ConditionalValidationMethod,
  FieldReferenceValidationMethod,
  TransformValidationMethod,
} from "../plugins/plugin-interfaces";

// Re-export types
export type { ParseOptions, ValidationOptions };
export type TransformFunction<TInput, TOutput> = (value: TInput) => TOutput;

/**
 * Parse result with transform tracking
 */
export interface TransformParseResult<TOriginal, TTransformed> {
  valid: boolean;
  value: TOriginal | null;
  transformedData?: TTransformed;
  originalData?: TOriginal;
  errors: any[];
}

/**
 * Plugin types
 */
export type PluginType = "validator" | "transform";

/**
 * Plugin category types
 */
export type PluginCategory =
  | "standard"
  | "conditional"
  | "transform"
  | "fieldReference"
  | "multiFieldReference"
  | "arrayElement"
  | "composable"
  | "composable-conditional"
  | "composable-directly"
  | "context"
  | "builder-extension";

/**
 * Plugin definition with literal type for name
 */
export interface TypedPlugin<
  TName extends string,
  TMethodName extends string,
  TMethod extends Function,
  TAllowedTypes extends readonly TypeName[] | undefined = undefined,
  TPluginType extends PluginType = "validator",
  TCategory extends PluginCategory = "standard",
> {
  name: TName;
  methodName: TMethodName;
  create(): TMethod;
  allowedTypes?: TAllowedTypes;
  category: TCategory;
}

/**
 * Standard method signature for builder extensions
 * All extension methods must follow this pattern: accept TBuilder as type parameter and return it
 */
export type BuilderExtensionMethod = 
  | { <TBuilder>(...args: any[]): TBuilder }
  | { <TBuilder extends FieldBuilder<any, any, any, any>>(...args: any[]): TBuilder };

/**
 * Builder extension plugin interface with method signatures
 * TExtensions must follow BuilderExtensionMethod pattern
 */
export interface BuilderExtensionPlugin<
  TName extends string = string,
  TMethodName extends string = string,
  TMethodSignature extends BuilderExtensionMethod = BuilderExtensionMethod,
> {
  name: TName;
  category: "builder-extension";
  methodName: TMethodName;
  extendBuilder: (builderInstance: any) => void;
  impl: TMethodSignature;
}

/**
 * Allowed type names
 */
export type TypeName =
  | "string"
  | "number"
  | "date"
  | "array"
  | "union"
  | "tuple"
  | "object"
  | "boolean"
  | "null"
  | "any";

/**
 * Type mapping for type names
 */
export type TypeMapping = {
  string: string;
  number: number;
  date: Date;
  array: any[];
  union: any;
  tuple: readonly any[];
  object: object;
  boolean: boolean;
  null: null;
  any: any;
};

/**
 * Field validator interface for validating individual field values
 * @template TObject - The parent object type
 * @template TValue - The field value type
 * @template TRequiredKeys - Required keys for validation context
 */
export interface FieldValidator<
  TObject extends object,
  TValue,
  TRequiredKeys = undefined,
> {
  /**
   * Validates a single field value
   * @param value - The field value to validate
   * @param allValues - The complete object context for cross-field validation
   * @param options - Optional validation configuration
   * @returns Validation result for the field
   */
  validate(
    value?: TValue | null,
    allValues?: TRequiredKeys extends undefined
      ? Partial<TObject> | undefined
      : Partial<TObject>,
    options?: ValidationOptions
  ): ValidationResult<TValue>;

  /**
   * Parses and transforms a single field value
   * @param value - The field value to parse
   * @param allValues - The complete object context for cross-field validation
   * @param options - Optional parse configuration
   * @returns Parse result for the field with transformed value
   */
  parse?(
    value?: TValue | null,
    allValues?: TRequiredKeys extends undefined
      ? Partial<TObject> | undefined
      : Partial<TObject>,
    options?: ParseOptions
  ): ValidationResult<TValue>;
}

/**
 * Field validation result
 */
export interface FieldValidationResult<T> {
  valid: boolean;
  value?: T;
  errors?: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}

/**
 * Helper type to check if a field type can be refined to a target type
 * This is more specific to prevent primitive types from being considered as objects
 */
type CanRefineToType<TFieldType, TTargetType> = TTargetType extends string
  ? [TFieldType] extends [string]
    ? false
    : true
  : TTargetType extends number
    ? [TFieldType] extends [number]
      ? false
      : true
    : TTargetType extends boolean
      ? [TFieldType] extends [boolean]
        ? false
        : true
      : TTargetType extends Date
        ? [TFieldType] extends [Date]
          ? false
          : true
        : TTargetType extends readonly any[]
          ? [TFieldType] extends [readonly any[]]
            ? false
            : true
          : TTargetType extends any[]
            ? [TFieldType] extends [any[]]
              ? false
              : true
            : TTargetType extends object
              ? [TFieldType] extends [object]
                ? [TFieldType] extends [
                    string | number | boolean | Date | any[] | readonly any[],
                  ]
                  ? true // Allow refinement from primitives/arrays to object
                  : false // Don't allow refinement from object to object
                : true
              : [TFieldType] extends [TTargetType]
                ? false
                : true;

/**
 * Refine methods for type transitions - only show when type can be refined
 */
export interface ChainableFieldBuilderTransformAware<
  TObject extends object,
  TPlugins = {},
  TFieldType = any,
> {
  refineString: CanRefineToType<TFieldType, string> extends true
    ? () => ChainableFieldBuilder<TObject, TPlugins, "string", string>
    : never;
  refineNumber: CanRefineToType<TFieldType, number> extends true
    ? () => ChainableFieldBuilder<TObject, TPlugins, "number", number>
    : never;
  refineArray: CanRefineToType<TFieldType, any[]> extends true
    ? () => ChainableFieldBuilder<TObject, TPlugins, "array", any[]>
    : never;
  refineTuple: CanRefineToType<TFieldType, readonly any[]> extends true
    ? () => ChainableFieldBuilder<TObject, TPlugins, "tuple", readonly any[]>
    : never;
  refineUnion: CanRefineToType<TFieldType, any> extends true
    ? () => ChainableFieldBuilder<TObject, TPlugins, "union", any>
    : never;
  refineBoolean: CanRefineToType<TFieldType, boolean> extends true
    ? () => ChainableFieldBuilder<TObject, TPlugins, "boolean", boolean>
    : never;
  refineDate: CanRefineToType<TFieldType, Date> extends true
    ? () => ChainableFieldBuilder<TObject, TPlugins, "date", Date>
    : never;
  refineObject: CanRefineToType<TFieldType, object> extends true
    ? () => ChainableFieldBuilder<TObject, TPlugins, "object", object>
    : never;
}

/**
 * Extract methods from plugins by category
 */
type ExtractPluginMethodsByCategory<
  TPlugins,
  TCategory extends PluginCategory,
> = UnionToIntersection<
  {
    [K in keyof TPlugins]: TPlugins[K] extends TypedPlugin<
      any,
      infer TMethodName,
      infer TMethod,
      any,
      any,
      TCategory
    >
      ? TMethodName extends string
        ? { [P in TMethodName]: TMethod }
        : never
      : never;
  }[keyof TPlugins]
>;

/**
 * Apply actual types to plugin method signature
 */
type ApplyTypesToMethod<TMethod, TObject, TCurrentType> =
  TMethod extends ConditionalValidationMethod<infer TTypes, any, any>
    ? (
        condition: (allValues: TObject) => boolean,
        options?: ValidationOptions
      ) => ValidationFunction<TObject, TTypes>
    : TMethod extends FieldReferenceValidationMethod<infer TTypes, any, any>
      ? (
          fieldPath: NestedKeyOf<TObject> & string,
          options?: ValidationOptions
        ) => ValidationFunction<TObject, TTypes>
      : TMethod;

/**
 * Get category from plugin by method name
 */
type GetPluginCategoryByMethod<TPlugins, TMethodName extends string> = {
  [K in keyof TPlugins]: TPlugins[K] extends TypedPlugin<
    any,
    TMethodName,
    any,
    any,
    any,
    infer TCategory
  >
    ? TCategory
    : never;
}[keyof TPlugins];

/**
 * Get the actual method from plugin by method name
 */
type GetPluginMethodByName<TPlugins, TMethodName extends string> = {
  [K in keyof TPlugins]: TPlugins[K] extends TypedPlugin<
    any,
    TMethodName,
    infer TMethod,
    any,
    any,
    any
  >
    ? TMethod
    : never;
}[keyof TPlugins];

/**
 * Infer method parameters with actual types applied
 */
export type InferMethodParameters<
  TMethod,
  TObject,
  TCurrentType,
  TPlugins = {},
  TMethodName extends string = string,
> =
  GetPluginMethodByName<TPlugins, TMethodName> extends infer ActualMethod
    ? ActualMethod extends (...args: infer P) => any
      ? P
      : never
    : TMethod extends (...args: infer P) => any
      ? P
      : never;

/**
 * Map plugin methods to chainable builder methods
 */
type MapPluginMethodsToChainable<
  TMethods,
  TObject extends object,
  TPlugins,
  TType extends TypeName | undefined,
  TCurrentType,
  TTypeState extends TypeStateFlags = {},
> = {
  [MethodName in keyof TMethods]: TMethods[MethodName] extends infer TMethod
    ? TMethod extends (...args: any) => any
      ? GetPluginCategoryByMethod<
          TPlugins,
          MethodName & string
        > extends infer TCategory
        ? TCategory extends "conditional"
          ? (
              condition: (allValues: TObject) => boolean,
              options?: ValidationOptions
            ) => ChainableFieldBuilder<
              TObject,
              TPlugins,
              TType,
              TCurrentType,
              TTypeState
            >
          : TCategory extends "composable-conditional"
            ? MethodName extends "guard"
              ? TType extends "union"
                ? <TGuardType extends TCurrentType>(
                    condition: (value: unknown) => value is TGuardType,
                    builderFn: (
                      context: FieldBuilderContext<
                        TObject,
                        TPlugins,
                        TGuardType
                      >
                    ) => any
                  ) => ChainableFieldBuilderWithUnionTracking<
                    TObject,
                    TPlugins,
                    TType,
                    TCurrentType,
                    TGuardType
                  >
                : ChainableFieldBuilder<
                    TObject,
                    TPlugins,
                    TType,
                    TCurrentType,
                    TTypeState
                  >
              : InferMethodParameters<
                    TMethod,
                    TObject,
                    TCurrentType,
                    TPlugins,
                    MethodName & string
                  > extends infer Params
                ? Params extends readonly any[]
                  ? (
                      ...args: Params
                    ) => ChainableFieldBuilder<
                      TObject,
                      TPlugins,
                      TType,
                      TCurrentType,
                      TTypeState
                    >
                  : never
                : never
            : TCategory extends "fieldReference"
              ? (
                  fieldPath: NestedKeyOf<TObject> & string,
                  options?: ValidationOptions
                ) => ChainableFieldBuilder<
                  TObject,
                  TPlugins,
                  TType,
                  TCurrentType,
                  TTypeState
                >
              : TCategory extends "multiFieldReference"
                ? <
                    const TFields extends readonly (NestedKeyOf<TObject> &
                      string)[],
                  >(
                    fields: TFields,
                    validate: (
                      fieldValues: import("../../../types/stitch-types").FieldsToObject<
                        TObject,
                        TFields
                      >,
                      currentValue: ApplyTypeState<TCurrentType, TTypeState>,
                      allValues: TObject
                    ) => { valid: boolean; message?: string },
                    options?: ValidationOptions & {
                      code?: string;
                      messageFactory?: (context: {
                        path: string;
                        value: ApplyTypeState<TCurrentType, TTypeState>;
                        code: string;
                        fields: TFields;
                        fieldValues: import("../../../types/stitch-types").FieldsToObject<
                          TObject,
                          TFields
                        >;
                        allValues: TObject;
                      }) => string;
                    }
                  ) => ChainableFieldBuilder<
                    TObject,
                    TPlugins,
                    TType,
                    TCurrentType,
                    TTypeState
                  >
                : TCategory extends "transform"
                  ? <TOutput>(
                      fn: import("../../plugin/transform-type-restrictions").IsForbiddenTransformOutput<TOutput> extends true
                        ? import("../../plugin/transform-type-restrictions").ForbiddenTransformError<TOutput>
                        : (
                            value: ApplyTypeState<TCurrentType, TTypeState>
                          ) => TOutput
                    ) => ChainableFieldBuilder<
                      TObject,
                      TPlugins,
                      TType,
                      TOutput,
                      TTypeState
                    >
                  : MethodName extends "required"
                    ? InferMethodParameters<
                        TMethod,
                        TObject,
                        TCurrentType,
                        TPlugins,
                        MethodName & string
                      > extends infer Params
                      ? Params extends readonly any[]
                        ? (...args: Params) => ChainableFieldBuilder<
                            TObject,
                            TPlugins,
                            TType,
                            TCurrentType,
                            {
                              excludeUndefined: true;
                              excludeNull?: TTypeState["excludeNull"];
                            }
                          >
                        : never
                      : never
                    : MethodName extends "optional"
                      ? InferMethodParameters<
                          TMethod,
                          TObject,
                          TCurrentType,
                          TPlugins,
                          MethodName & string
                        > extends infer Params
                        ? Params extends readonly any[]
                          ? (...args: Params) => ChainableFieldBuilder<
                              TObject,
                              TPlugins,
                              TType,
                              TCurrentType,
                              {
                                excludeUndefined: true;
                                excludeNull?: TTypeState["excludeNull"];
                              }
                            >
                          : never
                        : never
                      : MethodName extends "nullable"
                        ? InferMethodParameters<
                            TMethod,
                            TObject,
                            TCurrentType,
                            TPlugins,
                            MethodName & string
                          > extends infer Params
                          ? Params extends readonly any[]
                            ? (...args: Params) => ChainableFieldBuilder<
                                TObject,
                                TPlugins,
                                TType,
                                TCurrentType | null,
                                {
                                  excludeUndefined?: TTypeState["excludeUndefined"];
                                  excludeNull: true;
                                }
                              >
                            : never
                          : never
                        : InferMethodParameters<
                              TMethod,
                              TObject,
                              TCurrentType,
                              TPlugins,
                              MethodName & string
                            > extends infer Params
                          ? Params extends readonly any[]
                            ? (
                                ...args: Params
                              ) => InferChainableReturnType<
                                TMethod,
                                TObject,
                                TPlugins,
                                TType,
                                TCurrentType,
                                MethodName & string,
                                TTypeState
                              >
                            : never
                          : never
        : never
      : never
    : never;
};

/**
 * Determine the return type of a chainable method based on the plugin
 */
type InferChainableReturnType<
  TMethod,
  TObject extends object,
  TPlugins,
  TType extends TypeName | undefined,
  TCurrentType,
  TMethodName extends string,
  TTypeState extends TypeStateFlags = {},
> =
  GetPluginCategoryByMethod<TPlugins, TMethodName> extends infer TCategory
    ? TCategory extends "transform"
      ? <TOutput>(
          fn: (value: ApplyTypeState<TCurrentType, TTypeState>) => TOutput
        ) => ChainableFieldBuilder<
          TObject,
          TPlugins,
          TType,
          TOutput,
          TTypeState
        >
      : TMethodName extends "nullable"
        ? ChainableFieldBuilder<
            TObject,
            TPlugins,
            TType,
            TCurrentType | null,
            {
              excludeUndefined?: TTypeState["excludeUndefined"];
              excludeNull: true;
            }
          >
        : TMethodName extends "guard"
          ? TType extends "union"
            ? <TGuardType extends TCurrentType>(
                condition: (value: unknown) => value is TGuardType,
                builderFn: (
                  context: FieldBuilderContext<TObject, TPlugins, TGuardType>
                ) => any
              ) => ChainableFieldBuilderWithUnionTracking<
                TObject,
                TPlugins,
                TType,
                TCurrentType,
                TGuardType
              >
            : ChainableFieldBuilder<
                TObject,
                TPlugins,
                TType,
                TCurrentType,
                TTypeState
              >
          : ChainableFieldBuilder<
              TObject,
              TPlugins,
              TType,
              TCurrentType,
              TTypeState
            >
    : ChainableFieldBuilder<TObject, TPlugins, TType, TCurrentType, TTypeState>;

/**
 * Extract methods from conditional plugins (plugins with category: "conditional")
 */
type ExtractConditionalPluginMethods<TPlugins> = ExtractPluginMethodsByCategory<
  TPlugins,
  "conditional"
>;

/**
 * Extract methods from transform plugins
 */
type ExtractTransformPluginMethods<TPlugins> = ExtractPluginMethodsByCategory<
  TPlugins,
  "transform"
>;

/**
 * Extract methods from field reference plugins
 */
type ExtractFieldReferencePluginMethods<TPlugins> =
  ExtractPluginMethodsByCategory<TPlugins, "fieldReference">;

/**
 * Extract methods from multi-field reference plugins
 */
type ExtractMultiFieldReferencePluginMethods<TPlugins> =
  ExtractPluginMethodsByCategory<TPlugins, "multiFieldReference">;

/**
 * Extract composable plugin methods
 */
export type ExtractComposablePluginMethods<TPlugins> = TPlugins extends {}
  ? UnionToIntersection<
      {
        [K in keyof TPlugins]: TPlugins[K] extends TypedPlugin<
          any,
          infer TMethodName,
          infer TMethod,
          any,
          any,
          "composable" | "composable-conditional" | "composable-directly"
        >
          ? Record<TMethodName, TMethod>
          : TPlugins[K] extends {
                category:
                  | "composable"
                  | "composable-conditional"
                  | "composable-directly";
                methodName: infer TMethodName;
              }
            ? TMethodName extends string
              ? Record<TMethodName, (...args: any[]) => any>
              : never
            : never;
      }[keyof TPlugins]
    >
  : never;

/**
 * Get the category of a method from plugins
 */
type GetMethodCategory<
  TPlugins,
  TMethodName extends string,
> = TMethodName extends keyof ExtractConditionalPluginMethods<TPlugins>
  ? "conditional"
  : TMethodName extends keyof ExtractTransformPluginMethods<TPlugins>
    ? "transform"
    : TMethodName extends keyof ExtractFieldReferencePluginMethods<TPlugins>
      ? "fieldReference"
      : TMethodName extends keyof ExtractMultiFieldReferencePluginMethods<TPlugins>
        ? "multiFieldReference"
        : TMethodName extends keyof ExtractComposablePluginMethods<TPlugins>
          ? "composable" | "composable-conditional" | "composable-directly"
          : "standard";

/**
 * Check if a method belongs to a conditional plugin
 */
type IsConditionalMethod<TPlugins, TMethodName extends string> =
  GetMethodCategory<TPlugins, TMethodName> extends "conditional" ? true : false;

/**
 * Base interface for chainable builders - contains common methods
 */
interface ChainableFieldBuilderBase<
  TObject extends object,
  TPlugins,
  TType extends TypeName | undefined,
  TCurrentType,
  TTypeState extends TypeStateFlags = {},
> {
  refineString(): ChainableFieldBuilder<
    TObject,
    TPlugins,
    "string",
    TCurrentType,
    TTypeState
  >;
  refineNumber(): ChainableFieldBuilder<
    TObject,
    TPlugins,
    "number",
    TCurrentType,
    TTypeState
  >;
  refineBoolean(): ChainableFieldBuilder<
    TObject,
    TPlugins,
    "boolean",
    TCurrentType,
    TTypeState
  >;
  refineArray(): ChainableFieldBuilder<
    TObject,
    TPlugins,
    "array",
    TCurrentType,
    TTypeState
  >;
  refineObject(): ChainableFieldBuilder<
    TObject,
    TPlugins,
    "object",
    TCurrentType,
    TTypeState
  >;
  refineTuple(): ChainableFieldBuilder<
    TObject,
    TPlugins,
    "tuple",
    TCurrentType,
    TTypeState
  >;
  refineUnion(): ChainableFieldBuilder<
    TObject,
    TPlugins,
    "union",
    TCurrentType,
    TTypeState
  >;
  refineDate(): ChainableFieldBuilder<
    TObject,
    TPlugins,
    "date",
    TCurrentType,
    TTypeState
  >;
}

/**
 * Union builder with exhaustive type checking
 */
interface UnionFieldBuilder<
  TObject extends object,
  TPlugins,
  TUnionType,
  TDeclaredTypes = never,
> extends ChainableFieldBuilderBase<TObject, TPlugins, "union", TUnionType> {
  build(): Exclude<TUnionType, TDeclaredTypes> extends never
    ? FieldValidator<TObject, TUnionType>
    : {
        _error: `Missing guard declarations for union types: ${Exclude<TUnionType, TDeclaredTypes> & string}`;
        _missingTypes: Exclude<TUnionType, TDeclaredTypes>;
      };
}

/**
 * Guard method signature for union types
 */
type GuardMethod<
  TObject extends object,
  TPlugins,
  TUnionType,
  TDeclaredTypes,
> = <TGuardType extends TUnionType>(
  condition: (value: unknown) => value is TGuardType,
  builderFn: (
    context: FieldBuilderContext<TObject, TPlugins, TGuardType>
  ) => any
) => UnionFieldBuilderWithPlugins<
  TObject,
  TPlugins,
  TUnionType,
  TDeclaredTypes | TGuardType
>;

/**
 * Extract plugin methods for union type
 */
type ExtractUnionPluginMethods<
  TObject extends object,
  TPlugins,
  TUnionType,
  TDeclaredTypes = never,
> = {
  [K in keyof FlattenPluginMethods<
    FilterPluginsByType<TPlugins, "union">,
    TObject,
    TUnionType
  >]: K extends "guard"
    ? GuardMethod<TObject, TPlugins, TUnionType, TDeclaredTypes>
    : FlattenPluginMethods<
          FilterPluginsByType<TPlugins, "union">,
          TObject,
          TUnionType
        >[K] extends (...args: infer P) => any
      ? (
          ...args: P
        ) => UnionFieldBuilderWithPlugins<
          TObject,
          TPlugins,
          TUnionType,
          TDeclaredTypes
        >
      : never;
};

/**
 * Complete union field builder with plugins
 */
type UnionFieldBuilderWithPlugins<
  TObject extends object,
  TPlugins,
  TUnionType,
  TDeclaredTypes = never,
> = UnionFieldBuilder<TObject, TPlugins, TUnionType, TDeclaredTypes> &
  ExtractUnionPluginMethods<TObject, TPlugins, TUnionType, TDeclaredTypes>;

/**
 * Chainable field builder with union type tracking
 */
export type ChainableFieldBuilderWithUnionTracking<
  TObject extends object,
  TPlugins = {},
  TType extends TypeName | undefined = undefined,
  TCurrentType = TType extends TypeName ? TypeMapping[TType] : any,
  TDeclaredUnionTypes = never,
> = TType extends "union"
  ? UnionFieldBuilderWithPlugins<
      TObject,
      TPlugins,
      TCurrentType,
      TDeclaredUnionTypes
    >
  : ChainableFieldBuilder<TObject, TPlugins, TType, TCurrentType>;

/**
 * Standard field builder interface
 */
interface StandardFieldBuilder<
  TObject extends object,
  TPlugins,
  TType extends TypeName | undefined,
  TCurrentType,
  TTypeState extends TypeStateFlags = {},
> extends ChainableFieldBuilderBase<
    TObject,
    TPlugins,
    TType,
    TCurrentType,
    TTypeState
  > {
  build(): FieldValidator<TObject, TCurrentType>;
}

/**
 * Type state tracking for required/optional/nullable
 */
export interface TypeStateFlags {
  excludeUndefined?: boolean;
  excludeNull?: boolean;
}

/**
 * Apply type state to a type
 */
export type ApplyTypeState<
  T,
  TState extends TypeStateFlags,
> = TState["excludeUndefined"] extends true
  ? TState["excludeNull"] extends true
    ? NonNullable<T>
    : Exclude<T, undefined>
  : TState["excludeNull"] extends true
    ? Exclude<T, null>
    : T;

/**
 * Simplified chainable field builder for better type inference
 */
export type ChainableFieldBuilder<
  TObject extends object,
  TPlugins = {},
  TType extends TypeName | undefined = undefined,
  TCurrentType = TType extends TypeName ? TypeMapping[TType] : any,
  TTypeState extends TypeStateFlags = {},
> = TType extends TypeName
  ? StandardFieldBuilder<TObject, TPlugins, TType, TCurrentType, TTypeState> &
      MapPluginMethodsToChainable<
        FlattenPluginMethods<
          FilterPluginsByType<TPlugins, TType>,
          TObject,
          TCurrentType
        >,
        TObject,
        TPlugins,
        TType,
        TCurrentType,
        TTypeState
      > &
      ExtractComposablePluginMethods<FilterPluginsByType<TPlugins, TType>>
  : {
      build(): FieldValidator<TObject, TCurrentType>;
      // Refine methods for type transitions
      refineString(): ChainableFieldBuilder<
        TObject,
        TPlugins,
        "string",
        TCurrentType,
        TTypeState
      >;
      refineNumber(): ChainableFieldBuilder<
        TObject,
        TPlugins,
        "number",
        TCurrentType,
        TTypeState
      >;
      refineBoolean(): ChainableFieldBuilder<
        TObject,
        TPlugins,
        "boolean",
        TCurrentType,
        TTypeState
      >;
      refineArray(): ChainableFieldBuilder<
        TObject,
        TPlugins,
        "array",
        TCurrentType,
        TTypeState
      >;
      refineObject(): ChainableFieldBuilder<
        TObject,
        TPlugins,
        "object",
        TCurrentType,
        TTypeState
      >;
      refineTuple(): ChainableFieldBuilder<
        TObject,
        TPlugins,
        "tuple",
        TCurrentType,
        TTypeState
      >;
      refineUnion(): ChainableFieldBuilder<
        TObject,
        TPlugins,
        "union",
        TCurrentType,
        TTypeState
      >;
      refineDate(): ChainableFieldBuilder<
        TObject,
        TPlugins,
        "date",
        TCurrentType,
        TTypeState
      >;
    } & {
      [K in keyof FlattenPluginMethods<
        TPlugins,
        TObject,
        TCurrentType
      >]: K extends "required"
        ? FlattenPluginMethods<TPlugins, TObject, TCurrentType>[K] extends (
            ...args: infer P
          ) => any
          ? (...args: P) => ChainableFieldBuilder<
              TObject,
              TPlugins,
              undefined,
              TCurrentType,
              {
                excludeUndefined: true;
                excludeNull?: TTypeState["excludeNull"];
              }
            >
          : never
        : K extends "optional"
          ? FlattenPluginMethods<TPlugins, TObject, TCurrentType>[K] extends (
              ...args: infer P
            ) => any
            ? (...args: P) => ChainableFieldBuilder<
                TObject,
                TPlugins,
                undefined,
                TCurrentType,
                {
                  excludeUndefined: true;
                  excludeNull?: TTypeState["excludeNull"];
                }
              >
            : never
          : K extends "nullable"
            ? FlattenPluginMethods<TPlugins, TObject, TCurrentType>[K] extends (
                ...args: infer P
              ) => any
              ? (...args: P) => ChainableFieldBuilder<
                  TObject,
                  TPlugins,
                  undefined,
                  TCurrentType | null,
                  {
                    excludeUndefined?: TTypeState["excludeUndefined"];
                    excludeNull: true;
                  }
                >
              : never
            : FlattenPluginMethods<TPlugins, TObject, TCurrentType>[K] extends (
                  ...args: infer P
                ) => any
              ? (
                  ...args: P
                ) => ChainableFieldBuilder<
                  TObject,
                  TPlugins,
                  undefined,
                  TCurrentType,
                  TTypeState
                >
              : never;
    } & ExtractComposablePluginMethods<TPlugins>;

/**
 * Helper types for union detection and null removal
 */
type RemoveNullAndUndefined<T> = NonNullable<T>;

type IsUnion<T, U = T> = T extends boolean
  ? false // boolean is technically true | false, but we treat it as a single type
  : T extends U
    ? [U] extends [T]
      ? false
      : true
    : false;

/**
 * Type-specific field builder context
 * Shows all builders to match runtime behavior, with proper typing for the field type
 */
export type FieldBuilderContext<
  TObject extends object,
  TPlugins = {},
  TFieldType = any,
> = {
  string: ChainableFieldBuilder<TObject, TPlugins, "string", string>;
  number: ChainableFieldBuilder<TObject, TPlugins, "number", number>;
  boolean: ChainableFieldBuilder<TObject, TPlugins, "boolean", boolean>;
  date: ChainableFieldBuilder<TObject, TPlugins, "date", Date>;
  array: ChainableFieldBuilder<TObject, TPlugins, "array", any[]>;
  tuple: ChainableFieldBuilder<TObject, TPlugins, "tuple", readonly any[]>;
  union: IsUnion<RemoveNullAndUndefined<TFieldType>> extends true
    ? ValidateUnionType<
        RemoveNullAndUndefined<TFieldType>
      > extends UnionArrayObjectError
      ? ValidateUnionType<RemoveNullAndUndefined<TFieldType>>
      : ChainableFieldBuilderWithUnionTracking<
          TObject,
          TPlugins,
          "union",
          RemoveNullAndUndefined<TFieldType>,
          never
        >
    : [TFieldType] extends [never]
      ? ChainableFieldBuilder<TObject, TPlugins, "union", any>
      : TFieldType extends string | number | boolean | Date | any[] | object
        ? ValidateUnionType<TFieldType> extends UnionArrayObjectError
          ? ValidateUnionType<TFieldType>
          : ChainableFieldBuilderWithUnionTracking<
              TObject,
              TPlugins,
              "union",
              TFieldType,
              never
            >
        : ChainableFieldBuilder<TObject, TPlugins, "union", any>;
  object: ChainableFieldBuilder<TObject, TPlugins, "object", object>;
  any: ChainableFieldBuilder<TObject, TPlugins, "any", any>;
};

/**
 * Validator interface
 */
export interface TransformAwareValidator<T extends object, TTransformed = T> {
  validate(value: Partial<T> | unknown, options?: ValidationOptions): Result<T>;
  parse(
    value: Partial<T> | unknown,
    options?: ParseOptions
  ): Result<TTransformed>;

  pick<K extends NestedKeyOf<T>>(key: K): FieldValidator<T, TypeOfPath<T, K>>;

  // Ultra-fast raw methods (1M+ ops/sec) - bypasses Result wrapper
  validateRaw?(value: T, options?: ValidationOptions): boolean;
  parseRaw?(
    value: T,
    options?: ParseOptions
  ): { valid: boolean; data?: TTransformed; error?: any };
}

/**
 * Validation result
 */
export interface ValidationResult<T> {
  valid: boolean;
  value: T | null;
  errors: ValidationError[];
  originalValue?: T;
}

/**
 * Apply transform map to original type
 * This ensures that transformed fields have their new types in the result
 */
export type ApplyFieldTransforms<TObject, TMap> = ApplyNestedTransforms<
  TObject,
  TMap
>;

/**
 * Extract the final type from a field builder result
 */
export type ExtractFieldType<T> =
  T extends ChainableFieldBuilder<any, any, any, infer TOutput>
    ? TOutput
    : T extends { build(): FieldValidator<any, infer TValue> }
      ? TValue
      : T extends FieldValidator<any, infer TValue>
        ? TValue
        : never;

/**
 * Helper type to add a field transformation to the map
 * Only adds to map if the type actually changed
 */
export type AddFieldTransform<
  TMap,
  K extends string,
  TOriginal,
  TResult,
> = TResult extends TOriginal ? TMap : TMap & Record<K, TResult>;

/**
 * Helper type to track declared fields
 */
export type DeclaredFields<T> = T extends Record<infer K, any> ? K : never;

/**
 * Helper type to check if all required fields are declared
 */
export type MissingFields<
  TObject extends object,
  TDeclared extends string,
> = Exclude<NestedKeyOf<TObject>, TDeclared>;

/**
 * Field definition options for complex cases
 */
export interface FieldDefinitionObject<
  TObject extends object,
  TPlugins,
  TFieldType,
  TPreprocessed = TFieldType,
  TTransformed = TPreprocessed,
> {
  /**
   * Required validation definition
   */
  validate: (
    context: FieldBuilderContext<TObject, TPlugins, TPreprocessed>
  ) =>
    | ChainableFieldBuilder<TObject, TPlugins, any, any>
    | FieldValidator<TObject, any>;
}

/**
 * Field definition can be either a function (simple) or object (complex)
 */
export type FieldDefinition<
  TObject extends object,
  TPlugins,
  TFieldType,
  TFieldBuilder,
> = (
  context: FieldBuilderContext<TObject, TPlugins, TFieldType>
) => TFieldBuilder;

/**
 * Forward declaration
 */
export interface FieldBuilder<
  TObject extends object,
  TMap = {},
  TPlugins = {},
  TDeclaredFields extends string = never,
> {
  /**
   * @deprecated Use `v` method instead. This method will be removed in a future version.
   * Define validation rules for a field
   * WIP: Does not validate unknown properties by default
   * @param path - The field path to validate
   * @param definition - Validation rule definition
   * @param options - Optional field configuration
   */
  field<Key extends NestedKeyOf<TObject> & string, TFieldBuilder>(
    path: Key,
    definition: FieldDefinition<
      TObject,
      TPlugins,
      TypeOfPath<TObject, Key>,
      TFieldBuilder
    >,
    options?: import("../types/field-options").FieldConfig<
      TypeOfPath<TObject, Key>
    >
  ): FieldBuilder<
    TObject,
    AddFieldTransform<
      TMap,
      Key,
      TypeOfPath<TObject, Key>,
      ExtractFieldType<TFieldBuilder>
    >,
    TPlugins,
    TDeclaredFields | Key
  >;

  /**
   * Define validation rules for a field (alias for field method)
   * WIP: Does not validate unknown properties by default
   * @param path - The field path to validate
   * @param definition - Validation rule definition
   * @param options - Optional field configuration
   */
  v<Key extends NestedKeyOf<TObject> & string, TFieldBuilder>(
    path: Key,
    definition: FieldDefinition<
      TObject,
      TPlugins,
      TypeOfPath<TObject, Key>,
      TFieldBuilder
    >,
    options?: import("../types/field-options").FieldConfig<
      TypeOfPath<TObject, Key>
    >
  ): FieldBuilder<
    TObject,
    AddFieldTransform<
      TMap,
      Key,
      TypeOfPath<TObject, Key>,
      ExtractFieldType<TFieldBuilder>
    >,
    TPlugins,
    TDeclaredFields | Key
  >;

  /**
   * Register a pre-built field rule
   * Tip: Use PluginRegistry to create type-safe field rules
   * @example
   * ```typescript
   * const registry = createPluginRegistry().use(requiredPlugin);
   * const rules = registry.createFieldRules();
   * builder.useField("name", rules.string.required());
   * ```
   * @param path - The field path to validate
   * @param fieldRule - Pre-built validation rule (create with PluginRegistry)
   */
  useField<Key extends NestedKeyOf<TObject> & string>(
    path: Key,
    fieldRule: FieldRule<TypeOfPath<TObject, Key>>
  ): FieldBuilder<TObject, TMap, TPlugins, TDeclaredFields | Key>;
  /**
   * WIP: Enforces strict mode validation
   * @deprecated This is a work in progress and may change in future versions
   */
  strict(): MissingFields<TObject, TDeclaredFields> extends never
    ? FieldBuilder<TObject, TMap, TPlugins, TDeclaredFields>
    : {
        _error: `Missing field declarations in strict mode: ${MissingFields<
          TObject,
          TDeclaredFields
        > &
          string}`;
        _missingFields: MissingFields<TObject, TDeclaredFields>;
      };
  /**
   * WIP: Alias for strict mode with editor-specific naming
   * @deprecated This is a work in progress and may change in future versions
   */
  strictOnEditor(): MissingFields<TObject, TDeclaredFields> extends never
    ? FieldBuilder<TObject, TMap, TPlugins, TDeclaredFields>
    : {
        _error: `Missing field declarations in strict mode: ${MissingFields<
          TObject,
          TDeclaredFields
        > &
          string}`;
        _missingFields: MissingFields<TObject, TDeclaredFields>;
      };
  /**
   * Build the final validator
   * WIP: The built validator does not validate unknown properties by default.
   * Use objectAdditionalProperties plugin for strict property validation.
   * @returns A validator function with validate() and parse() methods
   */
  build(): TransformAwareValidator<
    TObject,
    ApplyFieldTransforms<TObject, TMap>
  >;
}

// Internal types needed for ChainableFieldBuilder to work
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

type FlattenPluginMethods<
  TPlugins,
  TObject = any,
  TCurrentType = any,
> = UnionToIntersection<ExtractPluginMethods<TPlugins, TObject, TCurrentType>>;

type ExtractPluginMethods<
  TPlugins,
  TObject = any,
  TCurrentType = any,
> = TPlugins extends {}
  ? {
      [K in keyof TPlugins]: TPlugins[K] extends TypedPlugin<
        any,
        infer TMethodName,
        infer TMethod,
        any,
        any,
        any
      >
        ? TMethodName extends string
          ? TMethod extends Function
            ? { [P in TMethodName]: TMethod }
            : never
          : never
        : TPlugins[K] extends ComposablePlugin<any, infer TMethodName, any>
          ? TMethodName extends string
            ? { [P in TMethodName]: (...args: any[]) => any }
            : never
          : TPlugins[K] extends {
                category: "composable-conditional";
                methodName: infer TMethodName;
              }
            ? TMethodName extends string
              ? { [P in TMethodName]: (...args: any[]) => any }
              : never
            : never;
    }[keyof TPlugins]
  : never;

type FilterPluginsByType<TPlugins, TType extends TypeName> = {
  [K in keyof TPlugins as TPlugins[K] extends TypedPlugin<
    any,
    any,
    any,
    infer TAllowedTypes,
    any,
    any
  >
    ? TAllowedTypes extends readonly TypeName[]
      ? TType extends TAllowedTypes[number]
        ? K
        : never
      : K
    : TPlugins[K] extends {
          category:
            | "composable"
            | "composable-conditional"
            | "composable-directly";
          allowedTypes: infer TAllowedTypes;
        }
      ? TAllowedTypes extends readonly TypeName[]
        ? TType extends TAllowedTypes[number]
          ? K
          : never
        : K
      : never]: TPlugins[K];
};

/**
 * Union Type Analysis - Array<object> Detection
 *
 * These types help detect when a Union type contains Array<object>,
 * which should use individual field declarations instead of unionGuard
 */

// Extract array types from union
type ExtractArrayFromUnion<T> = T extends Array<infer U> ? Array<U> : never;

// Check if array element is an object (not primitive)
type IsArrayElementObject<T> =
  T extends Array<infer U>
    ? U extends object
      ? U extends string | number | boolean | Date | null | undefined
        ? false
        : true
      : false
    : false;

// Check if union contains Array<object>
type HasArrayWithObjectElement<T> = T extends infer U
  ? IsArrayElementObject<U> extends true
    ? true
    : false
  : false;

// Check if union has any Array<object> members
type UnionHasArrayWithObject<T> = T extends any
  ? HasArrayWithObjectElement<T> extends true
    ? true
    : false
  : false;

// Error message type for Array<object> in Union
type UnionArrayObjectError = {
  _error: "❌ Union types with Array<object> are not supported by unionGuard. Use individual field declarations instead.";
  _suggestion: "Example: .v('items[*].property', b => b.type.validators()) instead of union guards";
  _reason: "Array<object> requires field-level validation that unionGuard cannot provide";
};

// Conditional type to show error for problematic unions
export type ValidateUnionType<T> =
  UnionHasArrayWithObject<T> extends true ? UnionArrayObjectError : T;
