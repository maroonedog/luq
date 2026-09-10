# json-schema-mapping

## What this covers

`fromJsonSchema()` — the route that reads a Draft-07 JSON Schema at run time
and converts it into a builder chain. The implementation is eight files under
`src/core/plugin/jsonSchema/` (2,390 lines) plus the bundling plugin
`src/core/plugin/jsonSchemaFullFeature.ts` (188 lines).

## The most important fact: the implementation is two separate engines

Reading it through, this area holds **two JSON Schema engines that do not agree
with each other**.

- **Route A, the builder conversion**: `convertJsonSchemaToLuqDSL()` →
  `LuqFieldDSL[]` → `convertDSLToFieldDefinition()` → `applyBaseType()` plus
  `applyConstraints()` → `builder.v(path, fn)`. This is the only thing
  `fromJsonSchema()` actually uses.
- **Route B, a pure-function interpreter**:
  `validateValueAgainstSchema(value, schema, customFormats, rootSchema)` in
  validation-core.ts, and `getDetailedValidationErrors()` in
  error-generation.ts — a recursive validator that interprets the schema on the
  spot. Route A uses it only indirectly, when wrapping `allOf`, `anyOf` and
  `oneOf` in `chain.custom()`.

**Route B is a nearly complete Draft-07 implementation and its tests pass.
Route A is full of holes, and 32 of the 42 fromJsonSchema integration suites
fail** — measured: 32 failed, 10 passed; 104 tests failed, 602 passed. All ten
passing suites are unit tests of Route B's pure functions.

Evidence of what Route A is missing, from running the format integration tests:

- `{type:"string", format:"date"}` with `"2024-13-01"` → **valid = true**, where
  false is expected
- `{type:"string", format:"ipv4"}` with `"999.999.999.999"` → **valid = true**
- `format: "email"` and `format: "date-time"` do fail correctly

That matches `applyConstraints()` (dsl-converter.ts 485-509) exactly: **it wires
only six format words to builder methods** — email, uri, url, uuid, date-time
and datetime. Every other format is silently ignored.

## The ideas worth carrying forward, as opposed to the implementation

1. **Hand it JSON and get the same validator you would have written as a plugin
   chain** —
   `Builder().use(jsonSchemaFullFeaturePlugin).fromJsonSchema(schema).build()`.
   CSP-safe: no eval and no new Function anywhere, confirmed by grepping every
   file.
2. **One keyword maps to one existing plugin.** No separate JSON Schema
   validator is built; `minLength` becomes stringMinPlugin's `.min()` and
   `uniqueItems` becomes arrayUniquePlugin's `.unique()`. That is the design
   intent behind not breaking tree-shaking.
3. **`jsonSchemaFullFeaturePlugin` is the everything-in-one.** It `.use()`s 45
   plugins internally and adds `jsonSchemaPlugin` last. Two ways in: one import
   for anyone who wants to feed it a whole schema, or `jsonSchemaPlugin` plus
   the individual plugins for anyone choosing what they need.
4. **Extending formats through customFormats** —
   `JsonSchemaOptions.customFormats: Record<string, (value) => boolean>`, which
   takes precedence over the built-ins.
5. **An unknown format passes** — `validateFormat`'s final `return true`. That
   is the correct reading of the specification, where a format is an annotation
   by default, and it should be carried forward. error-generation.ts sets
   `isValid = false` in the same situation, contradicting it.

## Every format in the table, all 18, with nothing omitted

| format | The rule as implemented | Draft-07 standard? | Wired into Route A? |
|---|---|---|---|
| `email` | false if it contains `..`, then `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/` | yes | yes, `.email()` |
| `url` | true if `new URL(v)` does not throw | no; a local addition | yes, `.url()` |
| `uri` | `new URL`, falling back to `/^([a-zA-Z][a-zA-Z0-9+.-]*):(.+)$/`, requiring content after a leading `//` | yes | yes, mapped to `.url()` |
| `uri-reference` | `new URL`, falling back to true when it starts with `/` or contains no `:` | yes | no, ignored |
| `uuid` | `/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`, v1 to v5 only | no; added in 2019-09 | yes, `.uuid()` — but the plugin permits v1 to v8, so **they disagree** |
| `date` | `/^\d{4}-\d{2}-\d{2}$/` and `new Date(v).toISOString().startsWith(v)`, a real-date check | yes | **no, ignored — confirmed by measurement** |
| `date-time` | `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/` and `!isNaN(new Date(v))` | yes | yes, `.datetime()` — but the plugin also permits a `+09:00` offset, so **they disagree** |
| `time` | `/^\d{2}:\d{2}:\d{2}(\.\d{3})?$/` with h≤23, m≤59, s<60 | yes | no, ignored |
| `duration` | `/^P(?:(\d+Y)?(\d+M)?(\d+D)?)(?:T(\d+H)?(\d+M)?(\d+(?:\.\d+)?S)?)?$/` | no; 2019-09 | no, ignored |
| `ipv4` | a four-octet expression plus a 0-255 numeric check per part | yes | **no, ignored — confirmed by measurement** |
| `ipv6` | `/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/`, **or unconditionally true if it contains `::`** | yes | no, ignored |
| `hostname` | length ≤253 plus the RFC 1123 label expression | yes | no, ignored |
| `json-pointer` | `/^(\/([^\/~]|~[01])*)*$/` | yes | no, ignored |
| `relative-json-pointer` | `/^[0-9]+#?$/` — **it never looks at the JSON Pointer part** | yes | no, ignored |
| `iri` | `/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/` | yes | no, ignored |
| `iri-reference` | `/^([a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*\|\/[^\s]*\|[^\s:\/]+)$/` | yes | no, ignored |
| `uri-template` | `/^[^{}]*(\{[^{}]+\}[^{}]*)*$/` | yes | no, ignored |
| `regex` | true if `new RegExp(v)` does not throw | yes | no, ignored |

**Draft-07 standard formats not implemented**: `idn-email` and `idn-hostname`.
Neither is in the table, so `validateFormat` returns true unconditionally for
both.

**Three sets of format implementations coexist**, each with its own regular
expressions:

1. `jsonSchema/format-validators.ts`, used by Route B.
2. the individual plugins — `stringEmail.ts`'s `DEFAULT_EMAIL_REGEX`,
   `stringIpv4.ts`'s `IPV4_REGEX`, `stringDatetime.ts`'s strict and lenient
   pair, `uuid.ts`'s v1-to-v8 pattern — used by Route A.
3. an inline switch inside `error-generation.ts`
   (`email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/`, `uri: /^https?:\/\//`, a `uuid` that
   ignores the version nibble), used only for building messages — and it treats
   an unknown format as **invalid**, the opposite of (1).

## Contracts to preserve (14)

### must-preserve (9)

#### fromJsonSchema
- Source: `src/core/plugin/jsonSchema/plugin.ts`
- Shape: fromJsonSchema<TBuilder>(schema: JSONSchema7 | unknown, options?: JsonSchemaOptions): TBuilder — a builder extension method. It calls `this.for()` internally and stacks each flattened field with `fieldBuilder.v(path, definition)`. It returns a FieldBuilder, so `.build()` follows.
- Meaning: takes a schema, recursively flattens its properties, and assembles a validation chain per field. A nested object becomes `'a.b.c'`, an array element `'items[*]'`, and patternProperties `'*'`. A root constraint field, whose path is `''`, is excluded from `.v()`. With `additionalProperties === false` it calls `fieldBuilder.strict()`, and with a `dependentRequired` it adds `requiredIf(data => data[trigger] !== undefined)` to each dependent.

#### jsonSchemaPlugin
- Source: `src/core/plugin/jsonSchema/plugin.ts`
- Shape: BuilderExtensionPlugin<"jsonSchema", "fromJsonSchema", (schema, options?) => TBuilder>, published from src/index.ts and the ./plugins/jsonSchema subpath
- Meaning: the minimal plugin that grows only the fromJsonSchema method. The validating is done by whichever individual plugins the user separately `.use()`d — by design, a missing capability is silently ignored.

#### jsonSchemaFullFeaturePlugin
- Source: `src/core/plugin/jsonSchemaFullFeature.ts`
- Shape: BuilderExtensionPlugin<"jsonSchemaFullFeature", "fromJsonSchema", (schema, options?) => TBuilder>, published from src/index.ts and the ./plugins/jsonSchemaFullFeature subpath
- Meaning: `extendBuilder` calls `builderInstance.use()` on 45 plugins in turn and finally on jsonSchemaPlugin — the everything-in-one. It is the only published symbol the README advertises for JSON Schema, so its name and behaviour (covering all of Draft-07 with one import) must be kept.

#### The precedence of customFormats
- Source: `src/core/plugin/jsonSchema/format-validators.ts`
- Shape: validateFormat(value, format, customFormats), and applyConstraints' format branch
- Meaning: a key present in customFormats always wins over the built-in. On the builder route it is passed to `chain.refine(customFormats[format])` — and since no plugin in src implements `.refine`, nothing is actually attached.

#### An unknown format passes
- Source: `src/core/plugin/jsonSchema/format-validators.ts`
- Shape: validateFormat(...): boolean, whose last line is `return true`
- Meaning: a format name in neither the built-ins nor customFormats counts as valid — the correct reading of the specification, where a format is an annotation by default.

#### validateValueAgainstSchema
- Source: `src/core/plugin/jsonSchema/validation-core.ts`
- Shape: (value: unknown, schema: JSONSchema7, customFormats?, rootSchema?) => boolean
- Meaning: a recursive validator interpreting nearly all of Draft-07. It is the one thing in this area that properly works, and its meaning is preserved by tests. `const` and `enum` are decided by deep equality; undefined is always invalid; null is valid only when `type` contains `'null'` or through enum or const. Boolean schemas are handled inside items, allOf, anyOf, oneOf, not, if, then and else.

#### resolveRef
- Source: `src/core/plugin/jsonSchema/ref-resolver.ts`
- Shape: (ref: string, rootSchema: JSONSchema7, definitions?) => JSONSchema7
- Meaning: local references only, beginning with `'#'`. It accepts both `'#/definitions/X'` and `'#/$defs/X'`, descending into `current.definitions ?? current.$defs` when the segment is either. A general JSON Pointer path such as `'#/properties/foo'` works too. An external reference throws `External $ref not supported`, and an unresolvable one throws `Cannot resolve $ref`.

#### The published names and methods of the 45 plugins jsonSchemaFullFeature bundles
- Source: `src/core/plugin/jsonSchemaFullFeature.ts`
- Shape: requiredPlugin (.required), optionalPlugin (.optional), nullablePlugin (.nullable), requiredIfPlugin (.requiredIf), oneOfPlugin (.oneOf), literalPlugin (.literal), customPlugin (.custom), stringMinPlugin (.min), stringMaxPlugin (.max), stringPatternPlugin (.pattern), stringEmailPlugin (.email), stringUrlPlugin (.url), uuidPlugin (.uuid, whose name is "stringUuid"), stringDatePlugin (.date), stringDatetimePlugin (.datetime), stringIpv4Plugin (.ipv4), stringIpv6Plugin (.ipv6), stringHostnamePlugin (.hostname), stringTimePlugin (.time), stringDurationPlugin (.duration), stringJsonPointerPlugin (.jsonPointer), stringBase64Plugin (.base64), stringIriPlugin (.iri), stringIriReferencePlugin (.iriReference), stringUriTemplatePlugin (.uriTemplate), stringRelativeJsonPointerPlugin (.relativeJsonPointer), stringContentEncodingPlugin (.contentEncoding), stringContentMediaTypePlugin (.contentMediaType), numberMinPlugin (.min), numberMaxPlugin (.max), numberIntegerPlugin (.integer), numberMultipleOfPlugin (.multipleOf), arrayUniquePlugin (.unique), arrayMinLengthPlugin (.minLength), arrayMaxLengthPlugin (.maxLength), arrayContainsPlugin (.contains), objectMinPropertiesPlugin (.minProperties), objectMaxPropertiesPlugin (.maxProperties), objectAdditionalPropertiesPlugin (.additionalProperties), objectPropertyNamesPlugin (.propertyNames), objectPatternPropertiesPlugin (.patternProperties), objectDependentRequiredPlugin (.dependentRequired), objectDependentSchemasPlugin (.dependentSchemas), tupleBuilderPlugin (method `.builder`, allowedTypes ['tuple']), readOnlyWriteOnlyPlugin (.readOnly, with writeOnlyPlugin (.writeOnly) in the same file)
- Meaning: this list IS the table of which JSON Schema keyword falls to which plugin. Plugin names and method names are published API that users write directly, so they must be kept.

#### The package.json exports subpaths
- Source: `package.json`
- Shape: `"./plugins/jsonSchema"`, resolving to the jsonSchema/index.ts barrel, and `"./plugins/jsonSchemaFullFeature"`
- Meaning: the only route into JSON Schema the README shows —
  `import { jsonSchemaFullFeaturePlugin } from "@maroonedog/luq/plugins/jsonSchemaFullFeature"`.
  The subpath names must be kept.

### should-preserve (5)

#### JsonSchemaOptions
- Source: `src/core/plugin/jsonSchema/types.ts`
- Shape: { strictRequired?: boolean; allowAdditionalProperties?: boolean; customFormats?: Record<string, (value: any) => boolean> }
- Meaning: fromJsonSchema's second argument. Only customFormats is actually read. `strictRequired` and `allowAdditionalProperties` appear nowhere in src outside their declaration — entirely dead fields.

#### getDetailedValidationErrors / getSpecificValidationErrors
- Source: `src/core/plugin/jsonSchema/error-generation.ts`
- Shape: (value, schema: JSONSchema7|boolean, customFormats?, rootSchema?, path?) => ValidationError[], and (value, schema, targetPath, customFormats?, rootSchema?) => ValidationError[]
- Meaning: the error code vocabulary is defined here: FALSE_SCHEMA, TYPE_MISMATCH, CONST, ENUM, MIN_LENGTH, MAX_LENGTH, PATTERN, FORMAT, CONTENT_ENCODING, MINIMUM, MAXIMUM, EXCLUSIVE_MINIMUM, EXCLUSIVE_MAXIMUM, MULTIPLE_OF, MIN_ITEMS, MAX_ITEMS, UNIQUE_ITEMS, ADDITIONAL_ITEMS, CONTAINS, MIN_PROPERTIES, MAX_PROPERTIES, REQUIRED, ADDITIONAL_PROPERTIES, PROPERTY_NAMES, ALL_OF, ANY_OF, ONE_OF, NOT. Paths mix the `'a.b'` and `'a[0]'` notations. `getSpecificValidationErrors` normalises a `'/a/b'` form into `'a.b'` and then filters by prefix, splitting on `'.'` and `'['`.

#### ValidationError
- Source: `src/core/plugin/jsonSchema/types.ts`
- Shape: { path: string; message: string; code: string; value?: unknown; constraint?: unknown }
- Meaning: one error originating from a JSON Schema. `code` is from the vocabulary above and `constraint` carries the schema value that was violated.

#### resolveAllRefs
- Source: `src/core/plugin/jsonSchema/ref-resolver.ts`
- Shape: (schema, rootSchema, visited = new Set<string>()) => JSONSchema7
- Meaning: recursively expands `$ref` through properties, items, allOf, anyOf, oneOf, not, if, then and else, throwing `Circular reference detected` on a cycle. It is published and `convertJsonSchemaToLuqDSL` never calls it.

#### formatValidators / getSupportedFormats / isFormatSupported
- Source: `src/core/plugin/jsonSchema/format-validators.ts`
- Shape: Record<string, (value: string) => boolean>, () => string[], (format: string) => boolean
- Meaning: the table of supported formats and the API for asking which names it holds at run time. Eighteen entries: email, url, uri, uri-reference, uuid, date, date-time, time, duration, ipv4, ipv6, hostname, json-pointer, relative-json-pointer, iri, iri-reference, uri-template, regex.

## Behavioural rules

Every Draft-07 keyword, with none omitted. **B** means
`validateValueAgainstSchema`, the pure interpreter whose tests pass; **A** means
`fromJsonSchema`'s builder conversion.

- **$schema** — A ignores, B ignores. It appears zero times across all eight
  files. The new implementation should decide explicitly that it is read and
  discarded.
- **$id** — A ignores, B ignores; zero occurrences. There is no base-URI
  resolution at all.
- **$ref** — A handles it partially: `resolveSchemaRef` is called once at the
  top of `convertJsonSchemaToLuqDSL` and once per property, non-recursively, so
  a `$ref` inside items, allOf, anyOf, oneOf, if, then or else is stored
  unexpanded. B resolves one level at the top of `validateValueAgainstSchema`
  when a rootSchema was passed. `resolveAllRefs`, which is recursive and
  detects cycles, is published and called by neither route. Local references
  only; an external one throws.
- **$comment** — A ignores, B ignores; zero occurrences.
- **definitions / $defs** — `resolveRef` resolves paths through both. Neither is
  walked as a field, not being under properties.
- **title** — A ignores, B ignores; zero occurrences.
- **description** — A ignores, B ignores.
- **default** — A ignores, B ignores. There is no mechanism for applying a
  default.
- **examples** — A ignores, B ignores; zero occurrences.
- **readOnly / writeOnly** — A ignores, B ignores; zero occurrences under
  jsonSchema/. readOnlyWriteOnlyPlugin is bundled by jsonSchemaFullFeature and
  fromJsonSchema never calls it.
- **type** — A maps it through `processSchemaTypes`: string→string,
  number→number, integer→number, boolean→boolean, array→array, object→object,
  null→null, and anything unknown falls back to string. For a type array, if
  one type remains after removing `'null'` it becomes that single type with
  nullable = true; two or more go into `multipleTypes`. With no type and an
  enum, it infers from `typeof enum[0]`; with a const, from `typeof const`. B
  uses `validateType` / `validateMultipleTypes`, where number excludes NaN and
  integer uses `Number.isInteger`.
- **type: "null"** — A has `applyBaseType` return `chain.literal(null)`,
  depending on literalPlugin. B is `value === null`.
- **type: ["string","null"]** and similar — A sets nullable = true and calls
  `chain.nullable()`.
- **type: ["string","number"]** and other multi-type sets without null — A calls
  `builder.oneOf(an array of schema functions)`. But oneOfPlugin's impl
  signature is `(allowedValues: readonly unknown[])`, a list of permitted
  VALUES rather than functions, so the types do not match and it does not work
  as intended. `filterConstraintsForType`'s intent — narrowing the constraints
  per type — is at least readable.
- **enum** — A stores it in `constraints.enum` and `applyConstraints` never
  reads it, so **enum is entirely ignored on the builder route**. B decides it
  correctly with `schema.enum.some(deepEqual)`.
- **const** — A returns `chain.literal(const)` at the top of `applyConstraints`,
  skipping every later constraint and returning immediately. B decides with
  `deepEqual(value, const)` and likewise returns immediately.
- **multipleOf** — A uses `chain.multipleOf(n)`. B uses
  `Number.isInteger(value / multipleOf)`, with no defence against
  floating-point error.
- **maximum** — A uses `chain.max(n)`. B fails on `value > maximum`.
- **exclusiveMaximum** — A, in the numeric form, sets `constraints.max` and
  `exclusiveMax` and calls `chain.max(value, {exclusive:true})`; in the boolean
  form it stores the flag as it is. B fails on `value >= exclusiveMaximum` in
  the numeric form, and in the boolean form combines with `maximum` and fails
  on `value >= maximum` — accepting both, for Draft-04 compatibility.
- **minimum** — A uses `chain.min(n)`. B fails on `value < minimum`.
- **exclusiveMinimum** — symmetrical with the maximum side; both forms
  accepted.
- **maxLength** — A uses `chain.max(n)` from stringMaxPlugin. B fails on
  `value.length > maxLength`. Note this is UTF-16 length, not code points.
- **minLength** — A uses `chain.min(n)` from stringMinPlugin. B fails on
  `value.length < minLength`.
- **pattern** — A uses `chain.pattern(string)`. B uses
  `new RegExp(pattern).test(value)` — unanchored, as the specification says.
- **format** — A has four branches only: email→`.email()`, uri and
  url→`.url()`, uuid→`.uuid()`, date-time and datetime→`.datetime()`. The other
  fourteen are silently ignored, which is why `format: "date"` accepts
  `"2024-13-01"` and `format: "ipv4"` accepts `"999.999.999.999"`. With
  customFormats it calls `chain.refine(fn)`, and no plugin in src provides
  `.refine`. B covers all eighteen through `validateFormat`.
- **contentEncoding** — A stores it and `applyConstraints` never reads it. B
  checks `'base64'` only, with `/^[A-Za-z0-9+/]*={0,2}$/` and a length divisible
  by four. stringContentEncodingPlugin itself handles base64, base32
  (`/^[A-Z2-7]*={0,6}$/`) and binary (`/^[01\s]*$/`), and is not wired in.
- **contentMediaType** — A stores it and never reads it. validation-core states
  that it does nothing, and error-generation's branch is commented out.
  stringContentMediaTypePlugin handles twelve types (application/json,
  text/html, text/xml, text/plain, text/css, text/javascript, application/xml,
  application/pdf, image/png, image/jpeg, image/gif, image/svg+xml) plus
  fallbacks for all of `text/*` (always true), anything containing `json`
  (through JSON.parse) and anything containing `xml`, and it decodes base64 —
  and fromJsonSchema never calls it.
- **items, a single schema** — A generates a child field at the path
  `'path[*]'` for an array-typed property and converts recursively. B validates
  every element against the items schema, handling boolean schemas.
- **items, a tuple array** — A calls `chain.tupleBuilder(items)` and returns
  immediately when `constraints.items` is an array. But tupleBuilderPlugin's
  method name is `builder`, with allowedTypes `['tuple']`, not `tupleBuilder`,
  so the `if (chain.tupleBuilder)` guard silently disables it. B validates each
  index against its schema.
- **additionalItems** — A does not extract it at all. B, in tuple validation,
  fails elements beyond the items length when it is false and validates them
  against the schema when it is an object. There is an ADDITIONAL_ITEMS code.
- **maxItems** — A tries to call `chain.maxItems`, and no plugin in src has the
  method name `maxItems` (arrayMaxLengthPlugin's is `maxLength`), so the guard
  silently ignores it. B fails on `value.length > maxItems`.
- **minItems** — the same as maxItems; silently ignored by A. B fails on
  `value.length < minItems`.
- **uniqueItems** — A uses `chain.unique()`. B detects duplicates in O(n²) with
  deep equality, while error-generation compares with `JSON.stringify` — a
  different implementation that depends on key order.
- **contains** — A stores it and never reads it, even though arrayContainsPlugin
  is bundled. B uses `value.some(item => validate(item, contains))` and handles
  boolean schemas: false always fails, and true fails only on an empty array.
- **maxProperties** — A uses `chain.maxProperties(n)`. B fails on
  `Object.keys(value).length > maxProperties`.
- **minProperties** — the same, in reverse.
- **required** — A sets `constraints.required = true` when the parent schema's
  required array names the field, and calls `chain.required()`. B decides with
  `requiredProp in value`.
- **properties** — A flattens recursively into dotted `'a.b.c'` paths. B
  validates recursively, but iterates the VALUE's keys, so a key present in
  `schema.properties` and absent from the value is not validated — required
  covers that.
- **patternProperties** — A treats the pattern string as a property name and
  generates a field whose path contains a literal asterisk, `'*'` or
  `'parent.*'`; and `applyConstraints` never reads
  `constraints.patternProperties`. B tests each property name against each
  pattern with `new RegExp().test` and validates the matches.
  objectPatternPropertiesPlugin expects
  `Record<string, (value)=>boolean | {validator}>` and cannot take a
  JSONSchema7.
- **additionalProperties** — A calls `fieldBuilder.strict()` only at the root
  (path `''`) and only when it is false. At field level it calls
  `chain.additionalProperties(value)`, and since
  objectAdditionalPropertiesPlugin treats every key not in
  `options.allowedProperties` (default `[]`) as additional, a call from
  fromJsonSchema — which passes no allowedProperties — fails every property.
  `LuqFieldDSL` declares an `allowedProperties` field that is never assigned
  anywhere in src. B rejects, when false, every key matched by neither
  properties nor patternProperties, and validates against the schema when it is
  one.
- **dependencies**, Draft-07's own keyword — A ignores, B ignores; zero
  occurrences under jsonSchema/. In Draft-07 `dependencies` covers both the
  array form (what became dependentRequired) and the schema form (what became
  dependentSchemas), and neither is handled. Only Draft 2019-09's
  `dependentRequired` is read, through `(schema as any).dependentRequired`.
- **propertyNames** — A calls `chain.propertyNames(JSONSchema7)`, and
  objectPropertyNamesPlugin accepts only `RegExp | string | {validator}`, so a
  JSONSchema7 falls to the final else and returns false, failing every property
  name. B validates each key against the propertyNames schema, handling boolean
  schemas: false fails as soon as there is one key.
- **if / then / else** — A stores them and `applyConstraints` never reads any of
  them, so they are entirely ignored. types.ts also declares
  `conditionalValidation` and `requiredIf` fields that are neither assigned nor
  read anywhere. B evaluates the if and validates against then or else,
  returning immediately, and handles boolean schemas. A dedicated
  `conditionalSchemaPlugin` (.conditionalSchema) exists, is exported from
  neither index, is never called by fromJsonSchema, and is entirely dead — its
  definition line is its only occurrence across src and test.
- **allOf** — A delegates to Route B with
  `chain.custom(v => allOf.every(s => validateValueAgainstSchema(v, s)))`, and
  since it passes no rootSchema, a `$ref` inside allOf cannot resolve. B
  validates all of them recursively, handling boolean schemas. error-generation
  emits an ALL_OF error on top of the individual ones.
- **anyOf** — A uses `chain.custom(v => anyOf.some(...))`; B uses `some`. With an
  anyOf directly at the root, `convertJsonSchemaToLuqDSL` returns a single
  field with path `''` and returns immediately, skipping the properties walk
  entirely — and since plugin.ts excludes path `''` from `.v()`, the result is
  **a validator with no validation registered at all**.
- **oneOf** — A uses `chain.custom(v => matches === 1)`; B counts the matches and
  fails on anything but one. At the root it has the same problem as anyOf.
  error-generation distinguishes zero matches from two or more.
- **not** — A stores it and never reads it. B fails when the value matches,
  handling boolean schemas.
- **dependentRequired**, Draft 2019-09 — A reads
  `(schema as any).dependentRequired` at the root only and stacks
  `fieldBuilder.v(dep, b => b.requiredIf(data => data[trigger] !== undefined))`
  per dependent. A nested object's dependentRequired is ignored.
  objectDependentRequiredPlugin is bundled and never called. B ignores it.
- **dependentSchemas**, Draft 2019-09 — A ignores, B ignores.
  objectDependentSchemasPlugin is bundled by jsonSchemaFullFeature and called
  from nowhere; its own `validateAgainstJsonSchema` is a cut-down checker
  looking at type, minLength, maxLength, pattern, minimum, maximum, minItems,
  maxItems, enum, const and required — a different thing again from Route B.
- **unevaluatedProperties / unevaluatedItems / contentSchema / deprecated /
  $anchor / $dynamicRef** — none supported; zero occurrences. They are outside
  Draft-07, and the new implementation should state that explicitly.
- **Boolean schemas**, true or false used as a schema — A does not support them:
  `convertJsonSchemaToLuqDSL` only processes values where
  `typeof propertySchema === 'object'`. B handles them individually inside
  items, allOf, anyOf, oneOf, not, if, then, else, additionalProperties,
  additionalItems, propertyNames and contains, and
  `getDetailedValidationErrors` accepts a top-level boolean schema and returns
  FALSE_SCHEMA.
- **undefined** — B always treats `value === undefined` as invalid, on the
  position that JSON Schema has no undefined. The new implementation has to
  decide how that differs from an optional field being absent.
- **null** — B, for `value === null`, returns true immediately when `type`
  contains `'null'`; false immediately when it does not and there is neither an
  enum nor a const; and otherwise proceeds to the enum or const decision.

## Not carried forward

- **The two-engine arrangement itself** — the builder conversion in
  `applyConstraints` and the recursive interpreter in
  `validateValueAgainstSchema` give different answers to the same schema.
  `format: 'date'` fails in the interpreter and passes in the builder,
  measured. uniqueItems uses deep equality in the interpreter and
  `JSON.stringify` in error generation. The reading of exclusiveMinimum differs
  subtly between them. The new implementation should collapse to a single
  keyword-to-plugin mapping, and a keyword with no plugin should fail
  explicitly rather than be silently ignored — or its plugin should exist.
- **Three implementations of every format** (format-validators.ts, the
  individual stringXxx plugins, and the inline switch in error-generation.ts) —
  three regular expressions run under one format name. All three emails differ;
  uuid is v1-to-v5 in one, v1-to-v8 in another and version-blind in the third;
  date-time rejects a timezone offset in one and accepts it in another. And an
  unknown format is true in one and false in another, exactly opposite. Format
  decisions belong in one place, on the plugin side.
- **`applyConstraints`' duck typing, `if (constraints.x !== undefined && chain.x)`**
  — writing a method name that does not exist (minItems, maxItems,
  tupleBuilder) is not a type error, and the validation silently disappears at
  run time. minItems, maxItems and tuple items are all silently disabled that
  way. A missing plugin should be a type error, or an explicit exception.
- **The constraints extraction stores and applyConstraints never reads** — enum,
  integer, contains, not, if, then, else, patternProperties, contentEncoding,
  contentMediaType, and field-level dependentRequired. Looking supported and
  doing nothing is the worst outcome, and enum, integer and not not working
  contradicts a JSON Schema user's expectations head on. Drop the structure of
  having "stored but unused" fields on a constraints type at all.
- **The intermediate DSL, LuqFieldDSL / LuqConstraints** — it copies the schema
  into a flat structure under different names with no abstraction gained, and
  carries dead fields never assigned anywhere in src: conditionalValidation,
  requiredIf, allowedProperties, multipleTypes. A direct mapping from keyword to
  plugin call is enough.
- **JsonSchemaOptions' strictRequired and allowAdditionalProperties** — zero
  occurrences in src outside their declaration. Entirely dead options. Keep
  customFormats alone, or redefine them if they are meant to do something.
- **conditionalSchemaPlugin** (`src/core/plugin/conditionalSchema.ts`, 130
  lines) — exported from neither index, not bundled by jsonSchemaFullFeature,
  and with its definition line as its only occurrence across src and test:
  entirely dead. Its `evaluateSchema` looks only at type, const and enum inside
  properties, and const and enum at the top — a FOURTH JSON Schema
  interpretation, contradicting Route B again.
- **objectPropertyNamesPlugin, objectPatternPropertiesPlugin, arrayContainsPlugin
  and objectDependentSchemasPlugin taking their own shapes** (a RegExp, a
  `(value)=>boolean`, a `{validator}`) **rather than a JSONSchema7** — this does
  not fit automatic conversion from a schema, and propertyNames given a
  JSONSchema7 fails every property name. A plugin that exists because of JSON
  Schema should take a JSON Schema subschema directly.
- **objectAdditionalPropertiesPlugin depending on `options.allowedProperties`,
  default `[]`** — which properties are declared is something the builder
  knows, and the caller is made to hand it over by hand. fromJsonSchema does
  not, so `additionalProperties: false` fails everything, always. The set of
  declared fields should come from the framework.
- **The early return when oneOf, anyOf or allOf sits at the root**
  (dsl-converter.ts 23-34), abandoning the properties walk and returning one
  field with path `''` — plugin.ts then registers no `.v()` at all, and a
  validator that validates nothing is produced silently. Composition keywords
  and property validation have to coexist.
- **Converting patternProperties into a path containing a literal asterisk,
  `'parent.*'`** — `'*'` can collide with a real property name, and several
  patterns register several fields at one path. Patterns should be a different
  kind of field.
- **The coverage-chasing jsonschema-* test files** — written to fill line
  coverage, as their names say, poking at internal functions with contrived
  arguments and describing not one piece of specification. Many do not compile.
  Replace them with the official Draft-07 test suite.
- **error-generation.ts's independent error-producing engine, 789 lines** — it
  rewrites the whole of `validateValueAgainstSchema`'s decision logic and
  reaches different conclusions in places (format, uniqueItems). The error code
  vocabulary is worth keeping; the implementation should be folded into a
  single path where validation itself returns the errors.

## Published symbols (75)

`fromJsonSchema`, `jsonSchemaPlugin`, `jsonSchemaFullFeaturePlugin`, `JsonSchemaOptions`, `LuqFieldDSL`, `LuqConstraints`, `ValidationError`, `resolveRef`, `resolveSchemaRef`, `resolveAllRefs`, `formatValidators`, `validateFormat`, `getSupportedFormats`, `isFormatSupported`, `validateValueAgainstSchema`, `validateType`, `validateMultipleTypes`, `validateStringConstraints`, `validateNumberConstraints`, `validateArrayConstraints`, `validateObjectConstraints`, `getDetailedValidationErrors`, `getSpecificValidationErrors`, `convertJsonSchemaToLuqDSL`, `convertDSLToFieldDefinition`, `applyConstraints`, `applyBaseType`, `getBaseChain`, `requiredPlugin`, `optionalPlugin`, `nullablePlugin`, `requiredIfPlugin`, `oneOfPlugin`, `literalPlugin`, `customPlugin`, `stringMinPlugin`, `stringMaxPlugin`, `stringPatternPlugin`, `stringEmailPlugin`, `stringUrlPlugin`, `uuidPlugin`, `stringDatePlugin`, `stringDatetimePlugin`, `stringIpv4Plugin`, `stringIpv6Plugin`, `stringHostnamePlugin`, `stringTimePlugin`, `stringDurationPlugin`, `stringJsonPointerPlugin`, `stringBase64Plugin`, `stringIriPlugin`, `stringIriReferencePlugin`, `stringUriTemplatePlugin`, `stringRelativeJsonPointerPlugin`, `stringContentEncodingPlugin`, `stringContentMediaTypePlugin`, `numberMinPlugin`, `numberMaxPlugin`, `numberIntegerPlugin`, `numberMultipleOfPlugin`, `arrayUniquePlugin`, `arrayMinLengthPlugin`, `arrayMaxLengthPlugin`, `arrayContainsPlugin`, `objectMinPropertiesPlugin`, `objectMaxPropertiesPlugin`, `objectAdditionalPropertiesPlugin`, `objectPropertyNamesPlugin`, `objectPatternPropertiesPlugin`, `objectDependentRequiredPlugin`, `objectDependentSchemasPlugin`, `tupleBuilderPlugin`, `readOnlyWriteOnlyPlugin`, `writeOnlyPlugin`, `conditionalSchemaPlugin`
