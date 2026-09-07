// ===========================================================================
// L8 (tier `extension`)
// src/json-schema/extensions/json-schema-full-feature/bundled-plugins.ts
//
// THE USE() LIST. 1.x called `builderInstance.use()` forty-five times inside
// `extendBuilder`; the rewritten core takes the plugins as a BAG value instead
// (src/json-schema/build-from-schema.ts takes it as its first argument), so the
// list is this object literal and nothing else in the library holds a second
// copy of it.
//
// IT CANNOT NAME A PLUGIN THAT IS NOT BOUND, AND IT CANNOT OMIT ONE THAT IS.
// Both directions are enforced, and neither is enforced by this file agreeing
// with itself:
//   - COMPILE TIME: `satisfies JsonSchemaBag` on the literal AND the `:
//     JsonSchemaBag` annotation. The annotation alone is NOT enough — the
//     literal is an argument to Object.freeze(), so excess-property checking
//     does not reach it, which was MEASURED by adding a member and watching
//     tsc stay silent. `satisfies` applies to the literal itself, so an
//     undeclared member is an error and a missing one is too. The bag type is
//     the same one bindKeyword() constrains every keyword binding against, so
//     a keyword bound to a plugin absent from here is impossible to write.
//   - RUN TIME: findUnbundledBoundPlugins() in ./bundle-coverage.ts compares
//     `listBoundPluginNames()` (the plugin NAMES the keyword and format tables
//     bind) against the names in this object, and its sibling reports the
//     reverse. Both are asserted in the unit tests, so a keyword table change
//     that this file does not follow fails the build.
//
// This is the ONE module in the library that imports plugin entry files in
// bulk; it is why the subpath exists and why it is the large one.
// ===========================================================================
import type { JsonSchemaBag } from "../../index";
import { requiredPlugin } from "../../../plugins/required";
import { optionalPlugin } from "../../../plugins/optional";
import { nullablePlugin } from "../../../plugins/nullable";
import { literalPlugin } from "../../../plugins/literal";
import { stringMinPlugin } from "../../../plugins/string-min";
import { stringMaxPlugin } from "../../../plugins/string-max";
import { stringPatternPlugin } from "../../../plugins/string-pattern";
import { stringContentEncodingPlugin } from "../../../plugins/string-content-encoding";
import { stringContentMediaTypePlugin } from "../../../plugins/string-content-media-type";
import { numberMinPlugin } from "../../../plugins/number-min";
import { numberMaxPlugin } from "../../../plugins/number-max";
import { numberIntegerPlugin } from "../../../plugins/number-integer";
import { numberMultipleOfPlugin } from "../../../plugins/number-multiple-of";
import { arrayMinLengthPlugin } from "../../../plugins/array-min-length";
import { arrayMaxLengthPlugin } from "../../../plugins/array-max-length";
import { arrayUniquePlugin } from "../../../plugins/array-unique";
import { objectMinPropertiesPlugin } from "../../../plugins/object-min-properties";
import { objectMaxPropertiesPlugin } from "../../../plugins/object-max-properties";
import { stringDatePlugin } from "../../../plugins/string-date";
import { stringDatetimePlugin } from "../../../plugins/string-datetime";
import { stringTimePlugin } from "../../../plugins/string-time";
import { stringDurationPlugin } from "../../../plugins/string-duration";
import { stringEmailPlugin } from "../../../plugins/string-email";
import { stringHostnamePlugin } from "../../../plugins/string-hostname";
import { stringIdnEmailPlugin } from "../../../plugins/string-idn-email";
import { stringIdnHostnamePlugin } from "../../../plugins/string-idn-hostname";
import { stringRegexPlugin } from "../../../plugins/string-regex";
import { stringUriReferencePlugin } from "../../../plugins/string-uri-reference";
import { stringIpv4Plugin } from "../../../plugins/string-ipv4";
import { stringIpv6Plugin } from "../../../plugins/string-ipv6";
import { stringUrlPlugin } from "../../../plugins/string-url";
import { stringIriPlugin } from "../../../plugins/string-iri";
import { stringIriReferencePlugin } from "../../../plugins/string-iri-reference";
import { stringUriTemplatePlugin } from "../../../plugins/string-uri-template";
import { stringJsonPointerPlugin } from "../../../plugins/string-json-pointer";
import { stringRelativeJsonPointerPlugin } from "../../../plugins/string-relative-json-pointer";
import { uuidPlugin } from "../../../plugins/uuid";
import { oneOfPlugin } from "../../../plugins/one-of";
import {
  objectAdditionalPropertiesPlugin,
  objectAdditionalPropertiesSchemaPlugin,
} from "../../../plugins/object-additional-properties";
import { objectPatternPropertiesPlugin } from "../../../plugins/object-pattern-properties";
import { objectPropertyNamesPlugin } from "../../../plugins/object-property-names";
import { objectDependentRequiredPlugin } from "../../../plugins/object-dependent-required";
import { objectDependentSchemasPlugin } from "../../../plugins/object-dependent-schemas";
import { arrayEachPlugin } from "../../../plugins/array-each";
import { arrayContainsPlugin } from "../../../plugins/array-contains";
import { tupleBuilderPlugin } from "../../../plugins/tuple-builder";
import { conditionalSchemaPlugin } from "../../../plugins/conditional-schema";
import { compareFieldPlugin } from "../../../plugins/compare-field";

/**
 * The forty-nine plugins `./plugins/jsonSchemaFullFeature` bundles. Frozen,
 * because it is handed to `fromJsonSchema` as a shared value and a caller must
 * not be able to swap one plugin for another after the fact.
 */
export const jsonSchemaBag: JsonSchemaBag = Object.freeze({
  required: requiredPlugin,
  optional: optionalPlugin,
  nullable: nullablePlugin,
  literal: literalPlugin,
  stringMin: stringMinPlugin,
  stringMax: stringMaxPlugin,
  stringPattern: stringPatternPlugin,
  stringContentEncoding: stringContentEncodingPlugin,
  stringContentMediaType: stringContentMediaTypePlugin,
  numberMin: numberMinPlugin,
  numberMax: numberMaxPlugin,
  numberInteger: numberIntegerPlugin,
  numberMultipleOf: numberMultipleOfPlugin,
  arrayMinLength: arrayMinLengthPlugin,
  arrayMaxLength: arrayMaxLengthPlugin,
  arrayUnique: arrayUniquePlugin,
  objectMinProperties: objectMinPropertiesPlugin,
  objectMaxProperties: objectMaxPropertiesPlugin,
  stringDate: stringDatePlugin,
  stringDatetime: stringDatetimePlugin,
  stringTime: stringTimePlugin,
  stringDuration: stringDurationPlugin,
  stringEmail: stringEmailPlugin,
  stringHostname: stringHostnamePlugin,
  stringIdnEmail: stringIdnEmailPlugin,
  stringIdnHostname: stringIdnHostnamePlugin,
  stringRegex: stringRegexPlugin,
  stringUriReference: stringUriReferencePlugin,
  stringIpv4: stringIpv4Plugin,
  stringIpv6: stringIpv6Plugin,
  stringUrl: stringUrlPlugin,
  stringIri: stringIriPlugin,
  stringIriReference: stringIriReferencePlugin,
  stringUriTemplate: stringUriTemplatePlugin,
  stringJsonPointer: stringJsonPointerPlugin,
  stringRelativeJsonPointer: stringRelativeJsonPointerPlugin,
  uuid: uuidPlugin,
  oneOf: oneOfPlugin,
  objectAdditionalProperties: objectAdditionalPropertiesPlugin,
  objectAdditionalPropertiesSchema: objectAdditionalPropertiesSchemaPlugin,
  objectPatternProperties: objectPatternPropertiesPlugin,
  objectPropertyNames: objectPropertyNamesPlugin,
  objectDependentRequired: objectDependentRequiredPlugin,
  objectDependentSchemas: objectDependentSchemasPlugin,
  arrayEach: arrayEachPlugin,
  arrayContains: arrayContainsPlugin,
  tupleBuilder: tupleBuilderPlugin,
  conditionalSchema: conditionalSchemaPlugin,
  compareField: compareFieldPlugin,
} satisfies JsonSchemaBag);
