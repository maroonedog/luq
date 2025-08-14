/**
 * Type-safe Stitch Plugin with explicit type signatures
 */

import { plugin } from "../builder/plugins/plugin-creator";
import { createBatchAccessors } from "./utils/field-accessor";
import { NestedKeyOf } from "./types";
import {
  TypeSafeStitchOptions,
  FieldsToObject,
} from "../../types/stitch-types";
import { ValidatorFormat } from "../builder/plugins/plugin-interfaces";

// Error code
const ERROR_CODE = "stitch_validation_failed";

// Supported types
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
 * Create a type-safe stitch validator
 * This function preserves all generic type parameters
 */
export function createStitchValidator<
  TObject,
  TCurrentField,
  const TFields extends readonly (NestedKeyOf<TObject> & string)[],
>(
  options: TypeSafeStitchOptions<TObject, TCurrentField, TFields>
): ValidatorFormat {
  const fields = options.fields as readonly string[];
  const validate = options.validate;
  const code = options.code || ERROR_CODE;
  const messageFactory = options.messageFactory;

  // Pre-create accessors
  const fieldAccessors = createBatchAccessors(fields as string[]);

  return {
    check: (value: any, allValues?: any) => {
      if (!allValues) return false;

      // Collect field values with proper types
      const fieldValues = {} as FieldsToObject<TObject, TFields>;

      for (let i = 0; i < fieldAccessors.length; i++) {
        const { fieldName, accessor } = fieldAccessors[i];
        (fieldValues as any)[fieldName] = accessor(allValues);
      }

      // Call validate with proper types
      const result = validate(
        fieldValues,
        value as TCurrentField,
        allValues as TObject
      );

      return result.valid;
    },

    code: code,

    getErrorMessage: (value: any, path: string, allValues?: any) => {
      if (!allValues)
        return "Cross-field validation failed - no form data available";

      const fieldValues = {} as FieldsToObject<TObject, TFields>;
      for (let i = 0; i < fieldAccessors.length; i++) {
        const { fieldName, accessor } = fieldAccessors[i];
        (fieldValues as any)[fieldName] = accessor(allValues);
      }

      const result = validate(
        fieldValues,
        value as TCurrentField,
        allValues as TObject
      );

      if (result.message) {
        return result.message;
      }

      if (messageFactory) {
        return messageFactory({
          path,
          value: value as TCurrentField,
          code,
          fields: fields as TFields,
          fieldValues,
          allValues: allValues as TObject,
        });
      }

      return `Cross-field validation failed for ${path}`;
    },

    params: [options],
    __isStitch: true,
  };
}

/**
 * Stitch plugin with proper type inference
 */
export const stitchPluginTyped = plugin({
  name: "stitch",
  methodName: "stitch",
  allowedTypes: supportedTypes,
  category: "multiFieldReference" as const,
  impl: createStitchValidator as any,
});
