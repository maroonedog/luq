/**
 * Core Validation Engine
 * Integrated validation execution engine - eliminates duplicate logic
 */

import { createFieldAccessor } from "./field-utils";
export interface ValidationError {
  path: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ParseResult extends ValidationResult {
  data?: any;
}

export interface ValidationContext {
  originalValue: any;
  currentValue: any;
  allValues: any;
  path: string;
  arrayContext?: import("../../plugin/types").ArrayContext;
}

export interface ValidatorFunction {
  check: (
    value: any,
    allValues?: any,
    arrayContext?: import("../../plugin/types").ArrayContext
  ) => boolean;
  code?: string;
  pluginName?: string;
  getErrorMessage?: (
    value: any,
    path: string,
    allValues?: any,
    arrayContext?: import("../../plugin/types").ArrayContext
  ) => string;
  messageFactory?: (context: any) => string;
  params?: any[];
  metadata?: {
    type?: string;
    category?: string;
    [key: string]: any;
  };
}

export interface TransformFunction {
  apply?: (value: any, context?: any) => any;
  transformFn?: (value: any) => any;
  (value: any): any;
}

export interface ValidationField {
  path: string;
  validators: ValidatorFunction[];
  transforms: TransformFunction[];
}

// === Private helper functions ===

/**
 * Execute validator (normalized common logic)
 */
function executeValidator(
  validator: ValidatorFunction,
  value: any,
  context: ValidationContext
): boolean {
  const checkFn = validator.check;

  if (typeof checkFn !== "function") {
    throw new Error(`Invalid validator: check function is not defined`);
  }

  try {
    return checkFn(value, context.allValues, context.arrayContext);
  } catch (error) {
    // Validator execution error - treat as validation failure
    return false;
  }
}

/**
 * Issue params extraction
 */
function extractIssueParams(
  validator: ValidatorFunction,
  value: any
): Record<string, any> {
  const params = validator.params || [];

  // Extract common parameters based on validator type
  if (params.length > 0) {
    const firstParam = params[0];

    if (typeof firstParam === "number") {
      return {
        expected: firstParam,
        actual: typeof value === "string" ? value.length : value,
      };
    }

    if (typeof firstParam === "string") {
      return {
        pattern: firstParam,
        expected: firstParam,
      };
    }
  }

  return {};
}

/**
 * Create validation error (integrated error handling)
 */
function createValidationError(
  validator: ValidatorFunction,
  value: any,
  context: ValidationContext
): ValidationError {
  const code = validator.code || validator.pluginName || "VALIDATION_ERROR";
  let message = "Validation failed";

  // Error message generation (duplicated logic)
  try {
    if (validator.getErrorMessage) {
      message = validator.getErrorMessage(
        value,
        context.path,
        context.allValues,
        context.arrayContext
      );
    } else if (validator.messageFactory) {
      const issueContext = {
        path: context.path,
        value,
        code,
        ...extractIssueParams(validator, value),
      };
      message = validator.messageFactory(issueContext);
    }
  } catch (error) {
    // Fallback to default message if error generation fails
    message = `Validation failed for ${context.path}`;
  }

  return {
    path: context.path,
    code,
    message,
  };
}

/**
 * Transform function 正規化
 */
function normalizeTransformFunction(
  transform: TransformFunction
): (value: any, context?: any) => any {
  if (typeof transform === "function") {
    return transform;
  }

  // Type guard for object with apply property
  const transformObj = transform as {
    apply?: (value: any, context?: any) => any;
    transformFn?: (value: any) => any;
  };

  if (transformObj.apply && typeof transformObj.apply === "function") {
    return transformObj.apply;
  }

  if (
    transformObj.transformFn &&
    typeof transformObj.transformFn === "function"
  ) {
    return transformObj.transformFn;
  }

  throw new Error("Invalid transform function");
}

/**
 * Field value getter (integrated path parsing)
 */
function getFieldValue(obj: any, path: string): any {
  if (!path.includes(".")) {
    return obj?.[path];
  }

  // V8 Optimization: Inline simple 2-level access
  const dotIndex = path.indexOf(".");
  if (dotIndex > 0 && path.indexOf(".", dotIndex + 1) === -1) {
    // Exactly one dot - optimize for common case
    const key1 = path.substring(0, dotIndex);
    const key2 = path.substring(dotIndex + 1);
    return obj?.[key1]?.[key2];
  }

  // Use optimized pre-compiled accessor for complex paths
  const accessor = createFieldAccessor(path);
  return accessor(obj);
}

/**
 * Field value setter (integrated path parsing)
 */
function setFieldValue(obj: any, path: string, value: any): void {
  if (!path.includes(".")) {
    if (obj != null) obj[path] = value;
    return;
  }

  // This function is kept for backward compatibility but uses path.split
  // New code should use scoped setters from the engine
  const segments = path.split(".");
  const lastIndex = segments.length - 1;
  let current = obj;
  for (let i = 0; i < lastIndex; i++) {
    const segment = segments[i];
    if (!current[segment]) {
      current[segment] = {};
    }
    current = current[segment];
  }
  current[segments[lastIndex]] = value;
}

/**
 * Deep clone (for data transformation)
 */
function deepClone(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime());

  // V8 Optimization: Handle arrays with traditional for loop
  if (Array.isArray(obj)) {
    const len = obj.length;
    const cloned = new Array(len);
    for (let i = 0; i < len; i++) {
      cloned[i] = deepClone(obj[i]);
    }
    return cloned;
  }

  // V8 Optimization: Use Object.keys for better performance
  const cloned: any = {};
  const keys = Object.keys(obj);
  const keysLen = keys.length;
  for (let i = 0; i < keysLen; i++) {
    const key = keys[i];
    cloned[key] = deepClone(obj[key]);
  }
  return cloned;
}

// === Public functions ===
/**
 * Execute validation for single field
 */
export function validateField(
  field: ValidationField,
  value: any,
  context: ValidationContext,
  options: { abortEarly?: boolean } = {}
): ValidationResult {
  const { abortEarly = true } = options;
  const validatorsLength = field.validators.length;

  // Fast path: no validators
  if (validatorsLength === 0) {
    return { valid: true, errors: [] };
  }

  // Fast path: single validator
  if (validatorsLength === 1) {
    const validator = field.validators[0];
    const checkFn = validator.check;

    if (typeof checkFn !== "function") {
      throw new Error(`Invalid validator: check function is not defined`);
    }

    try {
      const isValid = checkFn(value, context.allValues, context.arrayContext);
      if (isValid) {
        return { valid: true, errors: [] };
      }

      return {
        valid: false,
        errors: [createValidationError(validator, value, context)],
      };
    } catch (error) {
      return {
        valid: false,
        errors: [createValidationError(validator, value, context)],
      };
    }
  }

  const errors: ValidationError[] = [];

  // Check for skip conditions first using metadata-based approach
  for (let i = 0; i < validatorsLength; i++) {
    const validator = field.validators[i];

    // Check if this is a skip validator using metadata
    if (
      validator.metadata?.type === "conditional" &&
      validator.metadata?.category === "skip"
    ) {
      // For skip validators, if check returns true, skip all further validation
      const checkFn = validator.check;
      if (typeof checkFn === "function") {
        try {
          if (checkFn(value, context.allValues, context.arrayContext)) {
            return { valid: true, errors: [] };
          }
        } catch (error) {
          // Skip validator failed, continue validation
        }
      }
    }
  }

  // Validator execution loop with inlined executeValidator for performance
  for (let i = 0; i < validatorsLength; i++) {
    const validator = field.validators[i];
    const checkFn = validator.check;

    if (typeof checkFn !== "function") {
      throw new Error(`Invalid validator: check function is not defined`);
    }

    let isValid = false;
    try {
      isValid = checkFn(value, context.allValues, context.arrayContext);
    } catch (error) {
      // Validator execution error - treat as validation failure
      isValid = false;
    }

    if (!isValid) {
      errors.push(createValidationError(validator, value, context));

      if (abortEarly) {
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Batch validation for multiple fields
 */
export function validateBatch(
  fields: ValidationField[],
  values: any,
  options: { abortEarly?: boolean; abortEarlyOnEachField?: boolean } = {}
): ValidationResult {
  const { abortEarly = false, abortEarlyOnEachField = true } = options;
  const allErrors: ValidationError[] = [];

  const fieldsLength = fields.length;
  for (let i = 0; i < fieldsLength; i++) {
    const field = fields[i];
    const fieldValue = getFieldValue(values, field.path);
    const context: ValidationContext = {
      originalValue: fieldValue,
      currentValue: fieldValue,
      allValues: values,
      path: field.path,
    };

    const result = validateField(field, fieldValue, context, {
      abortEarly: abortEarlyOnEachField,
    });

    if (!result.valid) {
      allErrors.push(...result.errors);

      if (abortEarly) {
        break;
      }
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Parse field (validation + transform)
 */
export function parseField(
  field: ValidationField,
  value: any,
  context: ValidationContext,
  options: { abortEarly?: boolean } = {}
): ParseResult {
  const { abortEarly = true } = options;

  // First validate
  const validationResult = validateField(field, value, context, { abortEarly });

  if (!validationResult.valid) {
    return {
      valid: false,
      errors: validationResult.errors,
    };
  }

  // Then apply transforms
  let transformedValue = value;
  try {
    transformedValue = applyTransforms(field.transforms, value, context);
  } catch (error) {
    return {
      valid: false,
      errors: [
        {
          path: context.path,
          code: "TRANSFORM_ERROR",
          message: `Transform failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
    };
  }

  return {
    valid: true,
    data: transformedValue,
    errors: [],
  };
}

/**
 * Batch parse multiple fields
 */
export function parseBatch(
  fields: ValidationField[],
  values: any,
  options: { abortEarly?: boolean; abortEarlyOnEachField?: boolean } = {}
): ParseResult {
  const { abortEarly = false, abortEarlyOnEachField = true } = options;
  const allErrors: ValidationError[] = [];
  const transformedData = deepClone(values);

  const fieldsForParseLength = fields.length;
  for (let i = 0; i < fieldsForParseLength; i++) {
    const field = fields[i];
    const fieldValue = getFieldValue(values, field.path);
    const context: ValidationContext = {
      originalValue: fieldValue,
      currentValue: fieldValue,
      allValues: values,
      path: field.path,
    };

    const result = parseField(field, fieldValue, context, {
      abortEarly: abortEarlyOnEachField,
    });

    if (!result.valid) {
      allErrors.push(...result.errors);

      if (abortEarly) {
        break;
      }
    } else if (result.data !== undefined) {
      setFieldValue(transformedData, field.path, result.data);
    }
  }

  return {
    valid: allErrors.length === 0,
    data: allErrors.length === 0 ? transformedData : undefined,
    errors: allErrors,
  };
}

/**
 * Apply transform (logic duplicated across all files)
 */
export function applyTransforms(
  transforms: TransformFunction[],
  value: any,
  context: ValidationContext
): any {
  let currentValue = value;

  // V8 Optimization: Traditional for loop instead of for...of
  const transformsLength = transforms.length;
  for (let i = 0; i < transformsLength; i++) {
    // Transform function normalization (duplicated logic)
    const transformFn = normalizeTransformFunction(transforms[i]);
    currentValue = transformFn(currentValue, context);
  }

  return currentValue;
}

/**
 * Hoisted validation (for high-speed validation)
 */
export function validateHoisted(
  field: ValidationField,
  value: any,
  allValues: any,
  abortEarlyOnEachField: boolean = true,
  arrayContext?: import("../../plugin/types").ArrayContext
): {
  valid: boolean;
  errorIndices?: number[];
} {
  const validatorsLength = field.validators.length;

  // Fast path: no validators
  if (validatorsLength === 0) {
    return { valid: true };
  }

  // Fast path: single validator
  if (validatorsLength === 1) {
    const checkFn = field.validators[0].check;
    if (typeof checkFn !== "function") {
      return { valid: false, errorIndices: [0] };
    }

    try {
      const isValid = checkFn(value, allValues, arrayContext);
      return isValid ? { valid: true } : { valid: false, errorIndices: [0] };
    } catch (error) {
      return { valid: false, errorIndices: [0] };
    }
  }

  // Multiple validators - optimize for abort early case
  if (abortEarlyOnEachField) {
    for (let i = 0; i < validatorsLength; i++) {
      const checkFn = field.validators[i].check;
      if (typeof checkFn !== "function") {
        return { valid: false, errorIndices: [i] };
      }

      let isValid = false;
      try {
        isValid = checkFn(value, allValues, arrayContext);
      } catch (error) {
        isValid = false;
      }

      if (!isValid) {
        return { valid: false, errorIndices: [i] };
      }
    }
    return { valid: true };
  }

  // Collect all errors
  const errorIndices: number[] = [];
  for (let i = 0; i < validatorsLength; i++) {
    const checkFn = field.validators[i].check;
    if (typeof checkFn !== "function") {
      errorIndices.push(i);
      continue;
    }

    let isValid = false;
    try {
      isValid = checkFn(value, allValues, arrayContext);
    } catch (error) {
      isValid = false;
    }

    if (!isValid) {
      errorIndices.push(i);
    }
  }

  return errorIndices.length === 0
    ? { valid: true }
    : { valid: false, errorIndices };
}

/**
 * Rebuild errors (for hoisted validation)
 */
export function reconstructErrors(
  field: ValidationField,
  errorIndices: number[],
  value: any,
  allValues: any,
  arrayContext?: import("../../plugin/types").ArrayContext
): ValidationError[] {
  const context: ValidationContext = {
    originalValue: value,
    currentValue: value,
    allValues,
    path: field.path,
    arrayContext,
  };

  return errorIndices
    .filter((index) => index < field.validators.length)
    .map((index) => {
      const validator = field.validators[index];
      return createValidationError(validator, value, context);
    });
}

/**
 * ValidationEngine interface for compatibility
 */
export interface ValidationEngine {
  validateField: typeof validateField;
  validateBatch: typeof validateBatch;
  parseField: typeof parseField;
  parseBatch: typeof parseBatch;
  applyTransforms: typeof applyTransforms;
  validateHoisted: typeof validateHoisted;
  reconstructErrors: typeof reconstructErrors;
}

/**
 * Create a ValidationEngine object with all functions
 */
function createEngine(): ValidationEngine {
  // Create engine-scoped caches to prevent memory leaks
  const localSetterCache = new Map<string, (obj: any, value: any) => void>();

  // Closure-based setter factory scoped to this engine
  const createScopedFieldSetter = (
    path: string
  ): ((obj: any, value: any) => void) => {
    let setter = localSetterCache.get(path);
    if (!setter) {
      if (!path.includes(".")) {
        setter = (obj: any, value: any) => {
          if (obj != null) obj[path] = value;
        };
      } else {
        const segments = path.split(".");
        const lastIndex = segments.length - 1;
        setter = (obj: any, value: any) => {
          let current = obj;
          for (let i = 0; i < lastIndex; i++) {
            const segment = segments[i];
            if (!current[segment]) {
              current[segment] = {};
            }
            current = current[segment];
          }
          current[segments[lastIndex]] = value;
        };
      }
      localSetterCache.set(path, setter);
    }
    return setter;
  };

  // Scoped field value setter using engine-scoped cache
  const setScopedFieldValue = (obj: any, path: string, value: any): void => {
    if (!path.includes(".")) {
      if (obj != null) obj[path] = value;
      return;
    }

    const setter = createScopedFieldSetter(path);
    setter(obj, value);
  };

  // Create scoped versions of validation functions
  const scopedParseBatch = (
    fields: ValidationField[],
    values: any,
    options: { abortEarly?: boolean; abortEarlyOnEachField?: boolean } = {}
  ): ParseResult => {
    const { abortEarly = false, abortEarlyOnEachField = true } = options;
    const allErrors: ValidationError[] = [];
    const transformedData = deepClone(values);

    const fieldsForParseLength = fields.length;
    for (let i = 0; i < fieldsForParseLength; i++) {
      const field = fields[i];
      const fieldValue = getFieldValue(values, field.path);
      const context: ValidationContext = {
        originalValue: fieldValue,
        currentValue: fieldValue,
        allValues: values,
        path: field.path,
      };

      const result = parseField(field, fieldValue, context, {
        abortEarly: abortEarlyOnEachField,
      });

      if (!result.valid) {
        allErrors.push(...result.errors);

        if (abortEarly) {
          break;
        }
      } else if (result.data !== undefined) {
        setScopedFieldValue(transformedData, field.path, result.data);
      }
    }

    return {
      valid: allErrors.length === 0,
      data: allErrors.length === 0 ? transformedData : undefined,
      errors: allErrors,
    };
  };

  return {
    validateField,
    validateBatch,
    parseField,
    parseBatch: scopedParseBatch, // Use scoped version
    applyTransforms,
    validateHoisted,
    reconstructErrors,
  };
}

/**
 * シングルトンエンジンインスタンス
 */
let engineInstance: ValidationEngine | null = null;

/**
 * 共有エンジンインスタンス取得
 */
export function getValidationEngine(): ValidationEngine {
  if (!engineInstance) {
    engineInstance = createEngine();
  }
  return engineInstance;
}

/**
 * Create new engine instance (for testing)
 */
export function createValidationEngine(): ValidationEngine {
  return createEngine();
}
