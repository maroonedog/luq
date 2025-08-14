/**
 * Shared constants for all plugins
 * V8 Optimization: Frozen objects for better performance
 */

// Common validation results - frozen for V8 optimization
export const VALID_RESULT = Object.freeze({ valid: true });
export const INVALID_RESULT = Object.freeze({ valid: false });

// Common error severity
export const ERROR_SEVERITY = "ERROR" as const;


/**
 * Common error codes
 */
export const ErrorCodes = {
  // Value validation
  MIN_VALUE: "min_value",
  MAX_VALUE: "max_value",
  MIN_LENGTH: "min_length",
  MAX_LENGTH: "max_length",
  EXACT_LENGTH: "exact_length",
  RANGE: "range",
  
  // Type validation
  REQUIRED: "required",
  INVALID_TYPE: "invalid_type",
  INVALID_FORMAT: "invalid_format",
  
  // String specific
  INVALID_EMAIL: "invalid_email",
  INVALID_URL: "invalid_url",
  INVALID_UUID: "invalid_uuid",
  INVALID_DATETIME: "invalid_datetime",
  INVALID_PATTERN: "invalid_pattern",
  
  // Number specific
  NOT_INTEGER: "not_integer",
  NOT_FINITE: "not_finite",
  NOT_POSITIVE: "not_positive",
  NOT_NEGATIVE: "not_negative",
  NOT_MULTIPLE: "not_multiple",
  
  // Array specific
  NOT_UNIQUE: "not_unique",
  MISSING_REQUIRED: "missing_required",
  
  // Boolean specific
  NOT_TRUTHY: "not_truthy",
  NOT_FALSY: "not_falsy",
  
  // Field reference
  NOT_EQUAL: "not_equal",
  
  // Generic
  VALIDATION_ERROR: "validation_error",
} as const;

/**
 * Type for error codes
 */
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];