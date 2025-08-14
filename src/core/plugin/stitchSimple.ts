import { plugin } from "../builder/plugins/plugin-creator";
import {
  ValidationOptions,
  NestedKeyOf,
} from "./types";
import { createBatchAccessors } from "./utils/field-accessor";
import { FieldsToObject } from "../../types/stitch-types";
import { ValidatorFormat } from "../builder/plugins/plugin-interfaces";

// Local error code
const ERROR_CODE = "stitch_validation_failed";

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
 * Simplified stitch implementation with better type inference
 * 
 * Arguments:
 * 1. fields: Array of field paths to extract
 * 2. validate: Validation function that receives the extracted field values
 * 3. options: Optional configuration (error code, issue factory, etc.)
 */
function stitchSimpleImpl<
  TObject,
  TCurrentField,
  const TFields extends readonly (NestedKeyOf<TObject> & string)[]
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
  // Pre-create accessors for performance
  const fieldAccessors = createBatchAccessors([...fields] as string[]);
  const code = options?.code || ERROR_CODE;
  const messageFactory = options?.messageFactory;

  return {
    check: (value: any, allValues?: any) => {
      if (!allValues) return false;

      // Collect field values
      const fieldValues = {} as FieldsToObject<TObject, TFields>;
      for (let i = 0; i < fieldAccessors.length; i++) {
        const { fieldName, accessor } = fieldAccessors[i];
        (fieldValues as any)[fieldName] = accessor(allValues);
      }

      // Run validation
      const result = validate(fieldValues, value as TCurrentField, allValues as TObject);
      return result.valid;
    },

    code: code,

    getErrorMessage: (value: any, path: string, allValues?: any) => {
      if (!allValues) return "Cross-field validation failed - no form data available";

      // Collect field values
      const fieldValues = {} as FieldsToObject<TObject, TFields>;
      for (let i = 0; i < fieldAccessors.length; i++) {
        const { fieldName, accessor } = fieldAccessors[i];
        (fieldValues as any)[fieldName] = accessor(allValues);
      }

      // Get validation result
      const result = validate(fieldValues, value as TCurrentField, allValues as TObject);
      
      if (result.message) {
        return result.message;
      }

      if (messageFactory) {
        return messageFactory({
          path,
          value: value as TCurrentField,
          code,
          fields,
          fieldValues,
          allValues: allValues as TObject,
        });
      }

      return `Cross-field validation failed for ${path}`;
    },

    params: [fields, validate, options],
  };
}

/**
 * Export the simplified stitch plugin
 */
export const stitchSimplePlugin = plugin({
  name: "stitch",
  methodName: "stitch",
  allowedTypes: supportedTypes,
  category: "multiFieldReference" as const,
  impl: stitchSimpleImpl as any,
});