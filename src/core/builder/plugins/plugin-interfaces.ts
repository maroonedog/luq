/**
 * Type-safe Plugin Interfaces
 *
 * This module provides clear interfaces for each plugin category,
 * making it easy for developers to create new plugins without confusion.
 */

import { ValidationFunction } from "../types/types";
import {
  NestedKeyOf,
  ValidationOptions,
  ValidationContext,
} from "../../plugin/types";
import { TypeName } from "./plugin-types";

/**
 * Base validation result
 */
export type PluginValidationResult = {
  valid: boolean;
};

/**
 * Hoisted validator format for performance optimization
 */
export interface ValidatorFormat {
  check: (
    value: any,
    allValues?: any,
    arrayContext?: import("../../plugin/types").ArrayContext
  ) => boolean;
  code: string;

  getErrorMessage: (
    value: any,
    path: string,
    allValues?: any,
    arrayContext?: import("../../plugin/types").ArrayContext
  ) => string;
  params: any[];
  // Optional flags for special plugins
  isOptional?: boolean;
  skipForUndefined?: boolean;
  isNullable?: boolean;
  skipForNull?: boolean;
  // Special markers for different plugin types
  __isTransform?: boolean;
  __isDefault?: boolean;
  __isPreprocess?: boolean;
  __isFromContext?: boolean;
  __isStitch?: boolean;
  __isOrFail?: boolean;
  __isRecursive?: boolean;
  // Transform function for transform plugins
  __transformFn?: (value: any) => any;
  // Context options for context plugins
  __contextOptions?: any;
  // Stitch options for cross-field validation - type-safe version
  __stitchOptions?: import("../../../types/stitch-types").TypeSafeStitchOptions<
    any,
    any,
    readonly (import("../../../types/util").NestedKeyOf<any> & string)[]
  >;
  // OrFail condition - updated to support arrayContext
  __condition?: (
    allValues: any,
    arrayContext?: import("../../plugin/types").ArrayContext
  ) => boolean;
}

/**
 * Standard validation method interface
 * Used for: min, max, required, pattern, etc.
 */
export interface StandardValidationMethod<
  TArgs extends any[] = any[],
  TTypes extends readonly TypeName[] = readonly TypeName[],
> {
  <TObject = any>(...args: TArgs): ValidationFunction<TObject, TTypes>;
}

/**
 * Standard plugin implementation helper
 * Supports both legacy function format and new hoisted validator format
 */
export interface StandardPluginImplementation<
  TArgs extends any[] = any[],
  TTypes extends readonly TypeName[] = readonly TypeName[],
> {
  (
    ...args: TArgs
  ):
    | ((
        value: TTypes extends readonly TypeName[]
          ? TTypes[number] extends TypeName
            ? import("../plugins/plugin-types").TypeMapping[TTypes[number]]
            : any
          : any,
        ctx: ValidationContext<any, any>
      ) => PluginValidationResult)
    | ValidatorFormat;
}

/**
 * Conditional validation method interface
 * Used for: requiredIf, optionalIf, skip, validateIf
 */
export interface ConditionalValidationMethod<
  TTypes extends readonly TypeName[] = readonly TypeName[],
  TObjectPlaceholder = unknown,
  TInputPlaceholder = unknown,
> {
  <TObject extends TObjectPlaceholder = any>(
    condition: (allValues: TObject) => boolean,
    options?: ValidationOptions
  ): ValidationFunction<TObject, TTypes>;
}

/**
 * Multi-field reference validation method interface
 * Used for: stitch plugin (cross-field validation with type safety)
 */
export interface MultiFieldReferenceValidationMethod<
  TTypes extends readonly TypeName[] = readonly TypeName[],
  TObjectPlaceholder = unknown,
  TCurrentFieldPlaceholder = unknown,
> {
  <
    TObject extends TObjectPlaceholder = any,
    TCurrentField extends TCurrentFieldPlaceholder = any,
    const TFields extends readonly (NestedKeyOf<TObject> &
      string)[] = readonly (NestedKeyOf<TObject> & string)[],
  >(
    fields: TFields,
    validate: (
      fieldValues: import("../../../types/stitch-types").FieldsToObject<
        TObject,
        TFields
      >,
      currentValue: TCurrentField,
      allValues: TObject
    ) => { valid: boolean; message?: string },
    options?: ValidationOptions & {
      code?: string;
      messageFactory?: (context: {
        path: string;
        value: TCurrentField;
        code: string;
        fields: TFields;
        fieldValues: import("../../../types/stitch-types").FieldsToObject<
          TObject,
          TFields
        >;
        allValues: TObject;
      }) => string;
    }
  ): ValidationFunction<TObject, TTypes>;
}

/**
 * Multi-field reference plugin implementation helper
 * Provides complete type safety for cross-field validation plugins
 */
export interface MultiFieldReferencePluginImplementation<
  TTypes extends readonly TypeName[] = readonly TypeName[],
> {
  <
    TObject = any,
    TCurrentField = any,
    const TFields extends readonly (NestedKeyOf<TObject> &
      string)[] = readonly (NestedKeyOf<TObject> & string)[],
  >(
    fields: TFields,
    validate: (
      fieldValues: import("../../../types/stitch-types").FieldsToObject<
        TObject,
        TFields
      >,
      currentValue: TCurrentField,
      allValues: TObject
    ) => { valid: boolean; message?: string },
    options?: ValidationOptions & {
      code?: string;
      messageFactory?: (context: {
        path: string;
        value: TCurrentField;
        code: string;
        fields: TFields;
        fieldValues: import("../../../types/stitch-types").FieldsToObject<
          TObject,
          TFields
        >;
        allValues: TObject;
      }) => string;
    }
  ): ValidatorFormat;
}

/**
 * Conditional plugin implementation helper
 * Supports both legacy function format and new hoisted validator format
 */
export interface ConditionalPluginImplementation<
  TTypes extends readonly TypeName[] = readonly TypeName[],
> {
  <TObject = any>(
    condition: (
      allValues: TObject,
      arrayContext?: import("../../plugin/types").ArrayContext
    ) => boolean,
    options?: ValidationOptions
  ):
    | ((
        value: TTypes extends readonly TypeName[]
          ? TTypes[number] extends TypeName
            ? import("../plugins/plugin-types").TypeMapping[TTypes[number]]
            : any
          : any,
        ctx: ValidationContext<any, any>
      ) => PluginValidationResult & {
        __skipFurtherValidation?: boolean;
        __skipAllValidation?: boolean;
      })
    | (ValidatorFormat & {
        shouldSkipValidation?: (
          value: any,
          allValues?: any,
          arrayContext?: import("../../plugin/types").ArrayContext
        ) => boolean;
        shouldSkipAllValidation?: (
          value: any,
          allValues?: any,
          arrayContext?: import("../../plugin/types").ArrayContext
        ) => boolean;
        shouldSkipFurtherValidation?: (
          value: any,
          allValues?: any,
          arrayContext?: import("../../plugin/types").ArrayContext
        ) => boolean;
        evaluateCondition?: (
          allValues?: any,
          arrayContext?: import("../../plugin/types").ArrayContext
        ) => boolean;
      });
}

/**
 * Field reference validation method interface
 * Used for: compareField, differentFrom, etc.
 */
export interface FieldReferenceValidationMethod<
  TTypes extends readonly TypeName[] = readonly TypeName[],
  TObjectPlaceholder = unknown,
  TInputPlaceholder = unknown,
> {
  <TObject extends TObjectPlaceholder = any>(
    fieldPath: NestedKeyOf<TObject> & string,
    options?: ValidationOptions
  ): ValidationFunction<TObject, TTypes>;
}

/**
 * Field reference plugin implementation helper
 * Supports both legacy function format and new hoisted validator format
 */
export interface FieldReferencePluginImplementation<
  TTypes extends readonly TypeName[] = readonly TypeName[],
> {
  <TObject = any>(
    fieldPath: NestedKeyOf<TObject> & string,
    options?: ValidationOptions
  ):
    | ((
        value: TTypes extends readonly TypeName[]
          ? TTypes[number] extends TypeName
            ? import("../plugins/plugin-types").TypeMapping[TTypes[number]]
            : any
          : any,
        ctx: ValidationContext<any, any>
      ) => PluginValidationResult)
    | (ValidatorFormat & {
        fieldReference?: {
          fieldPath: string;
          compareFn?: string | ((value: any, targetValue: any) => boolean);
        };
      });
}

/**
 * Transform method interface
 * Used for: transform
 */
export interface TransformValidationMethod<
  TTypes extends readonly TypeName[] = readonly TypeName[],
> {
  <TObject = any, TInput = any, TOutput = any>(
    transformFn: (value: TInput) => TOutput
  ): ValidationFunction<TObject, TTypes>;
}

/**
 * Base transform result with generics
 */
export interface TransformResult<TInput, TOutput>
  extends PluginValidationResult {
  __isTransform: true;
  __transformFn: (value: TInput) => TOutput;
}

/**
 * Predefined transform implementation (e.g., toUpperCase, toLowerCase)
 * No arguments, transform is predefined
 */
export interface PredefinedTransformImplementation<TInput, TOutput> {
  (): (
    value: TInput,
    ctx: ValidationContext<any, any>
  ) => TransformResult<TInput, TOutput>;
}

/**
 * Configurable transform implementation (e.g., toFixed(2), split(','))
 * Takes configuration arguments
 */
export interface ConfigurableTransformImplementation<
  TConfig extends any[],
  TInput,
  TOutput,
> {
  (
    ...config: TConfig
  ): (
    value: TInput,
    ctx: ValidationContext<any, any>
  ) => TransformResult<TInput, TOutput>;
}

/**
 * Generic transform implementation (e.g., transform(fn))
 * Takes a user-defined transform function
 */
export interface GenericTransformImplementation {
  <TInput, TOutput>(
    transformFn: (value: TInput) => TOutput
  ): (
    value: TInput,
    ctx: ValidationContext<any, any>
  ) => TransformResult<TInput, TOutput>;
}

/**
 * Union type for all transform implementations
 * Supports both legacy function format and new hoisted validator format
 */
export type TransformPluginImplementation<TInput = any, TOutput = any> =
  | PredefinedTransformImplementation<TInput, TOutput>
  | ConfigurableTransformImplementation<any[], TInput, TOutput>
  | GenericTransformImplementation
  | (<TInputActual = TInput, TOutputActual = TOutput>(
      transformFn: (value: TInputActual) => TOutputActual,
      options?: ValidationOptions
    ) => ValidatorFormat);

/**
 * Array element validation method interface
 * Used for: includes, excludes
 */
export interface ArrayElementValidationMethod {
  <TObject = any, TElement = any>(
    element: TElement,
    options?: ValidationOptions
  ): ValidationFunction<TObject, readonly ["array"]>;
}

/**
 * Array element plugin implementation helper
 * Supports both legacy function format and new hoisted validator format
 */
export interface ArrayElementPluginImplementation {
  <TElement = any>(
    element: TElement,
    options?: ValidationOptions
  ):
    | ((
        value: TElement[],
        ctx: ValidationContext<any, any>
      ) => PluginValidationResult)
    | ValidatorFormat;
}

/**
 * Plugin category specifications with clear interfaces
 */
export const PluginCategories = {
  /**
   * Standard validation plugins
   * Examples: required, min, max, pattern, email, url
   */
  standard: {
    description: "Basic validation with fixed arguments",
    examples: ["required", "min", "max", "pattern", "email", "url"],
    interface: {} as StandardValidationMethod,
    implementation: {} as StandardPluginImplementation,
  },

  /**
   * Conditional validation plugins
   * Examples: requiredIf, optionalIf, skip, validateIf
   */
  conditional: {
    description: "Validation that depends on other field values",
    examples: ["requiredIf", "optionalIf", "skip", "validateIf"],
    interface: {} as ConditionalValidationMethod,
    implementation: {} as ConditionalPluginImplementation,
  },

  /**
   * Field reference plugins
   * Examples: compareField, differentFrom, greaterThanField
   */
  fieldReference: {
    description: "Validation that compares with other fields",
    examples: ["compareField", "differentFrom", "greaterThanField"],
    interface: {} as FieldReferenceValidationMethod,
    implementation: {} as FieldReferencePluginImplementation,
  },

  /**
   * Transform plugins
   * Examples: transform, parse, format
   */
  transform: {
    description: "Plugins that transform values",
    examples: ["transform", "parse", "format"],
    interface: {} as TransformValidationMethod,
    implementation: {} as TransformPluginImplementation,
  },

  /**
   * Array element plugins
   * Examples: includes, excludes, every, some
   */
  arrayElement: {
    description: "Array-specific validation with element type awareness",
    examples: ["includes", "excludes", "every", "some"],
    interface: {} as ArrayElementValidationMethod,
    implementation: {} as ArrayElementPluginImplementation,
  },

  /**
   * Context-based plugins
   * Examples: fromContext, withAsyncData, crossReference
   */
  context: {
    description: "Validation using external context data (async or sync)",
    examples: ["fromContext", "withAsyncData", "crossReference"],
    interface: {} as ContextValidationMethod,
    implementation: {} as ContextPluginImplementation,
  },

  /**
   * Multi-field reference plugins
   * Examples: stitch (cross-field validation with type safety)
   */
  multiFieldReference: {
    description:
      "Type-safe validation that depends on multiple fields with compile-time field path validation",
    examples: ["stitch", "crossFieldValidation", "conditionalRequirement"],
    interface: {} as MultiFieldReferenceValidationMethod,
    implementation: {} as MultiFieldReferencePluginImplementation,
  },
} as const;

/**
 * Helper type to get implementation type from category
 */
export type GetImplementationType<
  TCategory extends keyof typeof PluginCategories,
> = (typeof PluginCategories)[TCategory]["implementation"];

/**
 * Helper type to get interface type from category
 */
export type GetInterfaceType<TCategory extends keyof typeof PluginCategories> =
  (typeof PluginCategories)[TCategory]["interface"];

// ========================================
// Context-based Plugin Types
// ========================================

/**
 * Context validation method interface
 * Used for: fromContext, withAsyncData, crossReference
 */
export interface ContextValidationMethod<
  TTypes extends readonly TypeName[] = readonly TypeName[],
> {
  <TObject = any, TContext = any>(
    contextOptions: ContextValidationOptions<TContext>
  ): ValidationFunction<TObject, TTypes>;
}

/**
 * Context validation options
 */
export interface ContextValidationOptions<TContext = any> {
  /**
   * Validation function that receives value, context data, and allValues
   */
  validate: (
    value: any,
    context: TContext,
    allValues: any
  ) => {
    valid: boolean;
    message?: string;
  };

  /** Custom error message */
  errorMessage?: string;

  /** Error code for validation issues */
  code?: string;

  /** Whether context data is required (default: false) */
  required?: boolean;

  /** Whether to return valid when context is unavailable (default: true) */
  fallbackToValid?: boolean;
}

/**
 * Context plugin implementation helper
 * Supports both legacy function format and new hoisted validator format
 */
export interface ContextPluginImplementation<
  TTypes extends readonly TypeName[] = readonly TypeName[],
> {
  <TContext = any>(
    options: ContextValidationOptions<TContext>
  ):
    | ((
        value: TTypes extends readonly TypeName[]
          ? TTypes[number] extends TypeName
            ? import("../plugins/plugin-types").TypeMapping[TTypes[number]]
            : any
          : any,
        ctx: ValidationContext<any, any>
      ) => PluginValidationResult)
    | (ValidatorFormat & {
        fromContext?: {
          options: ContextValidationOptions<TContext>;
          required: boolean;
          fallbackToValid: boolean;
          errorMessage?: string;
          performContextValidation: (value: any, ctx: any) => any;
        };
      });
}

/**
 * Preprocessor validation method interface
 * Used for: coerce, default, preprocess
 */
export interface PreprocessorValidationMethod<
  TTypes extends readonly TypeName[] = readonly TypeName[],
> {
  <TObject = any>(): any;
}

/**
 * Preprocessor plugin implementation helper
 * Supports both legacy function format and new hoisted validator format
 */
export interface PreprocessorPluginImplementation<
  TTypes extends readonly TypeName[] = readonly TypeName[],
> {
  (...args: any[]):
    | ((value: any, ctx?: ValidationContext<any, any>) => any)
    | (ValidatorFormat & {
        coerce?: {
          targetType: string;
          coerceFn: (value: any) => any;
          options?: ValidationOptions;
        };
        default?: {
          defaultValue: any;
          options?: ValidationOptions;
          applyDefault: (value: any, ctx: any) => any;
        };
        preprocess?: {
          preprocessFn: (value: any) => any;
          options?: ValidationOptions;
          applyPreprocess: (value: any, ctx: any) => any;
        };
      });
}
