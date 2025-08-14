/**
 * Raw validator interface that completely bypasses Result wrapper
 * For maximum performance (1M+ ops/sec)
 */

import { UnifiedValidator } from "../optimization/unified-validator";
import { Result } from "../../types/result";
import { ValidationOptions, ParseOptions } from "./plugins/plugin-types";
import {
  createFieldAccessor,
  createFieldSetter,
} from "../plugin/utils/field-accessor-optimized";

export interface RawParseResult<T> {
  valid: boolean;
  data?: T;
  error?: any;
}

export interface RawValidator<T> {
  validateRaw(value: T, options?: ValidationOptions): boolean;
  parseRaw(value: T, options?: ParseOptions): RawParseResult<T>;
  // Compatibility methods that wrap with Result
  validate(value: T, options?: ValidationOptions): Result<T>;
  parse(value: T, options?: ParseOptions): Result<T>;
}

/**
 * Create raw validator that bypasses Result wrapper completely
 */
export function createRawValidator<T extends Record<string, any>>(
  validators: Map<string, UnifiedValidator>
): RawValidator<T> {
  const entries = Array.from(validators);
  const count = entries.length;

  if (count === 0) {
    return {
      validateRaw: () => true,
      parseRaw: (value) => ({ valid: true, data: value }),
      validate: (value) => Result.ok(value),
      parse: (value) => Result.ok(value),
    };
  }

  if (count === 1) {
    // Single field - ultra optimized
    const [fieldPath, validator] = entries[0];
    const isSimplePath = !fieldPath.includes(".");

    // Pre-compile accessor and setter even for single field
    const accessor = isSimplePath ? null : createFieldAccessor(fieldPath);
    const setter = isSimplePath ? null : createFieldSetter(fieldPath);

    return {
      validateRaw: (value: T, options?: ValidationOptions) => {
        if (!value) return false;
        const fieldValue = isSimplePath
          ? (value as any)[fieldPath]
          : accessor!(value);
        const result = validator.validate(fieldValue, value, options);
        return result.valid;
      },

      parseRaw: (value: T, options?: ParseOptions) => {
        if (!value) return { valid: false, error: "Value required" };

        const fieldValue = isSimplePath
          ? (value as any)[fieldPath]
          : accessor!(value);
        const result = validator.parse(fieldValue, value, options);

        if (!result.valid) {
          return { valid: false, error: result.errors[0] };
        }

        if (result.data !== undefined && result.data !== fieldValue) {
          // Always create new object for immutability
          const transformed = { ...value };
          if (isSimplePath) {
            (transformed as any)[fieldPath] = result.data;
          } else {
            setter!(transformed, result.data);
          }
          return { valid: true, data: transformed };
        }

        return { valid: true, data: value };
      },

      validate: (value: T, options?: ValidationOptions) => {
        if (!value)
          return Result.error([
            {
              path: "",
              message: "Value required",
              code: "REQUIRED",
              paths: () => [""],
            },
          ]);

        const fieldValue = isSimplePath
          ? (value as any)[fieldPath]
          : accessor!(value);
        const result = validator.validate(fieldValue, value, options);

        if (!result.valid) {
          const errors = result.errors.map((e) => ({
            path: e.path,
            code: e.code,
            message: e.message,
            paths: () => [e.path],
          }));
          return Result.error(errors);
        }

        return Result.ok(value);
      },

      parse: function (value: T, options?: ParseOptions): Result<T> {
        const rawResult = this.parseRaw(value, options);
        if (!rawResult.valid) {
          return Result.error([rawResult.error]);
        }
        return Result.ok(rawResult.data);
      },
    };
  }

  // Multiple fields
  if (count <= 3) {
    // Optimize for 2-3 fields
    return createOptimizedMultiFieldRawValidator<T>(entries);
  }

  // General case
  return createGeneralRawValidator<T>(entries);
}

/**
 * Optimized validator for 2-3 fields
 */
function createOptimizedMultiFieldRawValidator<T>(
  entries: Array<[string, UnifiedValidator]>
): RawValidator<T> {
  // Pre-compute accessors AND setters during validator creation (build-time)
  const fields = entries.map(([path, validator]) => ({
    path,
    isSimple: !path.includes("."),
    accessor: !path.includes(".") ? null : createFieldAccessor(path), // Pre-computed accessor
    setter: !path.includes(".") ? null : createFieldSetter(path), // Pre-computed setter
    validator,
  }));

  // Sort fields: simple paths first for better early exit opportunities
  fields.sort((a, b) => {
    if (a.isSimple && !b.isSimple) return -1;
    if (!a.isSimple && b.isSimple) return 1;
    return 0;
  });

  return {
    validateRaw: (value: T) => {
      if (!value) return false;

      // Manually unrolled for 2-3 fields for maximum performance
      if (fields.length === 2) {
        const field0 = fields[0];
        const field1 = fields[1];

        const value0 = field0.isSimple
          ? (value as any)[field0.path]
          : field0.accessor!(value);
        if (!field0.validator.validate(value0, value).valid) return false;

        const value1 = field1.isSimple
          ? (value as any)[field1.path]
          : field1.accessor!(value);
        if (!field1.validator.validate(value1, value).valid) return false;

        return true;
      } else if (fields.length === 3) {
        const field0 = fields[0];
        const field1 = fields[1];
        const field2 = fields[2];

        const value0 = field0.isSimple
          ? (value as any)[field0.path]
          : field0.accessor!(value);
        if (!field0.validator.validate(value0, value).valid) return false;

        const value1 = field1.isSimple
          ? (value as any)[field1.path]
          : field1.accessor!(value);
        if (!field1.validator.validate(value1, value).valid) return false;

        const value2 = field2.isSimple
          ? (value as any)[field2.path]
          : field2.accessor!(value);
        if (!field2.validator.validate(value2, value).valid) return false;

        return true;
      }

      // Fallback for edge cases - use traditional for loop
      const len = fields.length;
      for (let i = 0; i < len; i++) {
        const field = fields[i];
        const fieldValue = field.isSimple
          ? (value as any)[field.path]
          : field.accessor!(value);
        if (!field.validator.validate(fieldValue, value).valid) return false;
      }

      return true;
    },

    parseRaw: (value: T) => {
      if (!value) return { valid: false, error: "Value required" };

      let hasTransform = false;
      let transformed = value;

      // Manually unrolled for 2-3 fields for maximum performance
      if (fields.length === 2) {
        const field0 = fields[0];
        const field1 = fields[1];

        const value0 = field0.isSimple
          ? (transformed as any)[field0.path]
          : field0.accessor!(transformed);
        const result0 = field0.validator.parse(value0, transformed);
        if (!result0.valid) return { valid: false, error: result0.errors[0] };

        if (result0.data !== undefined && result0.data !== value0) {
          if (!hasTransform) {
            transformed = { ...value };
            hasTransform = true;
          }
          if (field0.isSimple) {
            (transformed as any)[field0.path] = result0.data;
          } else {
            field0.setter!(transformed, result0.data);
          }
        }

        const value1 = field1.isSimple
          ? (transformed as any)[field1.path]
          : field1.accessor!(transformed);
        const result1 = field1.validator.parse(value1, transformed);
        if (!result1.valid) return { valid: false, error: result1.errors[0] };

        if (result1.data !== undefined && result1.data !== value1) {
          if (!hasTransform) {
            transformed = { ...value };
            hasTransform = true;
          }
          if (field1.isSimple) {
            (transformed as any)[field1.path] = result1.data;
          } else {
            field1.setter!(transformed, result1.data);
          }
        }
      } else if (fields.length === 3) {
        const field0 = fields[0];
        const field1 = fields[1];
        const field2 = fields[2];

        const value0 = field0.isSimple
          ? (transformed as any)[field0.path]
          : field0.accessor!(transformed);
        const result0 = field0.validator.parse(value0, transformed);
        if (!result0.valid) return { valid: false, error: result0.errors[0] };

        if (result0.data !== undefined && result0.data !== value0) {
          if (!hasTransform) {
            transformed = { ...value };
            hasTransform = true;
          }
          if (field0.isSimple) {
            (transformed as any)[field0.path] = result0.data;
          } else {
            field0.setter!(transformed, result0.data);
          }
        }

        const value1 = field1.isSimple
          ? (transformed as any)[field1.path]
          : field1.accessor!(transformed);
        const result1 = field1.validator.parse(value1, transformed);
        if (!result1.valid) return { valid: false, error: result1.errors[0] };

        if (result1.data !== undefined && result1.data !== value1) {
          if (!hasTransform) {
            transformed = { ...value };
            hasTransform = true;
          }
          if (field1.isSimple) {
            (transformed as any)[field1.path] = result1.data;
          } else {
            field1.setter!(transformed, result1.data);
          }
        }

        const value2 = field2.isSimple
          ? (transformed as any)[field2.path]
          : field2.accessor!(transformed);
        const result2 = field2.validator.parse(value2, transformed);
        if (!result2.valid) return { valid: false, error: result2.errors[0] };

        if (result2.data !== undefined && result2.data !== value2) {
          if (!hasTransform) {
            transformed = { ...value };
            hasTransform = true;
          }
          if (field2.isSimple) {
            (transformed as any)[field2.path] = result2.data;
          } else {
            field2.setter!(transformed, result2.data);
          }
        }
      } else {
        // Fallback for edge cases - use traditional for loop
        const len = fields.length;
        for (let i = 0; i < len; i++) {
          const field = fields[i];
          const fieldValue = field.isSimple
            ? (transformed as any)[field.path]
            : field.accessor!(transformed);

          const result = field.validator.parse(fieldValue, transformed);

          if (!result.valid) {
            return { valid: false, error: result.errors[0] };
          }

          if (result.data !== undefined && result.data !== fieldValue) {
            if (!hasTransform) {
              transformed = { ...value };
              hasTransform = true;
            }

            if (field.isSimple) {
              (transformed as any)[field.path] = result.data;
            } else {
              field.setter!(transformed, result.data);
            }
          }
        }
      }

      return { valid: true, data: transformed };
    },

    validate: function (value: T) {
      if (!this.validateRaw(value)) {
        // Simplified error for speed
        return Result.error([
          {
            path: "",
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            paths: () => [""],
          },
        ]);
      }
      return Result.ok(value);
    },

    parse: function (value: T) {
      const rawResult = this.parseRaw(value);
      if (!rawResult.valid) {
        return Result.error([rawResult.error]);
      }
      return Result.ok(rawResult.data!);
    },
  };
}

/**
 * General validator for many fields
 */
function createGeneralRawValidator<T>(
  entries: Array<[string, UnifiedValidator]>
): RawValidator<T> {
  // Pre-compute accessors AND setters during validator creation (build-time)
  const fields = entries.map(([path, validator]) => ({
    path,
    isSimple: !path.includes("."),
    accessor: !path.includes(".") ? null : createFieldAccessor(path), // Pre-computed accessor
    setter: !path.includes(".") ? null : createFieldSetter(path), // Pre-computed setter
    validator,
  }));

  // Sort fields: simple paths first for better cache locality and early exits
  fields.sort((a, b) => {
    if (a.isSimple && !b.isSimple) return -1;
    if (!a.isSimple && b.isSimple) return 1;
    return 0;
  });

  return {
    validateRaw: (value: T) => {
      if (!value) return false;

      // Traditional for loop is faster than for...of in V8
      const len = fields.length;
      for (let i = 0; i < len; i++) {
        const field = fields[i];
        const fieldValue = field.isSimple
          ? (value as any)[field.path]
          : field.accessor!(value);
        const result = field.validator.validate(fieldValue, value);
        if (!result.valid) return false;
      }

      return true;
    },

    parseRaw: (value: T) => {
      if (!value) return { valid: false, error: "Value required" };

      let transformed = value;
      let hasTransform = false;

      // Traditional for loop is faster than for...of in V8
      const len = fields.length;
      for (let i = 0; i < len; i++) {
        const field = fields[i];
        const fieldValue = field.isSimple
          ? (transformed as any)[field.path]
          : field.accessor!(transformed);
        const result = field.validator.parse(fieldValue, transformed);

        if (!result.valid) {
          return { valid: false, error: result.errors[0] };
        }

        if (result.data !== undefined && result.data !== fieldValue) {
          if (!hasTransform) {
            transformed = { ...value };
            hasTransform = true;
          }

          if (field.isSimple) {
            (transformed as any)[field.path] = result.data;
          } else {
            field.setter!(transformed, result.data);
          }
        }
      }

      return { valid: true, data: transformed };
    },

    validate: function (value: T) {
      return this.validateRaw(value)
        ? Result.ok(value)
        : Result.error([
            {
              path: "",
              code: "VALIDATION_ERROR",
              message: "Validation failed",
              paths: () => [""],
            },
          ]);
    },

    parse: function (value: T) {
      const rawResult = this.parseRaw(value);
      return rawResult.valid
        ? Result.ok(rawResult.data!)
        : Result.error([rawResult.error]);
    },
  };
}
