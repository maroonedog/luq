import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions, MessageContext } from "./types";
import {
  VALID_RESULT,
  INVALID_RESULT,
  ERROR_SEVERITY,
} from "./shared-constants";
import type { JSONSchema7 } from "json-schema";

const ERROR_CODE = "objectAdditionalProperties";

const supportedTypes = ["object"] as const;

interface AdditionalPropertiesOptions extends ValidationOptions {
  allowedProperties?: string[];
  additionalPropertiesSchema?: JSONSchema7;
  strict?: boolean; // additionalProperties: false
}

/**
 * @luq-plugin
 * @name objectAdditionalProperties
 * @category standard
 * @description Validates additional properties in objects according to JSON Schema additionalProperties rules
 * @allowedTypes ["object"]
 * @example
 * ```typescript
 * // Strict mode - no additional properties allowed
 * const validator = Builder()
 *   .use(objectAdditionalPropertiesPlugin)
 *   .for<UserData>()
 *   .v("user", (b) => b.object.additionalProperties(false, {
 *     allowedProperties: ["name", "age", "email"]
 *   }))
 *   .build();
 *
 * // With schema validation for additional properties
 * builder.v("config", b => b.object.additionalProperties({
 *   type: "string",
 *   minLength: 1
 * }))
 * ```
 * @params
 * - allowed: boolean | JSONSchema7 - Whether additional properties are allowed or schema for validation
 * - options?: AdditionalPropertiesOptions - Configuration including allowed property names
 * @returns Validation function that validates additional properties according to rules
 * @customError
 * ```typescript
 * .additionalProperties(false, {
 *   allowedProperties: ["name", "age"],
 *   messageFactory: ({ path, value }) =>
 *     `${path} has unexpected properties: ${Object.keys(value).filter(k => !allowedProps.includes(k)).join(", ")}`
 * })
 * ```
 * @since 0.1.0-alpha
 */
export const objectAdditionalPropertiesPlugin = plugin({
  name: "objectAdditionalProperties",
  methodName: "additionalProperties",
  allowedTypes: supportedTypes,
  category: "standard",
  impl: (
    allowed: boolean | JSONSchema7,
    options?: AdditionalPropertiesOptions
  ) => {
    const code = options?.code || ERROR_CODE;
    const allowedProperties = options?.allowedProperties || [];
    const strict = allowed === false || options?.strict === true;
    const additionalPropertiesSchema =
      typeof allowed === "object"
        ? allowed
        : options?.additionalPropertiesSchema;

    const messageFactory =
      options?.messageFactory ||
      ((ctx: MessageContext & { extraProperties: string[] }) => {
        if (strict) {
          return `Additional properties are not allowed: ${ctx.extraProperties.join(", ")}`;
        }
        return `Additional properties validation failed`;
      });

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // Pure validation - no side effects
        if (typeof value !== "object" || value === null) return true;

        const objectKeys = Object.keys(value);
        const extraProperties = objectKeys.filter(
          (key) => !allowedProperties.includes(key)
        );

        if (strict) {
          // additionalProperties: false - no extra properties allowed
          return extraProperties.length === 0;
        }

        if (additionalPropertiesSchema) {
          // additionalProperties: <schema> - validate extra properties against schema
          // For now, we'll implement basic validation
          // Full schema validation would require recursive JSON Schema validation
          for (const key of extraProperties) {
            const propValue = value[key];

            // Basic type checking for additional properties schema
            if (additionalPropertiesSchema.type) {
              const expectedType = additionalPropertiesSchema.type;
              const actualType = typeof propValue;

              if (expectedType === "string" && actualType !== "string")
                return false;
              if (expectedType === "number" && actualType !== "number")
                return false;
              if (expectedType === "boolean" && actualType !== "boolean")
                return false;
              if (
                expectedType === "object" &&
                (actualType !== "object" ||
                  propValue === null ||
                  Array.isArray(propValue))
              )
                return false;
              if (expectedType === "array" && !Array.isArray(propValue))
                return false;
            }

            // Basic string constraints
            if (
              additionalPropertiesSchema.minLength &&
              typeof propValue === "string"
            ) {
              if (propValue.length < additionalPropertiesSchema.minLength)
                return false;
            }
            if (
              additionalPropertiesSchema.maxLength &&
              typeof propValue === "string"
            ) {
              if (propValue.length > additionalPropertiesSchema.maxLength)
                return false;
            }

            // Basic number constraints
            if (
              additionalPropertiesSchema.minimum !== undefined &&
              typeof propValue === "number"
            ) {
              if (propValue < additionalPropertiesSchema.minimum) return false;
            }
            if (
              additionalPropertiesSchema.maximum !== undefined &&
              typeof propValue === "number"
            ) {
              if (propValue > additionalPropertiesSchema.maximum) return false;
            }
          }
        }

        // additionalProperties: true (default) or schema validation passed
        return true;
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        const objectKeys =
          typeof value === "object" && value !== null ? Object.keys(value) : [];
        const extraProperties = objectKeys.filter(
          (key) => !allowedProperties.includes(key)
        );

        const ctx = {
          path,
          value,
          code,
          extraProperties,
        };
        return messageFactory(ctx);
      },
      params: [allowed, options],
    };
  },
});
