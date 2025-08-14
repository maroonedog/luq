import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";

// Type-safe context for requiredIf plugin
export interface RequiredIfContext extends MessageContext {
  condition?: boolean;
}

// Local error code
const ERROR_CODE = "requiredIf";

// Local error constants
const ERROR_MSG = "Field is required when condition is met";

// Local error message function
function getErrorMessage(ctx: RequiredIfContext): string {
  return ERROR_MSG;
}

// V8 Optimization: Module-level constants

// All types that requiredIf can be applied to
const allTypes = [
  "string",
  "number",
  "boolean",
  "array",
  "object",
  "date",
  "union",
] as const;

/**
 * @luq-plugin
 * @name requiredIf
 * @category conditional
 * @description Makes a field required based on a dynamic condition evaluated at validation time, with support for array context validation
 * @allowedTypes ["string", "number", "boolean", "array", "object", "date", "union"]
 * @example
 * ```typescript
 * // Basic conditional required
 * const validator = Builder()
 *   .use(requiredIfPlugin)
 *   .for<ContactForm>()
 *   .v("email", (b) => b.string.requiredIf(values => values.contactMethod === 'email'))
 *   .v("phone", (b) => b.string.requiredIf(values => values.contactMethod === 'phone'))
 *   .build();
 *
 * // Multiple conditions
 * builder.v("ssn", b =>
 *   b.string.requiredIf(values =>
 *     values.country === 'US' && values.employmentType === 'full-time'
 *   )
 * )
 *
 * // Array context validation - conditional required within array items
 * builder.v("items[].billingAddress", b =>
 *   b.string.requiredIf((allValues, arrayContext) => {
 *     // arrayContext.index: current index in array
 *     // arrayContext.item: current object at index
 *     // arrayContext.array: full array
 *     return arrayContext?.item?.type === 'premium';
 *   })
 * )
 *
 * // Mixed validation - access both form values and array context
 * builder.v("orders[].shippingAddress", b =>
 *   b.string.requiredIf((allValues, arrayContext) => {
 *     const isInternational = allValues.country !== 'US';
 *     const requiresShipping = arrayContext?.item?.requiresShipping;
 *     return isInternational && requiresShipping;
 *   })
 * )
 * ```
 * @params
 * - condition: (allValues: TObject, arrayContext?: ArrayContext) => boolean - Condition function that receives all form values and optional array context
 * - options?: { messageFactory?: (context: MessageContext) => string } - Optional configuration
 * @returns Validation function that checks if field is required based on condition
 * @customError
 * ```typescript
 * .requiredIf(
 *   (values, arrayContext) => values.hasAccount && arrayContext?.item?.isActive,
 *   { messageFactory: ({ path }) => `${path} is required when account exists and item is active` }
 * )
 * ```
 * @since 0.1.0-alpha
 */
export const requiredIfPlugin = plugin({
  name: "requiredIf",
  methodName: "requiredIf",
  allowedTypes: allTypes,
  category: "conditional",
  impl: <TObject>(
    condition: (
      allValues: TObject,
      arrayContext?: import("./types").ArrayContext
    ) => boolean,
    options?: ValidationOptions<RequiredIfContext>
  ) => {
    const code = options?.code || ERROR_CODE;
    const messageFactory = options?.messageFactory || getErrorMessage;

    // Return hoisted validator format
    return {
      check: (
        value: any,
        allValues?: TObject,
        arrayContext?: import("./types").ArrayContext
      ) => {
        // For conditional plugins, we need access to allValues
        if (!allValues) {
          // If allValues not provided, treat as optional (safer default)
          return true;
        }

        // Evaluate condition with all form values and optional arrayContext
        const shouldBeRequired = condition(allValues, arrayContext);

        if (shouldBeRequired) {
          // Apply required validation
          return !(value === undefined || value === null || value === "");
        }

        // If condition is false, it's always valid
        return true;
      },
      code: code,

      getErrorMessage: (
        value: any,
        path: string,
        allValues?: TObject,
        arrayContext?: import("./types").ArrayContext
      ) => {
        const shouldBeRequired = allValues
          ? condition(allValues, arrayContext)
          : false;
        const ctx: RequiredIfContext = {
          path,
          value,
          code,
          condition: shouldBeRequired,
        };
        return messageFactory(ctx);
      },
      params: [condition, options],
      // Special method to check condition dynamically
      evaluateCondition: (
        allValues?: TObject,
        arrayContext?: import("./types").ArrayContext
      ) => {
        return allValues ? condition(allValues, arrayContext) : false;
      },
    };
  },
});
