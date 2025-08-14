/**
 * Advanced type utilities for Stitch plugin - Multi-field reference type safety
 */

import { NestedKeyOf, TypeOfPath } from "./util";

/**
 * Extract field types from an array of field paths into a typed object
 * 
 * @example
 * ```typescript
 * type UserForm = { name: string; age: number; email: string; }
 * type Fields = ["name", "age"]
 * type Result = FieldsToObject<UserForm, Fields>
 * // Result: { name: string; age: number; }
 * ```
 */
export type FieldsToObject<
  T,
  K extends readonly (NestedKeyOf<T> & string)[]
> = {
  [P in K[number]]: TypeOfPath<T, P>
}

/**
 * More precise tuple-based field extraction for better type inference
 * Preserves the exact relationship between field positions and types
 */
export type TupleFieldsToObject<
  T,
  K extends readonly [...(NestedKeyOf<T> & string)[]]
> = {
  [Index in keyof K as K[Index] extends string ? K[Index] : never]: 
    K[Index] extends NestedKeyOf<T> & string
      ? TypeOfPath<T, K[Index]>
      : never
}

/**
 * Type-safe Stitch validation function
 * - First argument: Object containing only the specified field values with correct types
 * - Second argument: Current field value with its inferred type
 * - Third argument: Complete form object with full type safety
 */
export type StitchValidationFn<
  TObject,
  TCurrentField,
  TFields extends readonly (NestedKeyOf<TObject> & string)[]
> = (
  fieldValues: FieldsToObject<TObject, TFields>,
  currentValue: TCurrentField,
  allValues: TObject
) => {
  valid: boolean;
  message?: string;
}

/**
 * Type-safe Stitch plugin options with complete type inference
 */
export type TypeSafeStitchOptions<
  TObject,
  TCurrentField,
  TFields extends readonly (NestedKeyOf<TObject> & string)[]
> = {
  /** 
   * Array of field paths - constrained to valid nested keys of TObject
   * Must be readonly tuple for precise type inference
   */
  fields: TFields;
  
  /** 
   * Validation function with full type safety:
   * - fieldValues: Extracted field types as typed object
   * - currentValue: Current field's value with correct type
   * - allValues: Complete form object
   */
  validate: StitchValidationFn<TObject, TCurrentField, TFields>;
  
  /** Optional custom error code */
  code?: string;
  
  /** 
   * Optional custom error message factory with field context
   */
  messageFactory?: (context: {
    path: string;
    value: TCurrentField;
    code: string;
    fields: TFields;
    fieldValues: FieldsToObject<TObject, TFields>;
    allValues: TObject;
  }) => string;
}

/**
 * Helper type to validate that all fields exist in the object type
 * Provides compile-time validation of field paths
 */
export type ValidateFieldPaths<
  T,
  K extends readonly string[]
> = K extends readonly [...infer Fields]
  ? Fields extends readonly (NestedKeyOf<T> & string)[]
    ? K
    : never
  : never

/**
 * Utility type for creating strongly typed field references
 * Ensures all field paths are valid at compile time
 */
export type CreateStitchOptions<T, TCurrentField> = <
  const TFields extends readonly (NestedKeyOf<T> & string)[]
>(
  options: TypeSafeStitchOptions<T, TCurrentField, TFields>
) => TypeSafeStitchOptions<T, TCurrentField, TFields>

// Export helper function for creating type-safe stitch options
export const createStitchOptions = <T, TCurrentField>(): CreateStitchOptions<T, TCurrentField> => {
  return <const TFields extends readonly (NestedKeyOf<T> & string)[]>(
    options: TypeSafeStitchOptions<T, TCurrentField, TFields>
  ) => options;
}

/**
 * Example usage and type validation:
 * 
 * ```typescript
 * type EventForm = {
 *   startDate: string;
 *   endDate: string;
 *   eventDate: string;
 *   price: number;
 *   quantity: number;
 *   taxRate?: number;
 * }
 * 
 * // Type-safe usage
 * const eventDateValidator = Builder()
 *   .use(stitchPlugin)
 *   .for<EventForm>()
 *   .v("eventDate", (b) => b.string.required().stitch({
 *     fields: ["startDate", "endDate"] as const, // ← readonly tuple for exact inference
 *     validate: (fieldValues, eventDate, allValues) => {
 *       // fieldValues: { startDate: string; endDate: string; }
 *       // eventDate: string
 *       // allValues: EventForm
 *       
 *       const event = new Date(eventDate);
 *       const start = new Date(fieldValues.startDate); // ← Type-safe access
 *       const end = new Date(fieldValues.endDate);     // ← Type-safe access
 *       
 *       // Can access any field from allValues with full type safety
 *       const taxRate = allValues.taxRate ?? 0; // ← Optional field handling
 *       
 *       return {
 *         valid: event >= start && event <= end,
 *         message: event < start 
 *           ? "Event date cannot be before start date"
 *           : "Event date cannot be after end date"
 *       };
 *     }
 *   }))
 *   .build();
 * ```
 */