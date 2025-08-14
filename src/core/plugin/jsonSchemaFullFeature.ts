import type {
  BuilderExtensionPlugin,
  FieldBuilder,
} from "../builder/plugins/plugin-types";
import type { JSONSchema7 } from "json-schema";
import { jsonSchemaPlugin } from "./jsonSchema";
import type { JsonSchemaOptions } from "./jsonSchema/types";

// Core validation plugins (required for JSON Schema)
import { requiredPlugin } from "./required";
import { optionalPlugin } from "./optional";
import { nullablePlugin } from "./nullable";
import { requiredIfPlugin } from "./requiredIf"; // For if/then/else

// Value validation plugins (for enum, const)
import { oneOfPlugin } from "./oneOf"; // For enum
import { literalPlugin } from "./literal"; // For const
import { customPlugin } from "./custom"; // For complex validations (allOf, anyOf, not)

// String plugins (for string constraints)
import { stringMinPlugin } from "./stringMin"; // For minLength
import { stringMaxPlugin } from "./stringMax"; // For maxLength
import { stringPatternPlugin } from "./stringPattern"; // For pattern

// String format validators (for format keyword)
import { stringEmailPlugin } from "./stringEmail"; // format: email
import { stringUrlPlugin } from "./stringUrl"; // format: url, uri
import { uuidPlugin } from "./uuid"; // format: uuid
import { stringDatePlugin } from "./stringDate"; // format: date
import { stringDatetimePlugin } from "./stringDatetime"; // format: date-time
import { stringIpv4Plugin } from "./stringIpv4"; // format: ipv4
import { stringIpv6Plugin } from "./stringIpv6"; // format: ipv6
import { stringHostnamePlugin } from "./stringHostname"; // format: hostname
import { stringTimePlugin } from "./stringTime"; // format: time
import { stringDurationPlugin } from "./stringDuration"; // format: duration
import { stringJsonPointerPlugin } from "./stringJsonPointer"; // format: json-pointer
import { stringBase64Plugin } from "./stringBase64"; // format: base64 (for contentEncoding)
import { stringIriPlugin } from "./stringIri"; // format: iri
import { stringIriReferencePlugin } from "./stringIriReference"; // format: iri-reference
import { stringUriTemplatePlugin } from "./stringUriTemplate"; // format: uri-template
import { stringRelativeJsonPointerPlugin } from "./stringRelativeJsonPointer"; // format: relative-json-pointer
import { stringContentEncodingPlugin } from "./stringContentEncoding"; // For contentEncoding
import { stringContentMediaTypePlugin } from "./stringContentMediaType"; // For contentMediaType

// Number plugins (for number constraints)
import { numberMinPlugin } from "./numberMin"; // For minimum
import { numberMaxPlugin } from "./numberMax"; // For maximum
import { numberIntegerPlugin } from "./numberInteger"; // For integer type
import { numberMultipleOfPlugin } from "./numberMultipleOf"; // For multipleOf

// Array plugins (for array constraints)
import { arrayUniquePlugin } from "./arrayUnique"; // For uniqueItems
import { arrayMinLengthPlugin } from "./arrayMinLength"; // For minItems
import { arrayMaxLengthPlugin } from "./arrayMaxLength"; // For maxItems
import { arrayContainsPlugin } from "./arrayContains"; // For contains

// Object plugins (for object constraints)
import { objectMinPropertiesPlugin } from "./objectMinProperties"; // For minProperties
import { objectMaxPropertiesPlugin } from "./objectMaxProperties"; // For maxProperties
import { objectAdditionalPropertiesPlugin } from "./objectAdditionalProperties"; // For additionalProperties
import { objectPropertyNamesPlugin } from "./objectPropertyNames"; // For propertyNames
import { objectPatternPropertiesPlugin } from "./objectPatternProperties"; // For patternProperties
import { objectDependentRequiredPlugin } from "./objectDependentRequired"; // For dependentRequired
import { objectDependentSchemasPlugin } from "./objectDependentSchemas"; // For dependentSchemas

// Tuple support
import { tupleBuilderPlugin } from "./tupleBuilder"; // For tuple validation (array with fixed items)

// Context-based validation
import { readOnlyWriteOnlyPlugin } from "./readOnlyWriteOnly"; // For readOnly/writeOnly

// List of plugins specifically needed for JSON Schema support (excluding jsonSchemaPlugin itself)
const jsonSchemaRequiredPlugins = [
  // Core validation (required, optional, nullable)
  requiredPlugin,
  optionalPlugin,
  nullablePlugin,
  requiredIfPlugin, // For conditional validation (if/then/else)

  // Value validation (enum, const, composition)
  oneOfPlugin, // For enum and oneOf
  literalPlugin, // For const
  customPlugin, // For allOf, anyOf, not

  // String constraints
  stringMinPlugin, // minLength
  stringMaxPlugin, // maxLength
  stringPatternPlugin, // pattern

  // String formats (JSON Schema Draft-07)
  stringEmailPlugin, // email
  stringUrlPlugin, // url, uri
  uuidPlugin, // uuid
  stringDatePlugin, // date
  stringDatetimePlugin, // date-time
  stringIpv4Plugin, // ipv4
  stringIpv6Plugin, // ipv6
  stringHostnamePlugin, // hostname
  stringTimePlugin, // time
  stringDurationPlugin, // duration
  stringJsonPointerPlugin, // json-pointer
  stringBase64Plugin, // For base64 validation
  stringIriPlugin, // iri
  stringIriReferencePlugin, // iri-reference
  stringUriTemplatePlugin, // uri-template
  stringRelativeJsonPointerPlugin, // relative-json-pointer
  stringContentEncodingPlugin, // contentEncoding
  stringContentMediaTypePlugin, // contentMediaType

  // Number constraints
  numberMinPlugin, // minimum
  numberMaxPlugin, // maximum
  numberIntegerPlugin, // integer type
  numberMultipleOfPlugin, // multipleOf

  // Array constraints
  arrayUniquePlugin, // uniqueItems
  arrayMinLengthPlugin, // minItems
  arrayMaxLengthPlugin, // maxItems
  arrayContainsPlugin, // contains

  // Object constraints
  objectMinPropertiesPlugin, // minProperties
  objectMaxPropertiesPlugin, // maxProperties
  objectAdditionalPropertiesPlugin, // additionalProperties
  objectPropertyNamesPlugin, // propertyNames
  objectPatternPropertiesPlugin, // patternProperties
  objectDependentRequiredPlugin, // dependentRequired
  objectDependentSchemasPlugin, // dependentSchemas

  // Tuple support
  tupleBuilderPlugin, // For array with tuple validation

  // Context-based validation
  readOnlyWriteOnlyPlugin, // readOnly/writeOnly
];

/**
 * @luq-plugin
 * @name jsonSchemaFullFeature
 * @category builder-extension
 * @description Complete JSON Schema support with all necessary plugins pre-loaded
 * @example
 * ```typescript
 * // Single plugin import for full JSON Schema support
 * const validator = Builder()
 *   .use(jsonSchemaFullFeaturePlugin)
 *   .fromJsonSchema({
 *     type: 'object',
 *     properties: {
 *       email: { type: 'string', format: 'email' },
 *       age: { type: 'number', minimum: 18 },
 *       roles: {
 *         type: 'array',
 *         items: { type: 'string' },
 *         uniqueItems: true
 *       }
 *     },
 *     required: ['email'],
 *     additionalProperties: false
 *   })
 *   .build();
 * ```
 */
export const jsonSchemaFullFeaturePlugin: BuilderExtensionPlugin<
  "jsonSchemaFullFeature",
  "fromJsonSchema",
  <TBuilder extends FieldBuilder<any, any, any, any>>(
    schema: JSONSchema7 | unknown,
    options?: JsonSchemaOptions
  ) => TBuilder
> = {
  // Inherit all properties from jsonSchemaPlugin
  ...jsonSchemaPlugin,
  // Override name and extendBuilder
  name: "jsonSchemaFullFeature",
  extendBuilder: (builderInstance: any) => {
    // First, apply all required plugins
    for (const plugin of jsonSchemaRequiredPlugins) {
      builderInstance.use(plugin);
    }

    // Then apply the jsonSchemaPlugin itself (adds fromJsonSchema method)
    builderInstance.use(jsonSchemaPlugin);

    return builderInstance;
  },
};
