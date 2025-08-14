/**
 * Essential constants - optimized for minimal bundle size
 * Only contains constants that are actively used in the codebase
 */

// Common separators - used in field path navigation
export const DOT = ".";

// Validation modes - used throughout validation engine
export const VALIDATE_MODE = "validate" as const;
export const PARSE_MODE = "parse" as const;
export type ValidationMode = typeof VALIDATE_MODE | typeof PARSE_MODE;

/**
 * Base message parameters for validation errors
 */
export interface BaseMessageParams {
  path: string;
  value?: any;
}

/**
 * Extended message parameters with validation-specific properties
 */
export interface ValidationMessageParams extends BaseMessageParams {
  expected?: any;
  actual?: any;
  min?: number;
  max?: number;
  pattern?: string;
  code?: string;
  [key: string]: any;
}
