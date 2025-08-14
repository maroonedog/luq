/**
 * Minimal type definitions - only exports actually used in the codebase
 * Optimized for bundle size by removing unused complex type definitions
 */

import { NestedKeyOf, TypeOfPath, ElementType } from "./util";
import { Result, LuqValidationException } from "./result";

// Re-export core types that are actually used
export { Result, LuqValidationException };

/**
 * Validation result interface - used in builder/types.ts
 */
export type ValidationResult<T> = {
  valid: boolean;
  value: T | null;
  errors: ValidationError[];
  originalValue?: T;
};

/**
 * Validation error interface - used in plugin-registry.ts
 */
export type ValidationError = {
  path: string;
  message: string;
  code: string;
  paths(): string[];
};

/**
 * Message factory type - used in reporter.ts and plugin/types.ts
 * Import from plugin/types for consistent definition
 */
import type { MessageFactory } from "../core/plugin/types";
export type { MessageFactory };

/**
 * Validation options - used in registry and plugin-types
 */
export type ValidationOptions = {
  /** Abort validation on first error (default: true) */
  abortEarly?: boolean;
  /** Abort validation on each field's first error (default: true) */
  abortEarlyOnEachField?: boolean;
  /** Custom message factory for error messages */
  messageFactory?: MessageFactory;
  /** Translation function for i18n support */
  translate?: (key: string, params?: Record<string, any>) => string;
  /** Context data passed to validators */
  context?: Record<string, any>;
};

/**
 * Parse options - used in registry and plugin-types
 */
export type ParseOptions = {
  /** Abort parsing on first error (default: true) */
  abortEarly?: boolean;
  /** Abort parsing on each field's first error (default: true) */
  abortEarlyOnEachField?: boolean;
  /** Custom message factory for error messages */
  messageFactory?: MessageFactory;
  /** Translation function for i18n support */
  translate?: (key: string, params?: Record<string, any>) => string;
  /** Context data passed to validators */
  context?: Record<string, any>;
  /** Custom transform functions for post-processing */
  transforms?: Record<string, (value: any) => any>;
};

// Re-export utility types - used in multiple places
export { NestedKeyOf, TypeOfPath, ElementType };

/**
 * Union to intersection utility type - used in plugin/types.ts
 */
export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

/**
 * Validator interface - simplified version for compatibility
 */
export interface Validator<T> {
  validate(value: unknown): ValidationResult<T>;
}
