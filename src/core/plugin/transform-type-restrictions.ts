/**
 * Transform type restriction utilities
 * Due to nested array support implementation, transform of Array<object> and Array<union>
 * is no longer supported, so we restrict it at the type level.
 */

/**
 * Type helper to determine if a value is an object type
 * Only targets plain objects that are not primitives
 */
type IsObject<T> = T extends Record<string, any>
  ? T extends readonly any[]
    ? false
    : T extends (...args: any[]) => any
    ? false
    : T extends Date
    ? false
    : T extends RegExp
    ? false
    : T extends Error
    ? false
    : T extends Promise<any>
    ? false
    : T extends string
    ? false
    : T extends number
    ? false
    : T extends boolean
    ? false
    : T extends null
    ? false
    : T extends undefined
    ? false
    : true
  : false;

/**
 * Type helper to determine if it's a Union type
 * Uses the properties of distributive conditional types for detection
 */
type IsUnionType<T, U = T> = T extends any 
  ? [U] extends [T] 
    ? false 
    : true 
  : false;

/**
 * Determine if a union type contains objects
 * Uses a safer approach
 */
type UnionContainsObject<T> = [T] extends [any] 
  ? T extends any
    ? IsObject<T> extends true
      ? true
      : never
    : never
  : never;

// Determine if true is included in the Union result
type HasTrueInUnion<T> = T extends never 
  ? false 
  : T extends true 
  ? true 
  : false;

/**
 * Use distributive conditional types to check if Union elements are plain objects
 * Result becomes boolean union (e.g., false | true)
 */
type UnionMemberCheck<T> = T extends any
  ? T extends Record<string, any>
    ? T extends (...args: any[]) => any
      ? false  // Exclude functions
      : T extends readonly any[]
      ? false  // Exclude arrays
      : T extends Date
      ? false  // Exclude Date
      : T extends RegExp
      ? false  // Exclude RegExp
      : T extends string | number | boolean | null | undefined
      ? false  // Exclude primitives
      : true   // Detect plain object
    : false
  : false;

/**
 * Accurately determine if a Union type contains plain objects
 * If true is included in the result, it's a Union containing plain objects
 */
type UnionHasPlainObject<T> = true extends UnionMemberCheck<T> ? true : false;

/**
 * More accurate approach: Detect Union type first then process
 */
type ArrayElementIsObjectOrUnion<T> = T extends readonly (infer U)[]
  ? // First check if it's a Union type (Union types are detected with distributive conditional types)
    IsUnionType<U> extends true
      ? // For Union types: check if they contain plain objects
        UnionHasPlainObject<U> extends true
        ? true  // Union containing plain objects (restricted)
        : false // Union not containing plain objects (allowed)
      : // For non-Union types: check if directly plain object
        U extends Record<string, any>
        ? U extends (...args: any[]) => any
          ? false // Functions are allowed
          : U extends readonly any[]
          ? false // Arrays are allowed
          : U extends Date
          ? false // Date is allowed
          : U extends RegExp
          ? false // RegExp is allowed  
          : U extends string | number | boolean | null | undefined
          ? false // Primitives are allowed
          : true // Plain objects are restricted
        : false // Allowed when not Record<string, any>
  : false;

/**
 * Determine if the type is forbidden as a Transform return value
 */
export type IsForbiddenTransformOutput<T> = T extends readonly any[]
  ? ArrayElementIsObjectOrUnion<T> extends true
    ? true
    : false
  : false;

/**
 * Concise and clear English instruction message for forbidden Transform return types
 * Includes specific instructions displayed in TypeScript errors
 */
export type ForbiddenTransformError<T> = 
  T extends readonly (infer U)[]
    ? U extends Record<string, any>
      ? U extends (...args: any[]) => any | readonly any[] | Date | RegExp
        ? never  // Functions, arrays, Date, RegExp are actually allowed
        : `🚫 FORBIDDEN: Cannot transform to Array<object>. Use Array<primitive> instead. Example: .transform(arr => arr.map(s => s.toUpperCase())) returns string[]`
      : `🚫 FORBIDDEN: Cannot transform to Array<union with object>. Use Array<primitive> instead. Example: .transform(arr => arr.map(s => s.length)) returns number[]`
    : never;

/**
 * Conditional type to validate Transform function return type
 */
export type ValidateTransformOutput<T> = IsForbiddenTransformOutput<T> extends true
  ? ForbiddenTransformError<T>
  : T;

/**
 * Safe Transform function type definition
 * Returns error type for forbidden return types, otherwise returns normal function type
 */
export type SafeTransformFunction<TInput, TOutput> = IsForbiddenTransformOutput<TOutput> extends true
  ? ForbiddenTransformError<TOutput>
  : (value: TInput) => TOutput;

/**
 * More direct type checking used in actual plugin implementations
 */
export type RestrictedTransformFunction<TInput = any, TOutput = any> = 
  // Return error type for Array<object> or Array<union>
  TOutput extends readonly any[] 
    ? ArrayElementIsObjectOrUnion<TOutput> extends true
      ? ForbiddenTransformError<TOutput>
      : (value: TInput) => TOutput
    : (value: TInput) => TOutput;

/**
 * Utility type for displaying Transform function type check results
 */
export type CheckTransformFunction<F> = F extends (value: any) => infer R
  ? IsForbiddenTransformOutput<R> extends true
    ? {
        _status: "❌ FORBIDDEN";
        _type: R;
        _error: ForbiddenTransformError<R>;
      }
    : {
        _status: "✅ ALLOWED";
        _type: R;
      }
  : {
      _status: "❓ UNKNOWN";
      _error: "Not a valid transform function";
    };