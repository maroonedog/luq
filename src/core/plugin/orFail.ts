import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import { VALID_RESULT } from "./shared-constants";

// Local error code
const ERROR_CODE = "validation_error";

// Local error constants
const ERROR_MSG = "Validation failed";

// Local error message function
function getErrorMessage(ctx: MessageContext): string {
  return ERROR_MSG;
}

// V8 Optimization: Module-level constants

// All types that orFail can be applied to
const allTypes = [
  "string",
  "number",
  "boolean",
  "array",
  "object",
  "date",
  "union",
  "tuple",
] as const;

/**
 * @luq-plugin
 * @name orFail
 * @category conditional
 * @description Conditionally forces validation to fail with a custom error message
 * @allowedTypes ["string", "number", "boolean", "array", "object", "date", "union", "tuple"]
 * @example
 * ```typescript
 * // Basic usage - fails when condition is true
 * const validator = Builder()
 *   .use(orFailPlugin)
 *   .for<FormData>()
 *   .v("deprecated", (b) => b.string.orFail(
 *     values => values.useDeprecatedField === true,
 *     { messageFactory: ({ path }) => `${path} is deprecated and should not be used` }
 *   ))
 *   .build();
 *
 * // Environment-based validation
 * builder.v("debugData", b =>
 *   b.object.orFail(
 *     values => values.environment === 'production',
 *     { messageFactory: ({ path }) => `${path} should not be present in production` }
 *   )
 * )
 *
 * // Feature flag based
 * builder.v("betaFeature", b =>
 *   b.string.orFail(
 *     values => !values.betaEnabled,
 *     { messageFactory: ({ path }) => `${path} requires beta features to be enabled` }
 *   )
 * )
 * ```
 * @params
 * - condition: (allValues: TObject) => boolean - Condition that determines if validation should fail
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration with custom message factory
 * @returns Validation function that fails when condition is true
 * @customError
 * ```typescript
 * .orFail(
 *   values => values.isRestricted,
 *   {
 *     messageFactory: ({ path, value }) => `${path} is restricted for this user (value: ${value})`
 *   }
 * )
 * ```
 * @since 0.1.0-alpha
 */
/**
 * Conditionally forces validation to fail with a custom error message based on form state.
 * This plugin is useful for marking fields as deprecated, temporarily disabled,
 * or for implementing strict validation rules during development.
 *
 * Usage:
 * ```typescript
 * // Mark deprecated fields based on version
 * builder.v("oldApiKey", b =>
 *   b.string.orFail(
 *     values => values.apiVersion >= 2,
 *     { message: "This field is deprecated. Use 'apiToken' instead" }
 *   )
 * )
 *
 * // Temporarily disable fields based on feature flags
 * builder.v("experimentalFeature", b =>
 *   b.object.orFail(
 *     values => !values.features?.experimental,
 *     { message: "This feature is temporarily disabled" }
 *   )
 * )
 *
 * // Strict validation in production
 * builder.v("debugInfo", b =>
 *   b.object.orFail(
 *     values => values.environment === 'production',
 *     { message: "Debug information should not be included in production" }
 *   )
 * )
 *
 * // Role-based restrictions
 * builder.v("adminSettings", b =>
 *   b.object.orFail(
 *     values => values.userRole !== 'admin',
 *     { message: "Admin settings can only be modified by administrators" }
 *   )
 * )
 *
 * // Combine with other validations
 * builder.v("restrictedField", b =>
 *   b.string
 *     .min(10)
 *     .pattern(/^RESTRICTED-/)
 *     .orFail(
 *       values => !values.hasPermission,
 *       { message: "This field requires special permissions" }
 *     )
 * )
 * ```
 *
 * Note: When condition evaluates to true, the field will be invalid regardless of its value.
 * This is useful for conditional restrictions and dynamic validation rules.
 */
export const orFailPlugin = plugin({
  name: "orFail",
  methodName: "orFail",
  allowedTypes: allTypes,
  category: "conditional",
  impl: <TObject = any>(
    condition: (allValues: TObject) => boolean,
    options?: ValidationOptions & { messageFactory?: (context: MessageContext) => string; message?: string }
  ) => {
    // V8 Optimization: Pre-compute values in curry phase
    const code = options?.code || ERROR_CODE;
    const messageFactory = options?.messageFactory || getErrorMessage;
    const message = options?.message;

    // Return hoisted validator format
    return {
      check: (value: any, allValues?: TObject) => {
        // orFail plugin requires allValues to evaluate condition
        if (!allValues) return true; // Default to pass if no allValues

        // Evaluate condition with all form values
        const shouldFail = condition(allValues);

        // Return opposite of shouldFail (fail when condition is true)
        return !shouldFail;
      },
      code: code,

      getErrorMessage: (value: any, path: string, allValues?: TObject) => {
        // Return the custom message if provided
        if (message) return message;

        // Use issue factory for dynamic message
        const issueContext: MessageContext & { message?: string } = {
          path,
          value,
          code,
          message,
        };
        return messageFactory(issueContext);
      },
      params: [condition, options],
      // Special marker for conditional failure
      __isOrFail: true,
      __condition: condition,
      // Store orFail configuration
      orFail: {
        condition,
        message,
        options,
        // Legacy validation function for complex conditional failure
        performOrFailValidation: (value: any, ctx: any) => {
          // Evaluate condition with all form values
          const shouldFail = condition(ctx.allValues);

          if (shouldFail) {
            // Fail validation
            const issueContext: MessageContext & { message?: string } = {
              path: ctx.path,
              value,
              code,
              message,
            };

            const errorMessage =
              message ||
              (messageFactory
                ? messageFactory(issueContext)
                : `Validation failed at ${ctx.path}`);

            return { valid: false, message: errorMessage };
          }

          // If condition is false, validation passes
          return VALID_RESULT;
        },
      },
    };
  },
});
