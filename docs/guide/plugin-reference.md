<!-- GENERATED FILE — do not edit by hand.
     Written by: npm run generate-docs (scripts/generate-docs.ts)
     Source of truth: the plugin directory layout, plus the values
     dist/plugins/*.js actually exports. `npm run check:docs` fails if this
     file and the built package disagree. -->

# Plugin reference (generated)

Every row was produced by loading the built module and reading
`plugin.method` and `plugin.slots` off the exported object. No part of this
table is typed by hand, so it cannot drift away from the implementation.

- **Subpath** — `import { <symbol> } from "@maroonedog/luq<subpath without the leading dot>"`.
- **Method** — the name you call inside a `.v()` chain. It is often not the
  plugin's name: `stringMin` gives `.min()`, `unionGuard` gives `.guard()`,
  `tupleBuilder` gives `.builder()`.
- **Slots** — which `b.<slot>` the method appears on. Choosing a slot the
  field's type cannot be is a **compile** error, not a runtime one.

**78 plugin objects** (isolated 76, extension 2).

| Subpath | Symbol | Method | Slots | Tier |
|---|---|---|---|---|
| `./plugins/arrayContains` | `arrayContainsPlugin` | `.contains()` | `array` `tuple` | isolated |
| `./plugins/arrayEach` | `arrayEachPlugin` | `.each()` | `array` `tuple` | isolated |
| `./plugins/arrayIncludes` | `arrayIncludesPlugin` | `.includes()` | `array` `tuple` | isolated |
| `./plugins/arrayMaxLength` | `arrayMaxLengthPlugin` | `.maxLength()` | `array` `tuple` | isolated |
| `./plugins/arrayMinLength` | `arrayMinLengthPlugin` | `.minLength()` | `array` `tuple` | isolated |
| `./plugins/arrayUnique` | `arrayUniquePlugin` | `.unique()` | `array` `tuple` | isolated |
| `./plugins/booleanFalsy` | `booleanFalsyPlugin` | `.falsy()` | `boolean` | isolated |
| `./plugins/booleanTruthy` | `booleanTruthyPlugin` | `.truthy()` | `boolean` | isolated |
| `./plugins/compareField` | `compareFieldPlugin` | `.compareField()` | `string` `number` `boolean` `date` `object` `array` `tuple` `union` | isolated |
| `./plugins/conditionalSchema` | `conditionalSchemaPlugin` | `.conditionalSchema()` | `object` `array` `string` `number` `boolean` | isolated |
| `./plugins/custom` | `customPlugin` | `.custom()` | every slot | isolated |
| `./plugins/fromContext` | `fromContextPlugin` | `.fromContext()` | `string` `number` `boolean` `date` `object` `array` `tuple` `union` | isolated |
| `./plugins/jsonSchema` | `jsonSchemaPlugin` | `.jsonSchema()` | every slot | extension |
| `./plugins/jsonSchemaFullFeature` | `jsonSchemaFullFeaturePlugin` | `.jsonSchemaFullFeature()` | every slot | extension |
| `./plugins/literal` | `literalPlugin` | `.literal()` | every slot | isolated |
| `./plugins/nullable` | `nullablePlugin` | `.nullable()` | every slot | isolated |
| `./plugins/numberFinite` | `numberFinitePlugin` | `.finite()` | `number` | isolated |
| `./plugins/numberInteger` | `numberIntegerPlugin` | `.integer()` | `number` | isolated |
| `./plugins/numberMax` | `numberMaxPlugin` | `.max()` | `number` | isolated |
| `./plugins/numberMin` | `numberMinPlugin` | `.min()` | `number` | isolated |
| `./plugins/numberMultipleOf` | `numberMultipleOfPlugin` | `.multipleOf()` | `number` | isolated |
| `./plugins/numberNegative` | `numberNegativePlugin` | `.negative()` | `number` | isolated |
| `./plugins/numberPositive` | `numberPositivePlugin` | `.positive()` | `number` | isolated |
| `./plugins/numberRange` | `numberRangePlugin` | `.range()` | `number` | isolated |
| `./plugins/object` | `objectPlugin` | `.object()` | `object` | isolated |
| `./plugins/objectAdditionalProperties` | `objectAdditionalPropertiesPlugin` | `.additionalProperties()` | `object` | isolated |
| `./plugins/objectAdditionalProperties` | `objectAdditionalPropertiesSchemaPlugin` | `.additionalPropertiesSchema()` | `object` | isolated |
| `./plugins/objectDependentRequired` | `objectDependentRequiredPlugin` | `.dependentRequired()` | `object` | isolated |
| `./plugins/objectDependentSchemas` | `objectDependentSchemasPlugin` | `.dependentSchemas()` | `object` | isolated |
| `./plugins/objectMaxProperties` | `objectMaxPropertiesPlugin` | `.maxProperties()` | `object` | isolated |
| `./plugins/objectMinProperties` | `objectMinPropertiesPlugin` | `.minProperties()` | `object` | isolated |
| `./plugins/objectPatternProperties` | `objectPatternPropertiesPlugin` | `.patternProperties()` | `object` | isolated |
| `./plugins/objectPropertyNames` | `objectPropertyNamesPlugin` | `.propertyNames()` | `object` | isolated |
| `./plugins/objectRecursively` | `objectRecursivelyPlugin` | `.recursively()` | `object` `array` | isolated |
| `./plugins/oneOf` | `oneOfPlugin` | `.oneOf()` | `string` `number` `boolean` | isolated |
| `./plugins/optional` | `optionalPlugin` | `.optional()` | every slot | isolated |
| `./plugins/optionalIf` | `optionalIfPlugin` | `.optionalIf()` | every slot | isolated |
| `./plugins/orFail` | `orFailPlugin` | `.orFail()` | every slot | isolated |
| `./plugins/readOnly` | `readOnlyPlugin` | `.readOnly()` | `string` `number` `boolean` `date` `array` `object` | isolated |
| `./plugins/required` | `requiredPlugin` | `.required()` | every slot | isolated |
| `./plugins/requiredIf` | `requiredIfPlugin` | `.requiredIf()` | every slot | isolated |
| `./plugins/skip` | `skipPlugin` | `.skip()` | every slot | isolated |
| `./plugins/stitch` | `stitchPlugin` | `.stitch()` | `string` `number` `boolean` `date` `object` `array` `tuple` `union` | isolated |
| `./plugins/stitchWith` | `stitchWithPlugin` | `.stitchWith()` | `string` `number` `boolean` `date` `object` `array` `tuple` `union` | isolated |
| `./plugins/stringAlphanumeric` | `stringAlphanumericPlugin` | `.alphanumeric()` | `string` | isolated |
| `./plugins/stringBase64` | `stringBase64Plugin` | `.base64()` | `string` | isolated |
| `./plugins/stringContentEncoding` | `stringContentEncodingPlugin` | `.contentEncoding()` | `string` | isolated |
| `./plugins/stringContentMediaType` | `stringContentMediaTypePlugin` | `.contentMediaType()` | `string` | isolated |
| `./plugins/stringDate` | `stringDatePlugin` | `.date()` | `string` | isolated |
| `./plugins/stringDatetime` | `stringDatetimePlugin` | `.datetime()` | `string` | isolated |
| `./plugins/stringDuration` | `stringDurationPlugin` | `.duration()` | `string` | isolated |
| `./plugins/stringEmail` | `stringEmailPlugin` | `.email()` | `string` | isolated |
| `./plugins/stringEndsWith` | `stringEndsWithPlugin` | `.endsWith()` | `string` | isolated |
| `./plugins/stringExactLength` | `stringExactLengthPlugin` | `.exactLength()` | `string` | isolated |
| `./plugins/stringHostname` | `stringHostnamePlugin` | `.hostname()` | `string` | isolated |
| `./plugins/stringIdnEmail` | `stringIdnEmailPlugin` | `.idnEmail()` | `string` | isolated |
| `./plugins/stringIdnHostname` | `stringIdnHostnamePlugin` | `.idnHostname()` | `string` | isolated |
| `./plugins/stringIpv4` | `stringIpv4Plugin` | `.ipv4()` | `string` | isolated |
| `./plugins/stringIpv6` | `stringIpv6Plugin` | `.ipv6()` | `string` | isolated |
| `./plugins/stringIri` | `stringIriPlugin` | `.iri()` | `string` | isolated |
| `./plugins/stringIriReference` | `stringIriReferencePlugin` | `.iriReference()` | `string` | isolated |
| `./plugins/stringJsonPointer` | `stringJsonPointerPlugin` | `.jsonPointer()` | `string` | isolated |
| `./plugins/stringMax` | `stringMaxPlugin` | `.max()` | `string` | isolated |
| `./plugins/stringMin` | `stringMinPlugin` | `.min()` | `string` | isolated |
| `./plugins/stringPattern` | `stringPatternPlugin` | `.pattern()` | `string` | isolated |
| `./plugins/stringRegex` | `stringRegexPlugin` | `.regex()` | `string` | isolated |
| `./plugins/stringRelativeJsonPointer` | `stringRelativeJsonPointerPlugin` | `.relativeJsonPointer()` | `string` | isolated |
| `./plugins/stringStartsWith` | `stringStartsWithPlugin` | `.startsWith()` | `string` | isolated |
| `./plugins/stringTime` | `stringTimePlugin` | `.time()` | `string` | isolated |
| `./plugins/stringUriReference` | `stringUriReferencePlugin` | `.uriReference()` | `string` | isolated |
| `./plugins/stringUriTemplate` | `stringUriTemplatePlugin` | `.uriTemplate()` | `string` | isolated |
| `./plugins/stringUrl` | `stringUrlPlugin` | `.url()` | `string` | isolated |
| `./plugins/transform` | `transformPlugin` | `.transform()` | `string` `number` `boolean` `date` `array` `object` `union` | isolated |
| `./plugins/tupleBuilder` | `tupleBuilderPlugin` | `.builder()` | `tuple` | isolated |
| `./plugins/unionGuard` | `unionGuardPlugin` | `.guard()` | `union` | isolated |
| `./plugins/uuid` | `uuidPlugin` | `.uuid()` | `string` | isolated |
| `./plugins/validateIf` | `validateIfPlugin` | `.validateIf()` | every slot | isolated |
| `./plugins/writeOnly` | `writeOnlyPlugin` | `.writeOnly()` | `string` `number` `boolean` `date` `array` `object` | isolated |

## Deprecated alias subpaths

Not new plugins — a second door kept open so a 1.x import specifier still
resolves. The symbols behind it are the same objects listed above.

| Subpath | Symbol | Method | Slots | Tier |
|---|---|---|---|---|
| `./plugins/readOnlyWriteOnly` | `readOnlyPlugin` | `.readOnly()` | `string` `number` `boolean` `date` `array` `object` | isolated |
| `./plugins/readOnlyWriteOnly` | `writeOnlyPlugin` | `.writeOnly()` | `string` `number` `boolean` `date` `array` `object` | isolated |

## What the tiers mean

- **isolated** — imports nothing but `plugin-kit`, `types`, `path` and its
  own directory. Adding one to your build pulls in none of the other 76.
- **extension** — may additionally import the JSON Schema layer and other
  plugins' **entry files**. `jsonSchemaFullFeature` bundles 49 plugins
  because it sits in this tier; that is also why it is the largest entry
  in the size table in the README.

