/**
 * fromContext plugin - Generic context-based validation
 *
 * A generic plugin that can uniformly handle async contexts,
 * allValues, and other context data
 */

import { getAsyncContext, getAsyncContextValue } from "./async-context";
import type { ValidationContext, ValidationOptions } from "../plugin/types";

/**
 * Configuration options for fromContext plugin
 */
interface FromContextOptions<TContext = any> {
  /** Validation function */
  validate: (
    value: any,
    context: TContext,
    allValues: any
  ) => {
    valid: boolean;
    message?: string;
  };

  /** Custom error message */
  errorMessage?: string;

  /** Required flag (behavior when context is not available) */
  required?: boolean;

  /** Default behavior when context is not available */
  fallbackToValid?: boolean;
}

/**
 * Type-safe fromContext options
 */
interface TypedFromContextOptions<
  TValue,
  TContext extends Record<string, any>,
> {
  /** Type-safe validation function */
  validate: (
    value: TValue,
    context: TContext,
    allValues: any
  ) => {
    valid: boolean;
    message?: string;
  };

  /** Custom error message */
  errorMessage?: string;

  /** Required flag */
  required?: boolean;

  /** Fallback behavior */
  fallbackToValid?: boolean;
}

/**
 * fromContext plugin - Basic version
 */
export const fromContextPlugin = {
  name: "fromContext",
  methodName: "fromContext",
  allowedTypes: ["string", "number", "boolean", "object", "array"] as const,
  pluginType: "validation" as const,
  category: "context" as const,

  createMethod:
    () =>
    <TContext = any>(options: FromContextOptions<TContext>) => ({
      validationFunction: (
        value: any,
        context: ValidationContext<any, any>
      ) => {
        // Prioritize getting async context
        const asyncContext = getAsyncContext(context as any);
        const allValues = context.allValues;

        // Select context
        let contextData: TContext | undefined = asyncContext as TContext;

        // Use allValues when async context is not available
        if (!contextData && !options.required) {
          contextData = allValues as TContext;
        }

        // When context is not available
        if (!contextData) {
          if (options.required) {
            return {
              valid: false,
              message: options.errorMessage || "Context data is required",
            };
          }

          return {
            valid: options.fallbackToValid !== false, // Default is true
          };
        }

        // Execute validation
        try {
          const result = options.validate(value, contextData, allValues);
          return {
            valid: result.valid,
            message: result.message || options.errorMessage,
          };
        } catch (error) {
          return {
            valid: false,
            message:
              options.errorMessage || `Context validation error: ${error}`,
          };
        }
      },
    }),
};

/**
 * Conditional validation
 */
export function conditionalRequiredCheck<T>(
  condition: (context: T, allValues: any) => boolean
) {
  return fromContextPlugin.createMethod()<T>({
    validate: (value, context, allValues) => {
      const isRequired = condition(context, allValues);

      if (isRequired && (value == null || value === "")) {
        return {
          valid: false,
          message: "This field is required based on current context",
        };
      }

      return { valid: true };
    },
    required: false,
    fallbackToValid: true,
  });
}
