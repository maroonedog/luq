// One runtime value carrying every member of JsonSchemaBag. Step 26 generates
// the real one inside the full-feature bundle plugin; this fixture exists so
// the converter can be driven before that plugin is written.
import type { JsonSchemaBag } from "../../../../src/json-schema/json-schema-bag.types";
import { requiredPlugin } from "../../../../src/plugins/required";
import { optionalPlugin } from "../../../../src/plugins/optional";
import { nullablePlugin } from "../../../../src/plugins/nullable";
import { literalPlugin } from "../../../../src/plugins/literal";
import { stringMinPlugin } from "../../../../src/plugins/string-min";
import { stringMaxPlugin } from "../../../../src/plugins/string-max";
import { stringPatternPlugin } from "../../../../src/plugins/string-pattern";
import { stringContentEncodingPlugin } from "../../../../src/plugins/string-content-encoding";
import { stringContentMediaTypePlugin } from "../../../../src/plugins/string-content-media-type";
import { numberMinPlugin } from "../../../../src/plugins/number-min";
import { numberMaxPlugin } from "../../../../src/plugins/number-max";
import { numberIntegerPlugin } from "../../../../src/plugins/number-integer";
import { numberMultipleOfPlugin } from "../../../../src/plugins/number-multiple-of";
import { arrayMinLengthPlugin } from "../../../../src/plugins/array-min-length";
import { arrayMaxLengthPlugin } from "../../../../src/plugins/array-max-length";
import { arrayUniquePlugin } from "../../../../src/plugins/array-unique";
import { objectMinPropertiesPlugin } from "../../../../src/plugins/object-min-properties";
import { objectMaxPropertiesPlugin } from "../../../../src/plugins/object-max-properties";
import { stringDatePlugin } from "../../../../src/plugins/string-date";
import { stringDatetimePlugin } from "../../../../src/plugins/string-datetime";
import { stringTimePlugin } from "../../../../src/plugins/string-time";
import { stringDurationPlugin } from "../../../../src/plugins/string-duration";
import { stringEmailPlugin } from "../../../../src/plugins/string-email";
import { stringHostnamePlugin } from "../../../../src/plugins/string-hostname";
import { stringIdnEmailPlugin } from "../../../../src/plugins/string-idn-email";
import { stringIdnHostnamePlugin } from "../../../../src/plugins/string-idn-hostname";
import { stringRegexPlugin } from "../../../../src/plugins/string-regex";
import { stringUriReferencePlugin } from "../../../../src/plugins/string-uri-reference";
import { stringIpv4Plugin } from "../../../../src/plugins/string-ipv4";
import { stringIpv6Plugin } from "../../../../src/plugins/string-ipv6";
import { stringUrlPlugin } from "../../../../src/plugins/string-url";
import { stringIriPlugin } from "../../../../src/plugins/string-iri";
import { stringIriReferencePlugin } from "../../../../src/plugins/string-iri-reference";
import { stringUriTemplatePlugin } from "../../../../src/plugins/string-uri-template";
import { stringJsonPointerPlugin } from "../../../../src/plugins/string-json-pointer";
import { stringRelativeJsonPointerPlugin } from "../../../../src/plugins/string-relative-json-pointer";
import { uuidPlugin } from "../../../../src/plugins/uuid";
import { oneOfPlugin } from "../../../../src/plugins/one-of";
import { objectAdditionalPropertiesPlugin } from "../../../../src/plugins/object-additional-properties";
import { objectAdditionalPropertiesSchemaPlugin } from "../../../../src/plugins/object-additional-properties";
import { objectPatternPropertiesPlugin } from "../../../../src/plugins/object-pattern-properties";
import { objectPropertyNamesPlugin } from "../../../../src/plugins/object-property-names";
import { objectDependentRequiredPlugin } from "../../../../src/plugins/object-dependent-required";
import { objectDependentSchemasPlugin } from "../../../../src/plugins/object-dependent-schemas";
import { arrayEachPlugin } from "../../../../src/plugins/array-each";
import { arrayContainsPlugin } from "../../../../src/plugins/array-contains";
import { tupleBuilderPlugin } from "../../../../src/plugins/tuple-builder";
import { conditionalSchemaPlugin } from "../../../../src/plugins/conditional-schema";
import { compareFieldPlugin } from "../../../../src/plugins/compare-field";

export const jsonSchemaBag = Object.freeze({
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
});

// A compile-time proof that the fixture is the bag, not merely bag-shaped: if
// a member is added to JsonSchemaBag and not to the object above, this line
// stops compiling.
export const jsonSchemaBagFixture: JsonSchemaBag = jsonSchemaBag;
