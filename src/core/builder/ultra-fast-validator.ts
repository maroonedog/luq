/**
 * Ultra-fast validator implementation for 1M+ ops/sec
 * Bypasses Result wrapper and all unnecessary abstractions
 */

import { UnifiedValidator } from "../optimization/unified-validator";
import { createNestedValueAccessor } from "../plugin/utils/field-accessor";
import { DOT } from "../../constants";

// V8 optimization: Pre-allocated success/error results to avoid object creation
// Note: We use any to avoid strict type issues with reusable objects
const SUCCESS_RESULT = { valid: true, value: null as any };
const ERROR_RESULT = { valid: false, error: null as any };

export interface UltraFastValidator<T> {
  validate(value: T): { valid: boolean; value?: T; error?: any };
  parse(value: T): { valid: boolean; value?: T; error?: any };
}

/**
 * Create ultra-fast validator for single field
 * Eliminates ALL unnecessary overhead
 */
export function createUltraFastSingleFieldValidator<
  T extends Record<string, any>,
>(fieldPath: string, validator: UnifiedValidator): UltraFastValidator<T> {
  // Pre-compile field accessor
  const accessor = fieldPath.includes(DOT)
    ? createNestedValueAccessor(fieldPath)
    : (obj: any) => obj[fieldPath];

  // Pre-allocate transformed object template
  const transformTemplate = {} as T;

  return {
    validate: (value: T) => {
      if (value == null) {
        ERROR_RESULT.error = "Value is required";
        return ERROR_RESULT;
      }

      const fieldValue = accessor(value);
      const result = validator.validate(fieldValue, value);

      if (!result.valid) {
        ERROR_RESULT.error = result.errors[0];
        return ERROR_RESULT;
      }

      SUCCESS_RESULT.value = value as any;
      return SUCCESS_RESULT;
    },

    parse: (value: T) => {
      if (value == null) {
        ERROR_RESULT.error = "Value is required";
        return ERROR_RESULT;
      }

      const fieldValue = accessor(value);
      const result = validator.parse(fieldValue, value);

      if (!result.valid) {
        ERROR_RESULT.error = result.errors[0];
        return ERROR_RESULT;
      }

      // V8 optimization: Direct mutation instead of spread
      if (result.data !== undefined && result.data !== fieldValue) {
        // Reuse object instead of creating new one
        Object.assign(transformTemplate, value);
        setFieldValue(transformTemplate, fieldPath, result.data);
        SUCCESS_RESULT.value = transformTemplate as any;
        return SUCCESS_RESULT;
      }

      SUCCESS_RESULT.value = value as any;
      return SUCCESS_RESULT;
    },
  };
}

/**
 * Create ultra-fast validator for multiple fields
 * Specialized for 2-5 fields (most common cases)
 */
export function createUltraFastMultiFieldValidator<
  T extends Record<string, any>,
>(
  fields: Array<{ path: string; validator: UnifiedValidator }>
): UltraFastValidator<T> {
  const fieldCount = fields.length;

  // Pre-compile all accessors
  const accessors = fields.map((f) => ({
    path: f.path,
    accessor: f.path.includes(DOT)
      ? createNestedValueAccessor(f.path)
      : (obj: any) => obj[f.path],
    validator: f.validator,
  }));

  // Generate specialized validators based on field count
  if (fieldCount === 2) {
    // Special case: 2 fields (very common)
    const [field1, field2] = accessors;

    return {
      validate: (value: T) => {
        if (value == null) {
          ERROR_RESULT.error = "Value is required";
          return ERROR_RESULT;
        }

        // Field 1
        const value1 = field1.accessor(value);
        const result1 = field1.validator.validate(value1, value);
        if (!result1.valid) {
          ERROR_RESULT.error = result1.errors[0];
          return ERROR_RESULT;
        }

        // Field 2
        const value2 = field2.accessor(value);
        const result2 = field2.validator.validate(value2, value);
        if (!result2.valid) {
          ERROR_RESULT.error = result2.errors[0];
          return ERROR_RESULT;
        }

        SUCCESS_RESULT.value = value as any;
        return SUCCESS_RESULT;
      },

      parse: (value: T) => {
        if (value == null) {
          ERROR_RESULT.error = "Value is required";
          return ERROR_RESULT;
        }

        let transformed = value;
        let hasTransform = false;

        // Field 1
        const value1 = field1.accessor(value);
        const result1 = field1.validator.parse(value1, value);
        if (!result1.valid) {
          ERROR_RESULT.error = result1.errors[0];
          return ERROR_RESULT;
        }

        if (result1.data !== undefined && result1.data !== value1) {
          if (!hasTransform) {
            transformed = { ...value };
            hasTransform = true;
          }
          setFieldValue(transformed, field1.path, result1.data);
        }

        // Field 2
        const value2 = field2.accessor(transformed);
        const result2 = field2.validator.parse(value2, transformed);
        if (!result2.valid) {
          ERROR_RESULT.error = result2.errors[0];
          return ERROR_RESULT;
        }

        if (result2.data !== undefined && result2.data !== value2) {
          if (!hasTransform) {
            transformed = { ...value };
            hasTransform = true;
          }
          setFieldValue(transformed, field2.path, result2.data);
        }

        SUCCESS_RESULT.value = transformed as any;
        return SUCCESS_RESULT;
      },
    };
  }

  // General case
  return {
    validate: (value: T) => {
      if (value == null) {
        ERROR_RESULT.error = "Value is required";
        return ERROR_RESULT;
      }

      for (let i = 0; i < fieldCount; i++) {
        const field = accessors[i];
        const fieldValue = field.accessor(value);
        const result = field.validator.validate(fieldValue, value);

        if (!result.valid) {
          ERROR_RESULT.error = result.errors[0];
          return ERROR_RESULT;
        }
      }

      SUCCESS_RESULT.value = value as any;
      return SUCCESS_RESULT;
    },

    parse: (value: T) => {
      if (value == null) {
        ERROR_RESULT.error = "Value is required";
        return ERROR_RESULT;
      }

      let transformed = value;
      let hasTransform = false;

      for (let i = 0; i < fieldCount; i++) {
        const field = accessors[i];
        const fieldValue = field.accessor(transformed);
        const result = field.validator.parse(fieldValue, transformed);

        if (!result.valid) {
          ERROR_RESULT.error = result.errors[0];
          return ERROR_RESULT;
        }

        if (result.data !== undefined && result.data !== fieldValue) {
          if (!hasTransform) {
            transformed = { ...value };
            hasTransform = true;
          }
          setFieldValue(transformed, field.path, result.data);
        }
      }

      SUCCESS_RESULT.value = transformed as any;
      return SUCCESS_RESULT;
    },
  };
}

/**
 * Optimized field value setter
 */
function setFieldValue(obj: any, path: string, value: any): void {
  if (!path.includes(DOT)) {
    obj[path] = value;
    return;
  }

  const parts = path.split(DOT);
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part]) current[part] = {};
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}
