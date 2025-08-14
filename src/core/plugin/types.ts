import { NestedKeyOf } from "../../types";
import { TypeName, TypeMapping } from "../builder/plugins/plugin-types";

// Re-export NestedKeyOf for use in plugin-interfaces
export { NestedKeyOf };

// =============================================================================
// CORE TYPE DEFINITIONS
// =============================================================================

// Helper type to extract the actual types from TypeName array
export type ExtractTypes<T extends readonly TypeName[]> =
  TypeMapping[T[number]];

export const SEVERITY = {
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
} as const;

export type Severity = (typeof SEVERITY)[keyof typeof SEVERITY];

/**
 * Zod-style issue factory for generating validation errors
 * @param ctx - Context object containing field path, value, and other metadata
 * @returns Error message string
 */
export type MessageFactory<TContext extends Record<string, any> = {}> = (
  ctx: MessageContext & TContext
) => string;

/**
 * Base context provided to all issue factories
 */
export interface MessageContext {
  path: string;
  value: any;
  code: string;
}

export interface ValidationOptions<TContext extends Record<string, any> = {}> {
  code?: string;
  fieldName?: string;
  severity?: Severity;
  // Zod-style issue factory with type-safe context
  messageFactory?: MessageFactory<TContext>;
}

export interface RecursiveContext<TObject = any> {
  currentDepth: number;
  rootObject: TObject;
  parent?: any;
  current: any;
}

export interface ValidationContext<TObject, TInput> {
  originalValue: TInput;
  currentValue: TInput;
  allValues: TObject;
  path: string;
  recursiveContext?: RecursiveContext<TObject>;
}

/**
 * Context provided to conditional validation functions when validating array items
 * Contains information about the current array index and the object at that index
 */
export interface ArrayContext<TItem = any> {
  /** The current index in the array */
  index: number;
  /** The object at the current index */
  item: TItem;
  /** The full array being validated */
  array: TItem[];
}

export interface ValidationFunctionReturnType {
  valid: boolean;
  message?: string;
}

// Alias for backward compatibility
export type ValidationResult = ValidationFunctionReturnType;

export interface TransformFunctionReturnType<TOutput>
  extends ValidationFunctionReturnType {
  transformData?: TOutput;
}

export type ValidationFunction<
  TObject,
  TInputTypes extends readonly TypeName[] | TypeName,
> = (
  value: TInputTypes extends readonly TypeName[]
    ? TInputTypes[number] extends TypeName
      ? import("../builder/plugins/plugin-types").TypeMapping[TInputTypes[number]]
      : never
    : TInputTypes extends TypeName
      ? import("../builder/plugins/plugin-types").TypeMapping[TInputTypes]
      : never,
  ctx: ValidationContext<
    TObject,
    TInputTypes extends readonly TypeName[] ? TInputTypes[number] : TInputTypes
  >
) => ValidationFunctionReturnType;

export type TransformFunction<
  TObject,
  TInputTypes extends readonly TypeName[] | TypeName,
> = <TOutput>(
  value: TInputTypes extends readonly TypeName[]
    ? TInputTypes[number] extends TypeName
      ? import("../builder/plugins/plugin-types").TypeMapping[TInputTypes[number]]
      : any
    : TInputTypes extends TypeName
      ? import("../builder/plugins/plugin-types").TypeMapping[TInputTypes]
      : any,
  ctx: ValidationContext<
    TObject,
    TInputTypes extends readonly TypeName[] ? TInputTypes[number] : TInputTypes
  >
) => TransformFunctionReturnType<TOutput>;

// =============================================================================
// SPECIAL FLAGS AND CONTROL FLOW
// =============================================================================

/**
 * Indicates that all remaining validations should be skipped
 * Used by: validateIf, skip
 */
export interface SkipAllValidationFlag {
  __skipAllValidation: true;
}

/**
 * Indicates that further validations should be skipped (but not transforms)
 * Used by: optional, optionalIf
 */
export interface SkipFurtherValidationFlag {
  __skipFurtherValidation: true;
}

/**
 * Indicates that this is a transform operation
 * Used by: transform
 */
export interface TransformFlag<TOutput = any> {
  __isTransform: true;
  __transformFn: (value: any) => TOutput;
}

/**
 * Indicates that the field is nullable
 * Used by: nullable
 */
export interface NullableFlag {
  __isNullable: true;
}

/**
 * Indicates that the validation should be recursive
 * Used by: objectRecursively
 */
export interface RecursiveFlag {
  __isRecursive: true;
}

/**
 * Combined validation result with optional flags
 */
export type ValidationResultWithFlags<TFlags = {}> =
  ValidationFunctionReturnType & TFlags;

/**
 * Helper type to create validation results with flags
 */
export type WithFlags<TFlags> = {
  valid: boolean;
  message?: string;
} & TFlags;

/**
 * Type guards for checking flags
 */
export const ValidationFlags = {
  isSkipAll(
    result: any
  ): result is ValidationResultWithFlags<SkipAllValidationFlag> {
    return result && result.__skipAllValidation === true;
  },

  isSkipFurther(
    result: any
  ): result is ValidationResultWithFlags<SkipFurtherValidationFlag> {
    return result && result.__skipFurtherValidation === true;
  },

  isTransform(result: any): result is ValidationResultWithFlags<TransformFlag> {
    return (
      result &&
      result.__isTransform === true &&
      typeof result.__transformFn === "function"
    );
  },

  isNullable(result: any): result is ValidationResultWithFlags<NullableFlag> {
    return result && result.__isNullable === true;
  },

  isRecursive(result: any): result is ValidationResultWithFlags<RecursiveFlag> {
    return result && result.__isRecursive === true;
  },
};

// =============================================================================
// CONDITIONAL PLUGIN TYPES
// =============================================================================

/**
 * Conditional method signature that preserves the TObject type
 */
export type ConditionalMethod<TObject = any> = {
  validateIf?: (
    condition: (allValues: TObject, arrayContext?: ArrayContext) => boolean,
    options?: ValidationOptions
  ) => ValidationFunction<any, any>;

  requiredIf?: (
    condition: (allValues: TObject, arrayContext?: ArrayContext) => boolean,
    options?: ValidationOptions
  ) => ValidationFunction<any, any>;

  optionalIf?: (
    condition: (allValues: TObject, arrayContext?: ArrayContext) => boolean,
    options?: ValidationOptions
  ) => ValidationFunction<any, any>;

  skip?: (
    condition: (allValues: TObject, arrayContext?: ArrayContext) => boolean,
    options?: ValidationOptions
  ) => ValidationFunction<any, any>;
};

/**
 * Type helper to create properly typed conditional plugin methods
 */
export type WithConditionalMethods<
  TMethods extends Record<string, any>,
  TObject,
> = {
  [K in keyof TMethods]: K extends keyof ConditionalMethod<TObject>
    ? ConditionalMethod<TObject>[K]
    : TMethods[K];
};

/**
 * Type for validateIf plugin methods
 */
export type ValidateIfMethods<TObject = any> = {
  validateIf: (
    condition: (allValues: TObject, arrayContext?: ArrayContext) => boolean,
    options?: ValidationOptions
  ) => ValidationFunction<any, any>;
};
