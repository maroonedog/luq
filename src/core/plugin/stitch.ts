import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, NestedKeyOf } from "./types";
import { createBatchAccessors } from "./utils/field-accessor";
import { FieldsToObject } from "../../types/stitch-types";
import { ValidatorFormat } from "../builder/plugins/plugin-interfaces";

// Local error code
const ERROR_CODE = "stitch_validation_failed";

// V8 Optimization: Module-level constants

// Types that stitch can be applied to - all types supported
const supportedTypes = [
  "string",
  "number",
  "boolean",
  "date",
  "object",
  "array",
  "tuple",
  "union",
] as const;

/**
 * @luq-plugin
 * @name stitch
 * @category multiFieldReference
 * @description Validates a field based on multiple other fields' values (cross-field validation) with full type safety
 * @allowedTypes ["string", "number", "boolean", "date", "object", "array", "tuple", "union"]
 * @example
 * ```typescript
 * // Type-safe date range validation
 * type EventForm = {
 *   startDate: string;
 *   endDate: string;
 *   eventDate: string;
 * };
 *
 * const validator = Builder()
 *   .use(stitchPlugin)
 *   .for<EventForm>()
 *   .v("eventDate", (b) => b.string.required().stitch(
 *     ["startDate", "endDate"] as const, // First arg: field names
 *     (fieldValues, eventDate) => {      // Second arg: validation function
 *       // fieldValues: { startDate: string; endDate: string; } ← Type-safe!
 *       // eventDate: string ← Current field's type
 *
 *       const event = new Date(eventDate);
 *       const start = new Date(fieldValues.startDate);
 *       const end = new Date(fieldValues.endDate);
 *
 *       return {
 *         valid: event >= start && event <= end,
 *         message: event < start
 *           ? "Event date cannot be before start date"
 *           : "Event date cannot be after end date"
 *       };
 *     }
 *   ))
 *   .build();
 *
 * // Price calculation with type-safe field access
 * type OrderForm = {
 *   price: number;
 *   quantity: number;
 *   discount: number;
 *   total: number;
 * };
 *
 * builder.v("total", (b) => b.number.required().stitch(
 *   ["price", "quantity", "discount"] as const,
 *   (fieldValues, total) => {
 *     // fieldValues: { price: number; quantity: number; discount: number; }
 *     const calculated = fieldValues.price * fieldValues.quantity * (1 - fieldValues.discount);
 *     return {
 *       valid: Math.abs(total - calculated) < 0.01,
 *       message: `Expected ${calculated.toFixed(2)}, got ${total}`
 *     };
 *   },
 *   { // Third arg: optional configuration
 *     code: "TOTAL_MISMATCH",
 *     messageFactory: ({ fieldValues, value }) =>
 *       `Total ${value} doesn't match calculation`
 *   }
 * ))
 * ```
 * @params
 * - fields: readonly (NestedKeyOf<TObject> & string)[] - Array of field paths to extract
 * - validate: (fieldValues, currentValue, allValues) => ValidationResult - Validation function
 * - options?: { code?, messageFactory? } - Optional configuration
 * @returns Type-safe validation function for multi-field validation
 * @since 0.1.0-alpha
 */
// Simplified stitch implementation with better type inference
function stitchImpl<
  TObject = any,
  TCurrentField = any,
  const TFields extends readonly (NestedKeyOf<TObject> &
    string)[] = readonly (NestedKeyOf<TObject> & string)[],
>(
  fields: TFields,
  validate: (
    fieldValues: FieldsToObject<TObject, TFields>,
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
      fieldValues: FieldsToObject<TObject, TFields>;
      allValues: TObject;
    }) => string;
  }
): ValidatorFormat {
  // V8 Optimization: Pre-compute ALL values in curry phase
  const code = options?.code || ERROR_CODE;
  const messageFactory = options?.messageFactory;

  // Pre-create accessors for all field paths using shared utility
  const fieldAccessors = createBatchAccessors([...fields]);

  // Return hoisted validator format
  return {
    check: (value: any, allValues?: any) => {
      // Stitch plugin requires allValues for cross-field validation
      if (!allValues) return false;

      // Collect all field values using pre-created accessors
      const fieldValues: Record<string, any> = {};

      for (let i = 0; i < fieldAccessors.length; i++) {
        const { fieldName, accessor } = fieldAccessors[i];
        fieldValues[fieldName] = accessor(allValues);
      }

      // Run the validation function with complete type safety
      // fieldValues: extracted field types
      // value: current field's inferred type
      // allValues: complete form type
      const result = validate(
        fieldValues as FieldsToObject<TObject, TFields>,
        value as TCurrentField,
        allValues as TObject
      );

      return result.valid;
    },

    code: code,

    getErrorMessage: (value: any, path: string, allValues?: any) => {
      if (!allValues)
        return "Cross-field validation failed - no form data available";

      // Collect field values for error message
      const fieldValues: Record<string, any> = {};
      for (let i = 0; i < fieldAccessors.length; i++) {
        const { fieldName, accessor } = fieldAccessors[i];
        fieldValues[fieldName] = accessor(allValues);
      }

      // Run validation to get result message with type safety
      const result = validate(
        fieldValues as FieldsToObject<TObject, TFields>,
        value as TCurrentField,
        allValues as TObject
      );

      if (result.message) {
        return result.message;
      }

      // Use custom issue factory if provided with enhanced context
      if (messageFactory) {
        return messageFactory({
          path,
          value: value as TCurrentField,
          code,
          fields,
          fieldValues: fieldValues as FieldsToObject<TObject, TFields>,
          allValues: allValues as TObject,
        });
      }

      return `Cross-field validation failed for ${path}`;
    },

    params: [fields, validate, options],
  };
}

export const stitchPlugin = plugin({
  name: "stitch",
  methodName: "stitch",
  allowedTypes: supportedTypes,
  category: "multiFieldReference" as const,
  impl: stitchImpl as any, // Cast to any to preserve generic type parameters
});
