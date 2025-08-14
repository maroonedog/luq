// Export all plugins
// Common plugins
export { requiredPlugin } from "./required";
export { optionalPlugin } from "./optional";
export { nullablePlugin } from "./nullable";
export { requiredIfPlugin } from "./requiredIf";
export { optionalIfPlugin } from "./optionalIf";
export { skipPlugin } from "./skip";
export { validateIfPlugin } from "./validateIf";
export { orFailPlugin } from "./orFail";

// Value validation plugins
export { oneOfPlugin } from "./oneOf";
export { literalPlugin } from "./literal";
export { compareFieldPlugin } from "./compareField";
export { customPlugin } from "./custom";
export { stitchPlugin } from "./stitch";

// String plugins
export { stringMinPlugin } from "./stringMin";
export { stringMaxPlugin } from "./stringMax";
export { stringExactLengthPlugin } from "./stringExactLength";
export { stringPatternPlugin } from "./stringPattern";
export { stringEmailPlugin } from "./stringEmail";
export { stringUrlPlugin } from "./stringUrl";
export { stringAlphanumericPlugin } from "./stringAlphanumeric";
export { stringStartsWithPlugin } from "./stringStartsWith";
export { stringEndsWithPlugin } from "./stringEndsWith";
export { stringDatetimePlugin } from "./stringDatetime";
export { stringDatePlugin } from "./stringDate";
export { uuidPlugin } from "./uuid";

// String format validators
export { stringIpv4Plugin } from "./stringIpv4";
export { stringIpv6Plugin } from "./stringIpv6";
export { stringHostnamePlugin } from "./stringHostname";
export { stringTimePlugin } from "./stringTime";
export { stringDurationPlugin } from "./stringDuration";
export { stringJsonPointerPlugin } from "./stringJsonPointer";
export { stringBase64Plugin } from "./stringBase64";
export { stringIriPlugin } from "./stringIri";
export { stringIriReferencePlugin } from "./stringIriReference";
export { stringUriTemplatePlugin } from "./stringUriTemplate";
export { stringRelativeJsonPointerPlugin } from "./stringRelativeJsonPointer";
export { stringContentEncodingPlugin } from "./stringContentEncoding";
export { stringContentMediaTypePlugin } from "./stringContentMediaType";

// Number plugins
export { numberMinPlugin } from "./numberMin";
export { numberMaxPlugin } from "./numberMax";
export { numberPositivePlugin } from "./numberPositive";
export { numberNegativePlugin } from "./numberNegative";
export { numberIntegerPlugin } from "./numberInteger";
export { numberFinitePlugin } from "./numberFinite";
export { numberMultipleOfPlugin } from "./numberMultipleOf";
export { numberRangePlugin } from "./numberRange";

// Boolean plugins
export { booleanTruthyPlugin } from "./booleanTruthy";
export { booleanFalsyPlugin } from "./booleanFalsy";

// Array plugins
export { arrayIncludesPlugin } from "./arrayIncludes";
export { arrayUniquePlugin } from "./arrayUnique";
export { arrayMinLengthPlugin } from "./arrayMinLength";
export { arrayMaxLengthPlugin } from "./arrayMaxLength";

// Object plugins
export { objectPlugin } from "./object";
export { objectRecursivelyPlugin as recursivelyPlugin } from "./objectRecursively";
export { objectRecursivelyPlugin } from "./objectRecursively";
export { objectMinPropertiesPlugin } from "./objectMinProperties";
export { objectMaxPropertiesPlugin } from "./objectMaxProperties";
export { objectAdditionalPropertiesPlugin } from "./objectAdditionalProperties";

// Transform plugin
export { transformPlugin } from "./transform";

// Union Plugin
export { unionGuardPlugin } from "./unionGuard";

// Tuple Plugin
export { tupleBuilderPlugin } from "./tupleBuilder";

// Context Plugin
export { fromContextPlugin } from "./fromContext";

// Dynamic Validation Plugins
export { jsonSchemaPlugin } from "./jsonSchema/index";
export { jsonSchemaFullFeaturePlugin } from "./jsonSchemaFullFeature";

// JSON Schema Extension Plugins
export { arrayContainsPlugin } from "./arrayContains";
export { objectPropertyNamesPlugin } from "./objectPropertyNames";
export { objectPatternPropertiesPlugin } from "./objectPatternProperties";
export { objectDependentRequiredPlugin } from "./objectDependentRequired";
export { objectDependentSchemasPlugin } from "./objectDependentSchemas";
export { readOnlyWriteOnlyPlugin } from "./readOnlyWriteOnly";

// Core types only (avoid bulk exports)
export type { ValidationFunction, TransformFunction } from "./types";
