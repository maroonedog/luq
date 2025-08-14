/**
 * fromContext Plugin - Context-based validation
 *
 * Generic plugin that can uniformly handle async context,
 * allValues, and other context data
 */

import { plugin } from "../builder/plugins/plugin-creator";
import { getAsyncContext } from "../async.experimental/async-context";
import type { ContextValidationOptions } from "../builder/plugins/plugin-interfaces";

const supportedTypes = [
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "date",
  "union",
  "tuple",
] as const;

/**
 * @luq-plugin
 * @name fromContext
 * @category context
 * @description Validation using context data (async context, allValues, etc.)
 * @allowedTypes ["string", "number", "boolean", "object", "array", "date", "union", "tuple"]
 * @example
 * ```typescript
 * // Basic usage
 * const validator = Builder()
 *   .use(fromContextPlugin)
 *   .for<{ email: string }>()
 *   .v("email", (b) => b.string.required().fromContext({
 *     validate: (email, context) => ({
 *       valid: !context.hasEmail,
 *       message: "Email already exists"
 *     }),
 *     required: true
 *   }))
 *   .build();
 *
 * // Combination with async context
 * const asyncContext = createAsyncContext<{ hasEmail: boolean }>()
 *   .set("hasEmail", checkEmailExists(email))
 *   .build();
 *
 * const result = await validator
 *   .withAsyncContext<{ hasEmail: boolean }>(asyncContext)
 *   .validate({ email: "test@example.com" });
 *
 * // Cross-field validation (using allValues)
 * builder.v("confirmPassword", b => b.string.fromContext({
 *   validate: (confirmPassword, context, allValues) => ({
 *     valid: allValues.password === confirmPassword,
 *     message: "Password confirmation does not match"
 *   }),
 *   required: false // Async context not needed when using allValues
 * }))
 * ```
 * @params
 * - validate: (value, context, allValues) => { valid: boolean; message?: string } - Validation function
 * - errorMessage?: string - Custom error message
 * - required?: boolean - Whether context data is required (default: false)
 * - fallbackToValid?: boolean - Whether to consider valid when no context (default: true)
 * @returns Validation result using context data
 * @since 0.1.0-alpha
 */
export const fromContextPlugin = plugin({
  name: "fromContext",
  methodName: "fromContext",
  allowedTypes: supportedTypes,
  category: "context" as const,
  impl: <TContext = Record<string, any>>(options: ContextValidationOptions<TContext>) => {
    // Default option values
    const required = options.required ?? false;
    const fallbackToValid = options.fallbackToValid ?? true;
    const errorMessage = options.errorMessage;
    const code = options.code || "context_validation";

    // Return hoisted validator format
    return {
      check: (value: any, allValues?: any) => {
        try {
          // For hoisted validation, we simplify context handling
          // Complex async context will be handled by field-builder
          let contextData: TContext | undefined;

          // Use allValues as context if available
          if (allValues && !required) {
            contextData = allValues as TContext;
          }

          // When context is not available
          if (!contextData) {
            if (required) {
              return false; // Context required but not available
            }
            return fallbackToValid; // Use fallback
          }

          // Execute validation
          const result = options.validate(value, contextData, allValues);
          return result.valid;
        } catch (error) {
          return false; // Error occurred
        }
      },
      code: code,

      getErrorMessage: (value: any, path: string, allValues?: any) => {
        try {
          // Get context data for error message generation
          let contextData: TContext | undefined;

          // Try to get async context (might not be available in hoisted mode)
          if (allValues && !required) {
            contextData = allValues as TContext;
          }

          // When context is not available
          if (!contextData) {
            if (required) {
              return errorMessage || "Context data is required for validation";
            }
            return errorMessage || "Context validation failed";
          }

          // Execute validation to get error message
          const result = options.validate(value, contextData, allValues);
          return result.message || errorMessage || "Context validation failed";
        } catch (error) {
          return errorMessage || `Context validation error: ${error}`;
        }
      },
      params: [options],
      // Special marker for context validation
      __isFromContext: true,
      __contextOptions: options,
      // Store context configuration
      fromContext: {
        options,
        required,
        fallbackToValid,
        errorMessage,
        // Legacy validation function for complex context handling
        performContextValidation: (value: any, ctx: any) => {
          try {
            // Prioritize async context
            const asyncContext = getAsyncContext<TContext & Record<string, any>>(ctx);
            const allValues = ctx.allValues;

            // Select context
            let contextData: TContext | undefined = asyncContext;

            // Use allValues if no async context
            if (!contextData && !required) {
              contextData = allValues as TContext;
            }

            // When context is not available
            if (!contextData) {
              if (required) {
                return {
                  valid: false,
                  message:
                    errorMessage || "Context data is required for validation",
                };
              }

              return {
                valid: fallbackToValid,
              };
            }

            // Execute validation
            const result = options.validate(value, contextData, allValues);

            return {
              valid: result.valid,
              message: result.message || errorMessage,
            };
          } catch (error) {
            // When error occurs
            return {
              valid: false,
              message: errorMessage || `Context validation error: ${error}`,
            };
          }
        },
      },
    };
  },
});

/**
 * Convenient helper functions
 */

/**
 * fromContext options for email duplication check
 */
export function emailDuplicationCheck(): ContextValidationOptions<{
  hasEmail: boolean;
}> {
  return {
    validate: (email, context) => {
      if (context.hasEmail) {
        return {
          valid: false,
          message: `Email "${email}" is already registered`,
        };
      }
      return { valid: true };
    },
    required: true,
    errorMessage: "Email duplication check failed",
  };
}

/**
 * fromContext options for password confirmation check
 */
export function passwordConfirmation(): ContextValidationOptions<any> {
  return {
    validate: (confirmPassword, context, allValues) => {
      const password = allValues.password;
      if (password !== confirmPassword) {
        return {
          valid: false,
          message: "Password confirmation does not match",
        };
      }
      return { valid: true };
    },
    required: false, // Async context not needed when using allValues
    fallbackToValid: true,
  };
}

/**
 * fromContext options for inventory check
 */
export function inventoryCheck(): ContextValidationOptions<{
  inventory: Array<{ productId: string; available: number }>;
}> {
  return {
    validate: (productId, context) => {
      const product = context.inventory.find(
        (item) => item.productId === productId
      );

      if (!product) {
        return {
          valid: false,
          message: `Product "${productId}" not found`,
        };
      }

      if (product.available <= 0) {
        return {
          valid: false,
          message: `Product "${productId}" is out of stock`,
        };
      }

      return { valid: true };
    },
    required: true,
    errorMessage: "Inventory check failed",
  };
}

/**
 * fromContext options for conditional validation
 */
export function conditionalRequired<T>(
  condition: (context: T, allValues: any) => boolean,
  message = "This field is required based on current context"
): ContextValidationOptions<T> {
  return {
    validate: (value, context, allValues) => {
      const isRequired = condition(context, allValues);

      if (isRequired && (value == null || value === "")) {
        return {
          valid: false,
          message,
        };
      }

      return { valid: true };
    },
    required: false,
    fallbackToValid: true,
  };
}

/**
 * Type-safe fromContext helper
 */
export function createTypedContextValidator<TValue, TContext>(
  options: ContextValidationOptions<TContext>
): ContextValidationOptions<TContext> {
  return options;
}

/**
 * Usage example templates
 */
export const ContextValidationTemplates = {
  /**
   * Email duplication check
   */
  emailDuplication: () => emailDuplicationCheck(),

  /**
   * Password confirmation
   */
  passwordConfirmation: () => passwordConfirmation(),

  /**
   * Inventory check
   */
  inventoryCheck: () => inventoryCheck(),

  /**
   * User permission check
   */
  userPermission: <T extends { userRole: string; requiredRole: string }>() =>
    createTypedContextValidator<string, T>({
      validate: (value, context) => ({
        valid: context.userRole === context.requiredRole,
        message: `Access denied. Required role: ${context.requiredRole}`,
      }),
      required: true,
    }),

  /**
   * Account limits check
   */
  accountLimits: <T extends { currentCount: number; maxCount: number }>() =>
    createTypedContextValidator<any, T>({
      validate: (value, context) => ({
        valid: context.currentCount < context.maxCount,
        message: `Limit exceeded (${context.currentCount}/${context.maxCount})`,
      }),
      required: true,
    }),

  /**
   * Geo restriction check
   */
  geoRestriction: <
    T extends { country: string; allowedCountries: string[] },
  >() =>
    createTypedContextValidator<string, T>({
      validate: (value, context) => ({
        valid: context.allowedCountries.includes(context.country),
        message: `Service not available in ${context.country}`,
      }),
      required: false,
      fallbackToValid: true, // Allow if geo information is not available
    }),
};
