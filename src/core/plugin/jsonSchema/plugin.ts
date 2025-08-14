import { pluginBuilderExtension } from "../../builder/plugins/plugin-creator";
import type { JSONSchema7 } from "json-schema";
import type {
  BuilderExtensionPlugin,
  FieldBuilder,
} from "../../builder/plugins/plugin-types";
import type { IChainableBuilder } from "../../builder/types/types";
import { JsonSchemaOptions } from "./types";
import {
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition,
} from "./dsl-converter";

/**
 * @luq-plugin
 * @name jsonSchema
 * @category builder-extension
 * @description Enables JSON Schema to Luq validator conversion
 * @example
 * ```typescript
 * const validator = Builder()
 *   .use(jsonSchemaPlugin)
 *   .use(requiredPlugin)
 *   .use(stringMinPlugin)
 *   .use(stringEmailPlugin)
 *   .for<UserData>()
 *   .fromJsonSchema({
 *     type: 'object',
 *     properties: {
 *       email: { type: 'string', format: 'email' },
 *       age: { type: 'number', minimum: 18 }
 *     },
 *     required: ['email']
 *   })
 *   .build();
 * ```
 */

/**
 * JSON Schema integration plugin for Luq
 */
export const jsonSchemaPlugin: BuilderExtensionPlugin<
  "jsonSchema",
  "fromJsonSchema",
  <TBuilder extends FieldBuilder<any, any, any, any>>(
    schema: JSONSchema7 | unknown,
    options?: JsonSchemaOptions
  ) => TBuilder
> = pluginBuilderExtension({
  name: "jsonSchema",
  methodName: "fromJsonSchema",
  impl: () => {
    return function <TBuilder extends FieldBuilder<any, any, any, any>>(
      schema: JSONSchema7 | unknown,
      options: JsonSchemaOptions = {}
    ): TBuilder {
      // Convert JSON Schema to DSL
      const dslFields = convertJsonSchemaToLuqDSL(schema, "", schema);

      // Start with a FieldBuilder by calling .for() first
      // We need to infer the type from the schema, but for now use 'any'
      let fieldBuilder = this.for();

      for (const dslField of dslFields) {
        // Skip root object constraints for now (would need special handling)
        if (dslField.path === "") continue;

        // Convert DSL to field definition function
        const definition = convertDSLToFieldDefinition(
          dslField,
          options?.customFormats
        );

        fieldBuilder = fieldBuilder.v(dslField.path, definition);
      }

      // Handle root-level object constraints (dependentRequired, additionalProperties, etc.)
      const rootConstraints = dslFields.find((f) => f.path === "");
      if (rootConstraints) {
        // Apply root-level validations
        if (
          rootConstraints.constraints.additionalProperties === false &&
          typeof fieldBuilder.strict === "function"
        ) {
          // Add strict mode validation
          fieldBuilder = fieldBuilder.strict();
        }

        if (rootConstraints.constraints.dependentRequired) {
          // Add dependent required validation
          for (const [prop, deps] of Object.entries(
            rootConstraints.constraints.dependentRequired
          )) {
            for (const dep of deps) {
              fieldBuilder = fieldBuilder.v(dep, (b: any) =>
                b.requiredIf((data: any) => data[prop] !== undefined)
              );
            }
          }
        }
      }

      return fieldBuilder as TBuilder;
    };
  },
  extendBuilder: (builder) => {
    // Add fromJsonSchema method to builder
    builder.fromJsonSchema = jsonSchemaPlugin.impl;
    return builder;
  },
});

// Legacy exports for backward compatibility
export { validateValueAgainstSchema } from "./validation-core";
export {
  getDetailedValidationErrors,
  getSpecificValidationErrors,
} from "./error-generation";
export {
  convertJsonSchemaToLuqDSL,
  convertDSLToFieldDefinition,
} from "./dsl-converter";
export { resolveRef } from "./ref-resolver";
