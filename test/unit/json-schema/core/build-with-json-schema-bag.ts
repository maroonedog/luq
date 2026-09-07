// ===========================================================================
// test/unit/json-schema/core/build-with-json-schema-bag.ts
//
// One builder carrying EVERY member of JsonSchemaBag. ConverterChain<S> is
// defined against that bag, so a chain from a SMALLER builder does not satisfy
// it - which is itself the point: the converter cannot be driven by a builder
// that is missing a plugin the keyword map binds.
// ===========================================================================
import { Builder } from "../../../../src/index";
import { requiredPlugin } from "../../../../src/plugins/required";
import { compareFieldPlugin } from "../../../../src/plugins/compare-field";
import { numberMinPlugin } from "../../../../src/plugins/number-min";
import { stringMinPlugin } from "../../../../src/plugins/string-min";
import { arrayEachPlugin } from "../../../../src/plugins/array-each";
import { conditionalSchemaPlugin } from "../../../../src/plugins/conditional-schema";
import { arrayMaxLengthPlugin } from "../../../../src/plugins/array-max-length";
import { arrayMinLengthPlugin } from "../../../../src/plugins/array-min-length";
import { arrayUniquePlugin } from "../../../../src/plugins/array-unique";
import { numberMaxPlugin } from "../../../../src/plugins/number-max";
import { stringMaxPlugin } from "../../../../src/plugins/string-max";
import { stringPatternPlugin } from "../../../../src/plugins/string-pattern";
import { literalPlugin } from "../../../../src/plugins/literal";
import { oneOfPlugin } from "../../../../src/plugins/one-of";
import { objectAdditionalPropertiesPlugin } from "../../../../src/plugins/object-additional-properties";
import { objectPatternPropertiesPlugin } from "../../../../src/plugins/object-pattern-properties";
import { objectPropertyNamesPlugin } from "../../../../src/plugins/object-property-names";
import { numberIntegerPlugin } from "../../../../src/plugins/number-integer";
import { numberMultipleOfPlugin } from "../../../../src/plugins/number-multiple-of";
import { objectMinPropertiesPlugin } from "../../../../src/plugins/object-min-properties";
import { objectMaxPropertiesPlugin } from "../../../../src/plugins/object-max-properties";
import { objectAdditionalPropertiesSchemaPlugin } from "../../../../src/plugins/object-additional-properties";
import { objectDependentRequiredPlugin } from "../../../../src/plugins/object-dependent-required";
import { objectDependentSchemasPlugin } from "../../../../src/plugins/object-dependent-schemas";
import { arrayContainsPlugin } from "../../../../src/plugins/array-contains";
import { tupleBuilderPlugin } from "../../../../src/plugins/tuple-builder";
import { optionalPlugin } from "../../../../src/plugins/optional";
import { nullablePlugin } from "../../../../src/plugins/nullable";
import { stringContentEncodingPlugin } from "../../../../src/plugins/string-content-encoding";
import { stringContentMediaTypePlugin } from "../../../../src/plugins/string-content-media-type";
import { stringDatePlugin } from "../../../../src/plugins/string-date";
import { stringDatetimePlugin } from "../../../../src/plugins/string-datetime";
import { stringDurationPlugin } from "../../../../src/plugins/string-duration";
import { stringEmailPlugin } from "../../../../src/plugins/string-email";
import { stringHostnamePlugin } from "../../../../src/plugins/string-hostname";
import { stringIdnEmailPlugin } from "../../../../src/plugins/string-idn-email";
import { stringIdnHostnamePlugin } from "../../../../src/plugins/string-idn-hostname";
import { stringRegexPlugin } from "../../../../src/plugins/string-regex";
import { stringUriReferencePlugin } from "../../../../src/plugins/string-uri-reference";
import { stringIpv4Plugin } from "../../../../src/plugins/string-ipv4";
import { stringIpv6Plugin } from "../../../../src/plugins/string-ipv6";
import { stringIriPlugin } from "../../../../src/plugins/string-iri";
import { stringIriReferencePlugin } from "../../../../src/plugins/string-iri-reference";
import { stringJsonPointerPlugin } from "../../../../src/plugins/string-json-pointer";
import { stringRelativeJsonPointerPlugin } from "../../../../src/plugins/string-relative-json-pointer";
import { stringTimePlugin } from "../../../../src/plugins/string-time";
import { stringUriTemplatePlugin } from "../../../../src/plugins/string-uri-template";
import { stringUrlPlugin } from "../../../../src/plugins/string-url";
import { uuidPlugin } from "../../../../src/plugins/uuid";

export const jsonSchemaBagBuilder = Builder()
  .use(requiredPlugin)
  .use(compareFieldPlugin)
  .use(numberMinPlugin)
  .use(stringMinPlugin)
  .use(arrayEachPlugin)
  .use(conditionalSchemaPlugin)
  .use(arrayMaxLengthPlugin)
  .use(arrayMinLengthPlugin)
  .use(arrayUniquePlugin)
  .use(numberMaxPlugin)
  .use(stringMaxPlugin)
  .use(stringPatternPlugin)
  .use(literalPlugin)
  .use(oneOfPlugin)
  .use(objectAdditionalPropertiesPlugin)
  .use(objectPatternPropertiesPlugin)
  .use(objectPropertyNamesPlugin)
  .use(numberIntegerPlugin)
  .use(numberMultipleOfPlugin)
  .use(objectMinPropertiesPlugin)
  .use(objectMaxPropertiesPlugin)
  .use(objectAdditionalPropertiesSchemaPlugin)
  .use(objectDependentRequiredPlugin)
  .use(objectDependentSchemasPlugin)
  .use(arrayContainsPlugin)
  .use(tupleBuilderPlugin)
  .use(optionalPlugin)
  .use(nullablePlugin)
  .use(stringContentEncodingPlugin)
  .use(stringContentMediaTypePlugin)
  .use(stringDatePlugin)
  .use(stringDatetimePlugin)
  .use(stringDurationPlugin)
  .use(stringEmailPlugin)
  .use(stringHostnamePlugin)
  .use(stringIdnEmailPlugin)
  .use(stringIdnHostnamePlugin)
  .use(stringRegexPlugin)
  .use(stringUriReferencePlugin)
  .use(stringIpv4Plugin)
  .use(stringIpv6Plugin)
  .use(stringIriPlugin)
  .use(stringIriReferencePlugin)
  .use(stringJsonPointerPlugin)
  .use(stringRelativeJsonPointerPlugin)
  .use(stringTimePlugin)
  .use(stringUriTemplatePlugin)
  .use(stringUrlPlugin)
  .use(uuidPlugin);
