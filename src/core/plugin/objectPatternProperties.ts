/**
 * @luq-plugin
 * @name objectPatternProperties
 * @category object
 * @description Validates object properties that match specific patterns with corresponding schemas
 * @allowedTypes ["object"]
 * @example
 * ```typescript
 * // Pattern-based property validation
 * const validator = Builder()
 *   .use(objectPatternPropertiesPlugin)
 *   .for<{ [key: string]: any }>()
 *   .v("config", (b) => b.object.patternProperties({
 *     "^str_": (value) => typeof value === "string",
 *     "^num_": (value) => typeof value === "number"
 *   }))
 *   .build();
 *
 * // With custom validators and messages
 * builder.v("data", b => b.object.patternProperties({
 *   "^email_": {
 *     validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
 *     message: "Email properties must be valid email addresses"
 *   },
 *   "^id_": {
 *     validator: (value) => typeof value === "string" && value.length > 0,
 *     message: "ID properties must be non-empty strings"
 *   }
 * }))
 * ```
 * @params
 * - patterns: Record<string, (value: any) => boolean | PatternValidator> - Pattern to validator mapping
 * @returns Validation function that checks properties matching patterns
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";

export interface PatternValidator {
  validator: (value: any) => boolean;
  message?: string;
}

export type PatternPropertiesSchema = Record<
  string,
  ((value: any) => boolean) | PatternValidator
>;

export const objectPatternPropertiesPlugin = plugin({
  name: "objectPatternProperties",
  methodName: "patternProperties",
  allowedTypes: ["object"] as const,
  category: "standard" as const,
  impl: (patterns: PatternPropertiesSchema) => ({
    check: (value: any) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
      }

      const propertyNames = Object.keys(value);
      const patternEntries = Object.entries(patterns);

      for (const propertyName of propertyNames) {
        const propertyValue = value[propertyName];

        // Check each pattern to see if it matches this property
        for (const [patternString, validator] of patternEntries) {
          const pattern = new RegExp(patternString);
          
          if (pattern.test(propertyName)) {
            // This property matches the pattern, validate its value
            let isValid = false;
            
            if (typeof validator === "function") {
              isValid = validator(propertyValue);
            } else if (typeof validator === "object" && validator !== null && "validator" in validator) {
              isValid = validator.validator(propertyValue);
            }

            if (!isValid) {
              return false;
            }
            
            // Property passed validation for this pattern, continue to next property
            break;
          }
        }
      }

      return true;
    },
    code: "PATTERN_PROPERTIES",
    getErrorMessage: (value: any, path: string) => {
      const propertyNames = Object.keys(value || {});
      const patternEntries = Object.entries(patterns);
      const errors: string[] = [];

      for (const propertyName of propertyNames) {
        const propertyValue = value[propertyName];

        for (const [patternString, validator] of patternEntries) {
          const pattern = new RegExp(patternString);
          
          if (pattern.test(propertyName)) {
            let isValid = false;
            let customMessage: string | undefined;
            
            if (typeof validator === "function") {
              isValid = validator(propertyValue);
            } else if (typeof validator === "object" && validator !== null && "validator" in validator) {
              isValid = validator.validator(propertyValue);
              customMessage = validator.message;
            }

            if (!isValid) {
              if (customMessage) {
                errors.push(`${propertyName}: ${customMessage}`);
              } else {
                errors.push(`${propertyName} (matching pattern ${patternString}) has invalid value`);
              }
            }
            break;
          }
        }
      }

      return errors.length > 0 
        ? `${path} has pattern property violations: ${errors.join(", ")}`
        : `${path} has invalid pattern properties`;
    },
    params: [patterns],
  }),
});