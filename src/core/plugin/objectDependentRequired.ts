/**
 * @luq-plugin
 * @name objectDependentRequired
 * @category object
 * @description Validates that when certain properties exist, other properties become required
 * @allowedTypes ["object"]
 * @example
 * ```typescript
 * // Dependent required fields
 * const validator = Builder()
 *   .use(objectDependentRequiredPlugin)
 *   .for<{ name?: string; first?: string; last?: string; }>()
 *   .v("", (b) => b.object.dependentRequired({
 *     name: ["first", "last"],
 *     credit_card: ["billing_address"]
 *   }))
 *   .build();
 *
 * // With custom error messages
 * builder.v("", b => b.object.dependentRequired({
 *   email: { 
 *     required: ["email_verified"],
 *     message: "When email is provided, email_verified is required"
 *   }
 * }))
 * ```
 * @params
 * - dependencies: Record<string, string[] | DependentRequiredSchema> - Property dependencies mapping
 * @returns Validation function that checks dependent required fields
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";

export interface DependentRequiredSchema {
  required: string[];
  message?: string;
}

export type DependentRequiredMapping = Record<
  string,
  string[] | DependentRequiredSchema
>;

export const objectDependentRequiredPlugin = plugin({
  name: "objectDependentRequired",
  methodName: "dependentRequired",
  allowedTypes: ["object"] as const,
  category: "standard" as const,
  impl: (dependencies: DependentRequiredMapping) => ({
    check: (value: any, allValues?: any) => {
      // Use allValues if provided (for root-level validation), otherwise use value
      const target = allValues !== undefined ? allValues : value;
      
      if (!target || typeof target !== "object" || Array.isArray(target)) {
        return true; // Skip validation for non-objects
      }

      const dependencyEntries = Object.entries(dependencies);

      for (const [triggerProperty, requiredSpec] of dependencyEntries) {
        // Check if the trigger property exists
        if (triggerProperty in target && target[triggerProperty] !== undefined) {
          // Get the list of required properties
          const requiredProps = Array.isArray(requiredSpec) 
            ? requiredSpec 
            : requiredSpec.required;

          // Check that all required properties exist
          for (const requiredProp of requiredProps) {
            if (!(requiredProp in target) || target[requiredProp] === undefined) {
              return false;
            }
          }
        }
      }

      return true;
    },
    code: "DEPENDENT_REQUIRED",
    getErrorMessage: (value: any, path: string, allValues?: any) => {
      const target = allValues !== undefined ? allValues : value;
      const dependencyEntries = Object.entries(dependencies);
      const errors: string[] = [];

      for (const [triggerProperty, requiredSpec] of dependencyEntries) {
        if (triggerProperty in target && target[triggerProperty] !== undefined) {
          const requiredProps = Array.isArray(requiredSpec) 
            ? requiredSpec 
            : requiredSpec.required;
            
          const customMessage = !Array.isArray(requiredSpec) 
            ? requiredSpec.message 
            : undefined;

          const missingProps = requiredProps.filter(
            (prop) => !(prop in target) || target[prop] === undefined
          );

          if (missingProps.length > 0) {
            if (customMessage) {
              errors.push(customMessage);
            } else {
              errors.push(
                `When '${triggerProperty}' is present, the following properties are required: ${missingProps.join(", ")}`
              );
            }
          }
        }
      }

      const pathPrefix = path && path !== "" ? `${path}: ` : "";
      return errors.length > 0 
        ? `${pathPrefix}${errors.join("; ")}`
        : `${pathPrefix}Dependent required validation failed`;
    },
    params: [dependencies],
  }),
});