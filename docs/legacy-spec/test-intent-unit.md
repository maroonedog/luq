# test-intent-unit

Measured by parsing jest's own result JSON: test/unit held 129 suites and 1888
tests. By suite, 45 were green — one of them,
`plugins/transform/transform-simple.test.ts`, through `describe.skip` with zero
tests — 32 **failed to compile in TypeScript**, and 52 were partial. By test,
1610 passed, 265 failed and 13 were pending.

The compile failures came from importing modules that do not exist
(`src/core/plugin/stringEquals`, `switch`, `any`, `dynamic`,
`recursivelyWithContext`, `src/luq/parser`, `src/ftv/parser`,
`src/ftv/optimized-generator`, `src/luq/optimized-generator`), from lower-case
typos such as `emptyresult`, `validresult` and `nanresult`, and from referring
to properties `MessageContext` does not have.

`src/core/plugin/__tests__/` **holds no tests at all**. Its one file,
`test-utils.ts`, is a single re-export line. There are no unit tests under src.

Reading the 1610 that passed:

**(A) What records real semantics**: the shape of the builder chain, of Result,
and of an error; the field path grammar (`a.b`, `items[*].name`,
`matrix[*][*]`); the division between validate and parse; the plugin descriptor
(name, methodName, category, allowedTypes, create); the plugin registry;
globalConfig; the Draft-07 keyword checks and `fromJsonSchema`; and each
validation plugin's verdict and `code`. These are worth extracting as the
compatibility specification.

**(B) What is worth nothing**: coverage-chasing suites with source line numbers
embedded in their describe names (`coverage-100-percent`, `final-100-percent`,
`coverage-final`, `validator-factory-coverage-boost`,
`validator-factory-advanced`, `jsonSchema-full-coverage`,
`jsonSchema-internals`, `jsonSchema-helper-functions`); the `*-simple.test.ts`
family poking at private internals through `(plugin as any).impl`; white-box
tests of internal optimisation classes (`ultra-fast-validator`, `raw-validator`,
`array-batch-optimizer`, `strategy-factory`, `execution-strategy-selector`,
`field-accessor`, `field-accessor-optimized`, `validation-engine`); and
performance assertions inside unit tests such as `timePerValidation < 1ms`.

Three findings matter more than the rest.

1. **`error.context` is an intended contract that was never implemented.**
   `stringStartsWith` and `numberMax` fail their
   `toMatchObject({code, context:{prefix:"PROD-"}})` because no `context` comes
   back. The equivalent tests for `arrayMaxLength` and `stringExactLength`
   **pass by having their assertion commented out**, with the note "Context
   property is not available in current API". The design intent of structured
   error information survives; the implementation never caught up.
2. **The default of `abortEarly` contradicts itself across the
   implementation.** `validator-factory.ts` writes
   `options?.abortEarly !== false // Default to true` in four places,
   `strategy-factory.ts` writes `abortEarly = false`, and
   `validation-engine.ts` mixes true and false within one file. The observed
   behaviour is one error even when three fields all fail. The test named
   "should collect all errors by default" passes because it was **weakened** to
   `toBeGreaterThanOrEqual(1)`, so it specifies no contract at all.
3. **JSON Schema takes 17% of everything** — 22 of 129 files — with
   `test/unit/plugins/common/jsonSchema*.test.ts` (10 files) and
   `test/unit/plugins/jsonSchema/*.test.ts` (11 files) testing the same subject
   twice. `test/unit/transform/string/` duplicates
   `test/unit/core/transform/string/`, and `plugins/advanced/stitch.test.ts`
   duplicates `plugins/multiFieldReference/stitch.test.ts`.

## Contracts to preserve (46)

### must-preserve (29)

#### The Builder() chain
- Source: `test/unit/plugins/common/required.test.ts`
- Shape: Builder().use(plugin).use(plugin2).for<T>().v(path, b => chain).build() → Validator<T>
- Meaning: `Builder()` takes no arguments. `.use()` registers one plugin at a time and returns a new builder, chainable, with the method appearing at the type level. `.for<T>()` fixes the target TypeScript type and returns a FieldBuilder. `.v()` may be called any number of times, and `.build()` ends it. An existing TypeScript type is passed as it is; no schema has to be redeclared.

#### .v(path, builderFn) / .field(path, builderFn)
- Source: `test/unit/core/builder/field-builder.test.ts`
- Shape: v(path: FieldPath<T>, fn: (b: TypeSlots) => Chain): FieldBuilder<T>
- Meaning: `v` is **the very same reference** as `field` — `expect(fieldBuilder.v).toBe(fieldBuilder.field)` passes. Calls are **immutable** and always return a new builder instance. `path` is a string literal type derived from the object type, so a key that does not exist is a type error.

#### The field path grammar
- Source: `test/unit/core/builder/nested-array-comprehensive.test.ts`
- Shape: "name" | "user.name" | "company.department.team.leader" | "items[*].name" | "matrix[*]" | "matrix[*][*]" | "matrix[*][*].value"
- Meaning: dots nest to any depth. `[*]` means every element of an array, and the array itself (`matrix`), its elements (`matrix[*]`) and an element's property (`items[*].name`) can each carry their own rule. Two dimensions, `[*][*]`, are covered by passing tests. A `required` on `items[*].name` against an empty array **is not an error**: there is nothing to validate, so it is valid.

#### Index notation in an error path
- Source: `test/unit/core/builder/nested-array-comprehensive.test.ts`
- Shape: error.path === "matrix[0][1].value" / "items[0].id" / "user.email"
- Meaning: an error's `path` resolves `[*]` to the actual numeric index. The `matrix[0][1]` form is covered by passing tests to two dimensions.

#### validator.validate(data, options?)
- Source: `test/unit/core/builder/pick-parse.test.ts`
- Shape: validate(data: T, options?: { abortEarly?: boolean }): Result<T>
- Meaning: validates only, and **applies no transform** — `validate({name:"john"}).data().name === "john"`. Options come second.

#### validator.parse(data, options?)
- Source: `test/unit/core/builder/pick-parse.test.ts`
- Shape: parse(data: T, options?): Result<TransformedT>
- Meaning: validates, applies transforms and defaults, and returns the converted data — `parse({name:"john"}).data().name === "JOHN"`. Transforms on nested fields, on array elements (`products[*].name`) and on a whole array are likewise applied only in parse. On failure it returns errors.

#### Result<T>
- Source: `src/types/result.ts`
- Shape: { isValid(): boolean; isError(): boolean; readonly valid: boolean; readonly value: T; data(): T|undefined; unwrap(): T; unwrapOr(d): T; unwrapOrElse(fn): T; map(fn): Result<U>; flatMap(fn): Result<U>; tap(fn): Result<T>; tapError(fn): Result<T>; readonly errors: ValidationError[]; toPlainObject(): {valid,data?,errors} }, with the factories `Result.ok(data)` and `Result.error(errors)`
- Meaning: `data` is a **method**, `errors` a **property**, `valid` a **property** and `isValid` a **method** — all coexisting. On success `errors` is an empty array; on failure `unwrap()` throws. `Result.ok` accepts null, undefined, `""`, 0, false, NaN and a circular reference as valid data alike. `data` returns the reference as it is, with no defensive copy.

#### ValidationError
- Source: `src/types/index.ts`
- Shape: { path: string; message: string; code: string; paths(): string[] }
- Meaning: four fields, fixed. `code` matches the plugin name as a rule (`required`, `optional`, `stringMin`, `numberMin`, `numberMax`, `stringStartsWith`, `booleanTruthy`, `booleanFalsy`, `requiredIf`, `arrayMaxLength` and so on). The exception is `orFail`, whose default code is `validation_error`. `paths()` is a function.

#### ValidationOptions / messageFactory
- Source: `src/core/plugin/types.ts`
- Shape: { code?: string; fieldName?: string; severity?: Severity; messageFactory?: (ctx) => string } — the last argument of every plugin method
- Meaning: every plugin method takes options last, and `messageFactory` replaces the error message. Passing `code` overrides the error code — `orFail(..., {code:"ACCESS_DENIED"})` gives `errors[0].code === "ACCESS_DENIED"`. The context carries at least `{path, value, code}`, and at run time plugin-specific information too: `objectAdditionalProperties` passes `extraProperties`, and a passing test builds a message out of that value.

#### The type slots, `b.<type>`
- Source: `test/unit/core/builder/context/field-type-detector.test.ts`
- Shape: b.string | b.number | b.boolean | b.date | b.array | b.object | b.tuple | b.union
- Meaning: the builder function's argument carries these eight slots, and `allowedTypes` restricts, at the type level, which methods each has. Choosing a slot fixes the field's type; `detectFieldType` returns the name of the slot accessed last.

#### The TypedPlugin descriptor
- Source: `test/unit/core/builder/plugins/plugin-creator.test.ts`
- Shape: { name: string; methodName: string; category: PluginCategory; allowedTypes: readonly TypeName[]; create(): (...args) => Implementation }
- Meaning: a plugin is a static object with no side effects. `name` is the default error code, `methodName` is the method appearing on the chain, `allowedTypes` are the slots it applies to, and `create()` returns the implementation factory. `create` is required — omitting it is a type error.

#### PluginCategory, in full
- Source: `test/unit/core/builder/plugins/plugin-creator.test.ts`
- Shape: "standard" | "conditional" | "fieldReference" | "transform" | "arrayElement" | "context" | "preprocessor" | "builder-extension"
- Meaning: standard validates the value alone; conditional takes `check(value, allValues)` and branches on another field; fieldReference compares against another field; transform carries `transform(value)` and applies in parse; arrayElement works per array element; context takes the three-argument `check(value, allValues, context)`; preprocessor carries `preprocess(value)`; and builder-extension grows a method on the builder itself through `extendBuilder(builder)`, which is what jsonSchemaPlugin is.

#### plugin() / pluginPredefinedTransform() / pluginConfigurableTransform() / pluginBuilderExtension()
- Source: `test/unit/core/builder/plugins/plugin-creator.test.ts`
- Shape: plugin({name, methodName, allowedTypes, category, impl}) → TypedPlugin
- Meaning: the published factories for creating a plugin. `pluginPredefinedTransform({name, allowedTypes, impl})` sets methodName to name and category to "transform" automatically and makes an argument-free transform; `pluginConfigurableTransform` makes one with arguments. A transform's result has the shape `{valid, isValid(), __isTransform: true, __transformFn}`.

#### requiredPlugin
- Source: `test/unit/plugins/common/required.test.ts`
- Shape: .required(options?) — allowedTypes: string, number, boolean, date, array, object, tuple, union; code: "required"
- Meaning: rejects undefined, null and **the empty string `""`**. Accepts 0, false, `[]` and `{}` as values. It works on nested paths (`user.name`, four levels) and on array elements (`items[*].name`), and where no element exists — an empty array — it is valid.

#### optionalPlugin
- Source: `test/unit/plugins/common/optional.test.ts`
- Shape: .optional(options?); category: "standard"; code: "optional"
- Meaning: accepts undefined and a missing key. **It rejects null**, with an error under the code `optional`. It accepts the empty string. When a value is present, the rest of the chain runs normally.

#### The shared rule that an undefined value skips the rest
- Source: `test/unit/plugins/array/arrayMinLength.test.ts`
- Shape: b.<type>.optional().<anyValidator>(...)
- Meaning: combined with optional, an undefined value runs no later validator and is valid. This is covered consistently across the tests for arrayMinLength, arrayMaxLength, arrayIncludes, numberMin, numberMax, numberMultipleOf, numberInteger, numberPositive, numberNegative, numberRange, stringMin, stringMax, stringPattern, stringUrl, stringAlphanumeric, stringStartsWith, stringExactLength, uuid and booleanTruthy.

#### requiredIfPlugin
- Source: `test/unit/plugins/conditional/requiredIf.test.ts`
- Shape: .optional().requiredIf((allValues) => boolean, options?); code: "requiredIf"
- Meaning: required when the condition is true and optional when it is false. The condition receives the whole root value object and may look at booleans, numbers, arrays, nested fields and combinations of fields. Several requiredIf calls may be chained on one field.

#### skipPlugin
- Source: `test/unit/plugins/conditional/skip.test.ts`
- Shape: .skip((allValues) => boolean, options?); category: "conditional"; allowedTypes: string, number, boolean, array, object
- Meaning: when the condition is true, **all validation of that field is skipped** and it counts as valid (`shouldSkipAllValidation`). It takes effect wherever it sits in the chain — `.skip().required().min()` and `.required().min().skip()` behave the same. When false, validation proceeds normally and the error code is the original validator's, such as `stringMin`. Several skip conditions may be chained.

#### customPlugin
- Source: `test/unit/core/builder/pick-parse.test.ts`
- Shape: .custom((value, rootData) => boolean, { code?, messageFactory? })
- Meaning: the general escape hatch for an arbitrary predicate. The second argument is the root data, which is what makes cross-field validation possible. `code` names the error code.

#### transformPlugin
- Source: `test/unit/plugins/transform/transform-array-restrictions.test.ts`
- Shape: .transform((value) => newValue); category: "transform"; allowedTypes: string, number, boolean, array, object, date, union
- Meaning: always passes validation and converts the value. **It applies in parse and not in validate.** Converting to `Array<primitive>` is permitted; converting to `Array<object>` is intended to be forbidden at the type level, through `IsForbiddenTransformOutput`. It works on empty and nested arrays.

#### The string plugins
- Source: `test/unit/plugins/string/stringMin.test.ts`
- Shape: .min(n) .max(n) .exactLength(n) .pattern(regexp) .email() .url() .alphanumeric() .startsWith(s) .endsWith(s) .datetime() .contentMediaType(mime) .uuid()
- Meaning: length is in UTF-16 code units — a surrogate pair counts as two, a Japanese character as one. `min(0)` permits the empty string. `pattern` handles flagged expressions (i, m), non-ASCII, backslashes and special characters. `datetime` is ISO 8601, permitting milliseconds and various offsets and rejecting surrounding whitespace. `uuid` accepts v1, v3, v4 and v5 and is strict about hyphen positions. `contentMediaType` checks application/json (including base64-encoded), text/html, application/xml, text/plain (always valid), text/css and application/javascript, and is permissive with an unknown MIME type. `url` accepts credentials, IDN, IP hosts and complex queries and fragments.

#### The number plugins
- Source: `test/unit/plugins/number/numberRange.test.ts`
- Shape: .min(n) .max(n) .integer() .positive() .negative() .finite() .multipleOf(n) .range(min, max)
- Meaning: `positive()` rejects 0 and -0; `negative()` rejects 0 and accepts -0. `integer()` rejects Infinity and NaN. `min` and `max` include their boundary, and `range(min, max)` includes both ends. An invalid argument — min greater than max, or NaN — produces **an error message at validation time rather than an exception at construction** ("Plugin configuration error", "Cannot use NaN values"). `range(-Infinity, Infinity)` accepts every number.

#### The array plugins
- Source: `test/unit/plugins/array/arrayUnique.test.ts`
- Shape: .minLength(n) .maxLength(n) .unique() .includes(value) .contains(valueOrSchema)
- Meaning: `unique()` is based on `===` / SameValue — objects compare by reference, NaN differs from itself so `[NaN, NaN]` counts as unique, and case matters. An empty array and a single element are unique. `includes` is strict equality, distinguishing type and case. `maxLength(0)` permits only an empty array. Sparse arrays and array-like objects are handled. `contains` takes either a bare value or `{validator, message}`, corresponding to JSON Schema's contains.

#### booleanTruthyPlugin / booleanFalsyPlugin
- Source: `test/unit/plugins/boolean/booleanTruthy.test.ts`
- Shape: .boolean.truthy(options?) / .boolean.falsy(options?); codes "booleanTruthy" and "booleanFalsy"
- Meaning: `truthy()` accepts only true and `falsy()` only false. **Nothing is coerced.** undefined is skipped when combined with optional. Both work on nested fields and on objects inside arrays.

#### jsonSchemaPlugin and .fromJsonSchema()
- Source: `test/unit/plugins/jsonSchema/plugin.test.ts`
- Shape: jsonSchemaPlugin = { name: "jsonSchema", category: "builder-extension", extendBuilder(builder) } → builder.fromJsonSchema(schema: JSONSchema7, options?: { customFormats?: Record<string,(v)=>boolean>, strictRequired?: boolean }): builder
- Meaning: a builder-extension plugin. `extendBuilder` grows `fromJsonSchema` on the builder. It walks the schema, converts each property into a `builder.v(path, definition)`, and **returns the builder itself** so the chain continues. Seeing `additionalProperties: false` it calls `builder.strict()`. It lowers `dependentRequired` into conditional requirements. Root object constraints, where the path is `""`, are not passed to `v()`. It resolves nesting, array items, and `$ref` / definitions.

#### The Draft-07 keywords supported, in full
- Source: `test/unit/plugins/jsonSchema/validation-core.test.ts`
- Shape: type / enum / const / multipleOf / maximum / exclusiveMaximum (both the number and the draft-04 boolean) / minimum / exclusiveMinimum (number and boolean) / maxLength / minLength / pattern / items (single schema and tuple) / additionalItems (false, true, schema) / maxItems / minItems / uniqueItems / contains / maxProperties / minProperties / required / properties / patternProperties / additionalProperties (false, true, schema) / propertyNames / dependentRequired (a draft-2019 extension) / dependentSchemas / if / then / else / allOf / anyOf / oneOf / not / format / contentEncoding / contentMediaType / definitions / $defs / $ref / title / description / default / readOnly / writeOnly / examples / deprecated / boolean schema (true always valid, false always invalid)
- Meaning: the passing tests for `validateValueAgainstSchema` and `getDetailedValidationErrors` (49 and 41) cover checking all of these and producing detailed errors. Types are null, boolean, string, number, integer, array and object, plus type arrays — `["string","null"]` is treated as nullable. `$ref` resolves only internal references, `#/definitions/...` and `#/$defs/...`, and **throws** on an external one. Cycles are detected with a visited set to avoid an infinite loop. The empty schema `{}` is always valid.

#### The format validators, in full
- Source: `test/unit/plugins/jsonSchema/format-validators.test.ts`
- Shape: email / url / uri / uri-reference / uuid / date / date-time / time / duration / ipv4 / ipv6 / hostname / json-pointer / relative-json-pointer / iri / iri-reference / uri-template / regex
- Meaning: `validateFormat(value, formatName, customFormats?)` prefers customFormats, falls back to the built-in one, and **returns true** when neither exists — an unknown format is permitted. A customFormats entry that is not a function also returns true. `getSupportedFormats()` lists the names and `isFormatSupported(name)` answers whether one is there. Non-string input does not crash it.

#### The type guard utilities
- Source: `test/unit/core/utils/type-guards.test.ts`
- Shape: isObject / isPlainObject / isString / isNumber / isBoolean / isFunction / isArray / isNullish / isUndefined / isNull / isError / hasProperty / isValidDate / isFiniteNumber / isInteger / isOneOfTypes
- Meaning: `isObject` is false for arrays, null and functions. `isPlainObject` is additionally false for Date, RegExp and class instances. `isValidDate` is false for an Invalid Date. `hasProperty` is true for symbol and number keys and for inherited properties. `isOneOfTypes(value, guards[])` is false for an empty array. **These fit the new rule of no `as any` and unknown-plus-type-guard exactly, and are worth reimplementing as they are.**

#### Patterns for validating nested structures
- Source: `test/unit/core/builder/nested-array-comprehensive.test.ts`
- Shape: v("matrix") + v("matrix[*]") + v("matrix[*][*]"); v("products") + v("products[*].name"); v("a.b.c.d")
- Meaning: arrays within arrays (two dimensions), objects within arrays, objects within objects at depth, jagged arrays, matrix-shaped object arrays, empty nested arrays, optional nested arrays, nulls inside nested arrays, self-referential structures and mixed primitive arrays are all covered by passing tests. Deep nesting does not overflow the stack.

### should-preserve (17)

#### validator.pick(path)
- Source: `test/unit/core/builder/pick-parse.test.ts`
- Shape: pick(path): { validate(value, rootData?): {valid, value, errors}, parse?(value): {valid, value, errors} }
- Meaning: carves out a single-field validator. What comes back is `{valid, value, errors}` rather than a Result. Passing root data as the second argument is what makes cross-field checks such as `custom` work. Nested paths (`profile.name`) and array paths can be picked. A path that does not exist does not throw.

#### The plugin implementation object
- Source: `test/unit/core/builder/plugins/plugin-creator.test.ts`
- Shape: { check(value, allValues?, context?): boolean; code: string; getErrorMessage(value, path): string; params: unknown[]; transform?; preprocess?; shouldSkipAllValidation? }
- Meaning: what `plugin()`'s `impl` returns. `check` is a pure function answering a boolean. A transform has `check` always true and the substance in `transform`. A skip has `shouldSkipAllValidation(allValues)`.

#### createPluginRegistry() / createFieldRule()
- Source: `test/unit/core/field-rule-defaults.test.ts`
- Shape: createPluginRegistry().use(p1).use(p2).createFieldRule<T>(ctx => ctx.string.required().min(3), defaultOrOptions) → FieldRule<T>
- Meaning: a way to make a reusable rule for one field independently of a builder. A FieldRule has `.validate(value)` and `.parse(value)`, both returning `{valid, data()}`. The second argument is either a bare default value or `{name, description, fieldOptions:{default, applyDefaultToNull}}`. A builder folds one in with `.useField(path, rule)`.

#### Defaults and field options in .v()'s third argument
- Source: `test/unit/core/field-level-defaults.test.ts`
- Shape: v(path, fn, defaultValue) | v(path, fn, { default, applyDefaultToNull?, description?, deprecated?, metadata? })
- Meaning: a default may be a bare value or a `() => value` function. It applies to an undefined field during `parse()`, so `parse({})` fills every default in. Only with `applyDefaultToNull: true` does null get replaced too; with false, null is kept. `description`, `deprecated` and `metadata` are accepted as metadata.

#### .strict()
- Source: `test/unit/core/builder/field-builder.test.ts`
- Shape: fieldBuilder.strict(): FieldBuilder
- Meaning: turns on the strict mode that rejects undeclared properties, and returns the builder so the chain continues. `fromJsonSchema` calls it internally on seeing `additionalProperties: false`.

#### The abortEarly option on validate and parse
- Source: `test/unit/core/builder/nested-array-comprehensive.test.ts`
- Shape: validate(data, { abortEarly: boolean })
- Meaning: `abortEarly: true` stops at the first error; false collects every field's, returning both `matrix[0][1]` and `matrix[1][1]`. **The default contradicts itself across the implementation and is not settled as a contract.**

#### orFailPlugin
- Source: `test/unit/plugins/conditional/orFail-simple.test.ts`
- Shape: .orFail((allValues) => boolean, options?); default code "validation_error"
- Meaning: **fails unconditionally** when the condition is true — a guard, a forbidden condition. When false it passes. `{code: "..."}` replaces the error code.

#### validateIfPlugin
- Source: `test/unit/plugins/conditional/validateIf.test.ts`
- Shape: .validateIf((allValues) => boolean, options?)
- Meaning: runs the later validation only when the condition is true. Only three things pass — that it runs when true, that it composes with other validators, and that error information appears. "Skips when false" fails, the implementation being incomplete.

#### compareFieldPlugin
- Source: `test/unit/plugins/common/compareField.test.ts`
- Shape: .compareField(otherPath, comparator?, options?); category: "fieldReference"
- Meaning: compares against another field, with `===` when no comparator is given. A custom comparator handles date ordering, numeric ordering, array lengths, string containment and object property comparison. It works for null and undefined, objects and arrays alike, and does not crash when the referenced field is absent.

#### fromContextPlugin
- Source: `test/unit/plugins/context/fromContext.test.ts`
- Shape: .fromContext({ key?, required?, fallbackToValid?, validate: (value, ctxData, allValues) => boolean | {valid, message}, ... })
- Meaning: validates against asynchronous context — data injected from outside — or against `allValues`. With no context supplied it falls back to `allValues`. `required: true` makes a missing context an error. An exception from the validation function is caught and converted into an error result. A `passwordConfirmation` helper is provided. For the conditional required decision, null and undefined count as empty while 0 and false count as values.

#### objectRecursivelyPlugin, also exported as recursivelyPlugin
- Source: `test/unit/plugins/advanced/objectRecursively.test.ts`
- Shape: .object.required().recursively(fieldPathOrPaths, options?) — one or two arguments required
- Meaning: applies the same rules recursively to a self-referential field of the same type. The `[*]` notation recurses into array elements. A maximum depth can be set. Mutual references, several recursion paths, cycles and null or undefined are all handled safely. Tree structures such as an organisation hierarchy are the use.

#### literalPlugin
- Source: `test/unit/plugins/common/literal-simple.test.ts`
- Shape: .literal(value, options?); category: "standard"; allowedTypes includes string, number, boolean and null
- Meaning: strict equality with the given literal. Strings are case-sensitive, and `""`, null and undefined do not match. It takes a custom `code` and `messageFactory`.

#### objectAdditionalPropertiesPlugin
- Source: `test/unit/plugins/common/objectAdditionalProperties.test.ts`
- Shape: .object.additionalProperties(false | true | schema, { allowedProperties: string[], messageFactory? })
- Meaning: `false` rejects properties outside the allow list; `true` permits anything; a schema checks each additional property against `{type, minLength, ...}`. `extraProperties: string[]` reaches messageFactory. An empty allow list is handled.

#### objectPropertyNamesPlugin / objectPatternPropertiesPlugin / objectDependentRequiredPlugin / arrayContainsPlugin
- Source: `test/unit/plugins/jsonschema-extensions.test.ts`
- Shape: .object.propertyNames(RegExp | {validator,message}) / .object.patternProperties({ "^prefix_": (v)=>boolean }) / .object.dependentRequired({ key: string[] | {required: string[], message} }) / .array.contains(value | {validator,message})
- Meaning: JSON Schema's propertyNames, patternProperties, dependentRequired and contains, made usable directly as plugins. Each takes a custom message and includes that wording in the error. dependentRequired applies at the root path `""` too.

#### The jsonSchema module's published functions
- Source: `test/unit/plugins/jsonSchema/index.test.ts`
- Shape: validateValueAgainstSchema(value, schema) / getDetailedValidationErrors(value, schema, path?, opts?) / getSpecificValidationErrors(value, schema, fieldPath) / convertJsonSchemaToLuqDSL(schema, parentPath?, requiredList?) / convertDSLToFieldDefinition(dsl) / resolveRef(ref, rootSchema) / resolveSchemaRef / resolveAllRefs / validateFormat / getSupportedFormats / isFormatSupported
- Meaning: seven symbols are exported from `src/core/plugin/jsonSchema/index.ts` — jsonSchemaPlugin, validateValueAgainstSchema, getDetailedValidationErrors, getSpecificValidationErrors, convertJsonSchemaToLuqDSL, convertDSLToFieldDefinition and resolveRef. `jsonSchemaFullFeaturePlugin` is not among them; it is exported only from `src/core/plugin/index.ts`. `getSpecificValidationErrors` narrows errors by both exact path match and prefix match.

#### globalConfig
- Source: `test/unit/core/global-config.test.ts`
- Shape: globalConfig.setConfig(partial) / getConfig() / reset(), plus the functions setGlobalConfig / getGlobalConfig / resetGlobalConfig and the type GlobalConfig
- Meaning: the defaults are `messageKeyPrefix: ""`, `toBooleanTruthyValues: ["true","1","yes","on"]`, `numberFormat: {decimalSeparator: ".", thousandSeparator: ","}`, `dateFormat: "YYYY-MM-DD"`, `trimStrings: false`, `caseSensitive: true` and `customTransforms: {}`. `setConfig` is a partial update, and `numberFormat` merges rather than replaces. The getter returns a copy that cannot be broken from outside. `reset()` restores the defaults and keeps object independence afterwards.

#### The string transform helpers
- Source: `test/unit/core/transform/string/sanitize.test.ts`
- Shape: createDefaultValue(defaultStr) / createReplace(search, replacement) / createReplaceAll(search, replacement) / sanitize(str)
- Meaning: `createDefaultValue` substitutes only for null and undefined, keeping `""` and a whitespace-only string as real values. `createReplace` replaces only the first occurrence, handling regular expressions, groups and the g, i and m flags; `createReplaceAll` replaces all of them, handling regex metacharacters, an empty search string and overlapping patterns safely. `sanitize` escapes `& < > " ' /` into HTML entities, re-escaping already-escaped content uniformly so that the result does not depend on order. All of it is CSP-safe: regular expressions and native string operations only, with no eval and no new Function.

## Behavioural rules

- Keep the chain `Builder().use(p).for<T>().v(path, b => chain).build()` and its division of labour: `.use` one plugin at a time, `.for<T>` fixing the type, `.v` repeatable, `.build` terminal.
- `.v` and `.field` must be references to the same function. Keep the immutable design where a builder returns a new instance per call.
- Field paths are dotted `a.b.c` plus the `[*]` array wildcard, and nothing else. Support all three of `items[*].name`, `matrix[*][*]` and `matrix[*][*].value`.
- An error's `path` resolves `[*]` to the concrete index, as in `matrix[0][1].value`.
- `validate()` must apply no transform. Only `parse()` applies transforms and defaults. This separation must be kept.
- `Result` carries `isValid()`, `isError()`, `unwrap()`, `unwrapOr()`, `unwrapOrElse()`, `map()`, `flatMap()`, `tap()`, `tapError()`, `data()` and `toPlainObject()` as methods, and `errors` and `valid` as properties. The asymmetry of `data` being a method while `errors` is a property is written directly into existing users' code, so changing it has to be a deliberate decision.
- `ValidationError` is `{path, message, code, paths()}`, and `code` defaults to the plugin's name (required, optional, stringMin, numberMax, booleanTruthy, requiredIf, arrayMaxLength and so on).
- Every plugin method takes options last, including `{code?, messageFactory?}`. `code` overrides the error code and `messageFactory` replaces the message.
- The context handed to `messageFactory` is typed per plugin: `{path, value, code}` plus `min` for stringMin, `maxLength` for arrayMaxLength, `extraProperties` for objectAdditionalProperties, `fieldValues` for compareField. The previous implementation typed only one shared `MessageContext`, which is why six test files fail to compile. Solve it with a discriminated union or with generics.
- `required` rejects undefined, null and the empty string `""`, and accepts 0, false, `[]` and `{}`.
- `optional` accepts undefined and **rejects null**. Permitting null is `nullable`'s job, and the two must not be confused.
- When an optional field is undefined, not one later validator runs.
- A plugin is a static object with no side effects carrying `{name, methodName, category, allowedTypes, create()}`, and `allowedTypes` restricts the applicable slots at the type level.
- Keep the eight type slots: string, number, boolean, date, array, object, tuple, union.
- Keep the eight plugin categories: standard, conditional, fieldReference, transform, arrayElement, context, preprocessor, builder-extension.
- Keep all four factories — `plugin()`, `pluginPredefinedTransform()`, `pluginConfigurableTransform()`, `pluginBuilderExtension()` — as published API.
- `jsonSchemaPlugin` has category `builder-extension`, grows `fromJsonSchema(schema, options?)` through `extendBuilder(builder)`, and **returns the builder itself so the chain continues**.
- `fromJsonSchema` lowers `additionalProperties: false` into `builder.strict()` and `dependentRequired` into conditional requirements, and does not pass a root object constraint, whose path is empty, to `v()`.
- An unknown JSON Schema `format` **passes as valid**. When `customFormats` is given it wins, and an entry that is not a function is ignored and passes.
- `$ref` resolves only internal references, `#/definitions/…` and `#/$defs/…`, and throws on an external one. Cycles are detected with a visited set to avoid an infinite loop.
- All of it without `eval` or `new Function`; the existing format checks and transforms are written with regular expressions and native operations only.
- Settle on ONE treatment of an invalid plugin argument (`range(100, 50)`, `range(NaN, 100)`). The previous implementation errors at validation time in numberRange and is expected to throw in arrayMinLength.
- The type guards (isObject, isPlainObject, …, isOneOfTypes) fit the new rule of no `as any` and unknown-plus-type-guard exactly, and should be reimplemented as published utilities.
- Keep globalConfig's defaults (`messageKeyPrefix=""`, `toBooleanTruthyValues=["true","1","yes","on"]`, `numberFormat={".",","}`, `dateFormat="YYYY-MM-DD"`, `trimStrings=false`, `caseSensitive=true`, `customTransforms={}`) along with partial updates, numberFormat merging, and the getter returning a copy.
- New tests must stop checking a validate result with both `.valid` and `.isValid()`; pick one. The old tests mix them within one file.
- New tests must not put source line numbers in a describe or test name. Line-number naming is evidence of coverage-chasing and becomes a lie at the first refactor.
- New tests must not poke at a plugin's private `impl` through `(plugin as any).impl`. Verify through the published `create()` or through the builder's behaviour.
- New tests must not assert on elapsed time (`timePerValidation < 1ms` and the like). It is unstable in CI and is not a behavioural specification.

## Not carried forward

- **The coverage-chasing suites with source line numbers in their names**: `test/unit/plugins/jsonSchema/coverage-100-percent.test.ts` (842 lines, 44 passing), `final-100-percent.test.ts` (385 lines, 16 passing), `coverage-final.test.ts` (453 lines, does not compile), `test/unit/core/builder/validator-factory-coverage-boost.test.ts` (486 lines, 14 passing), `validator-factory-advanced.test.ts` (418 lines, 10 passing), `test/unit/plugins/common/jsonSchema-full-coverage.test.ts` (876 lines, does not compile), `jsonSchema-internals.test.ts` (546 lines, does not compile) and `jsonSchema-helper-functions.test.ts` (513 lines, 14 passing). Names such as "dsl-converter.ts - Lines 149-160" and "Ultra-fast validator paths (lines 1602-1783)" record the work of filling unreached lines, not a specification; rebuild the implementation and every line number becomes meaningless. Over 4,500 lines and 98 passing tests, specifying not one independent piece of meaning.
- **The white-box tests poking at a plugin's private `impl`**: `literal-simple.test.ts` (1 passing, 12 failing), `optional-simple.test.ts` (1/8), `conditional/skip-simple.test.ts` (1/9), `transform/transform-simple.test.ts` (all skipped) and `transform-comprehensive.test.ts` (2/19). All of them call `(plugin as any).impl(...)`, and since `impl` is not published, 48 of 48 tests fail or are skipped. Using `as any` breaks the new rule to begin with, and the subject is an implementation detail. The one valuable part that passes — checking a plugin's metadata (name, methodName, category, allowedTypes) — is what moves to the new tests.
- **The white-box tests of the internal optimisation layer**: `ultra-fast-validator.test.ts` (27 passing), `raw-validator.test.ts` (14/6), `array-batch-optimizer.test.ts` (does not compile), `optimization/strategy-factory.test.ts` (12/4), `execution-strategy-selector.test.ts` (12 passing), `validation-engine.test.ts` (does not compile), `plugin/utils/field-accessor.test.ts` (39 passing), `field-accessor-optimized.test.ts` (45/8), `core/simple-nested-array.test.ts` (2/2), `core/nested-array-batching.test.ts` (2/3). They pin the very existence of unpublished optimisation internals — `createUltraFastSingleFieldValidator`, `createUltraFastMultiFieldValidator`, `createRawValidator`, `createOptimalStrategy`, `prewarmCache`, `clearAllCaches`, an accessor cache. One of them, "should reuse result objects for performance", even contracts the reuse of a mutable result object, unfairly constraining the new design. Keep only the externally observable behaviour — correct values, no failure at depth — as integration tests.
- **The tests that fail to compile because they import modules that do not exist**: `luq/parser.test.ts` (672 lines), `luq/optimized-generator.test.ts` (763), `ftv/parser.test.ts` (549), `ftv/optimized-generator.test.ts` (554), `plugins/advanced/switch.test.ts`, `recursivelyWithContext.test.ts`, `plugins/string/stringEquals.test.ts`, `plugins/common/jsonSchema-composition.test.ts` and `jsonSchema-draft07-compliance.test.ts`. The modules were deleted from src. Over 2,500 lines of entirely dead code, and the `.luq` DSL parser and generator moved to a different implementation altogether. Nothing here carries into a TypeScript library's specification.
- **The tests that fail to compile because of a lower-case typo**: `stringEmail.test.ts` and `stringEndsWith.test.ts` (`emptyresult`), `numberFinite.test.ts` (`positiveInfinityresult`), `oneOf.test.ts` (`nanresult`), `core/multidimensional-array.test.ts` and `core/execution-order-integration.test.ts` (`validresult`). A failed bulk replacement left `const emptyResult = ...` referenced as `emptyresult` across six files — evidence they were never run, so their correctness is unverified either. **What they intended to check** (email format, a suffix, rejecting Infinity, matching an enumeration) is worth rewriting.
- **The hollow tests that pass by having their assertion commented out**: `arrayMaxLength.test.ts:349` ("the error context includes the maximum length"), `stringExactLength.test.ts:206` ("the error context includes the expected length") and `validator-factory.test.ts:249` ("should collect all errors by default"). The first two seal `expect(result.errors[0].context).toMatchObject(...)` behind `// Context property is not available in current API`, leaving only `isValid() === false`. The third was weakened to `toBeGreaterThanOrEqual(1)`, permitting the exact opposite of what its name says. This is deleting a contract to turn a test green, and carried forward it hides the fact that there is no contract.
- **Duplicated test directories**: `test/unit/transform/string/{replace,sanitize}.test.ts` (13+7 tests) against `test/unit/core/transform/string/{replace,sanitize}.test.ts` (46+34); `plugins/advanced/stitch.test.ts` (761 lines) against `plugins/multiFieldReference/stitch.test.ts` (460); and `plugins/common/jsonSchema*.test.ts` (10 files) against `plugins/jsonSchema/*.test.ts` (11). One subject tested twice in two directories. JSON Schema alone is 22 of 129 suites, 17%, with over 5,000 duplicated lines, and both stitch files fail to compile. Reorganise so that one subject has one file.
- **Performance assertions inside unit tests**: `required.test.ts`'s "runs fast even with many fields" (`timePerValidation < 1`), and the same in numberMin, stringMin, stringDatetime, stringPattern, arrayMinLength, booleanFalsy, field-accessor and ultra-fast-validator. They produce false positives and negatives under CI load, are not behavioural specifications, and slow the run down with ten-thousand-iteration loops. Isolate performance into its own suite or a separate benchmark.
- **src/core/plugin/__tests__/test-utils.ts** — the one "test" directory under src, holding a single re-export line and no tests. It also ships a test helper (`src/core/plugin/testUtils.ts`) inside the distributed bundle, against both tree-shaking and published-API hygiene. Test helpers belong under test/.
- **The detailed API of the `async.experimental` layer**: `test/unit/core/async.experimental/{async-context, async-plugin-extensions, async-validator-integration, from-context-plugin}.test.ts` (3,073 lines, 138 passing, 15 failing) — the `AsyncContextBuilder` class, `addAsyncSupport`, `enhanceValidatorWithAsync`, `extendFieldBuilderWithAsync`, `createOptimizedAsyncValidator`, `AsyncValidationHelpers.{createSimpleContext, withTimeout, mergeContexts}` and `AsyncDebugUtils.{measureAsyncContextBuild, compareValidationPerformance}`. The directory name says it: experimental, exported from `src/index.ts` nowhere, so not a published API. Even a debug measurement API is pinned by 138 tests. What is worth carrying forward is the **idea** that asynchronously fetched external data can be injected as validation context, plus the semantics of the published `fromContextPlugin`. The class structure and the helper names go.

## Published symbols (170)

`Builder`, `createPluginRegistry`, `PluginRegistry`, `FieldRule`, `ExtractFieldRuleType`, `FieldRuleDefinition`, `FieldBuilder`, `TransformAwareValidator`, `ApplyFieldTransforms`, `ExtractFieldType`, `TypedPlugin`, `PluginType`, `PluginCategory`, `TypeName`, `BuilderExtensionPlugin`, `BuilderExtensionMethod`, `ValidationResult`, `ValidationOptions`, `MessageContext`, `MessageFactory`, `SEVERITY`, `Severity`, `ValidationError`, `Result`, `ValidResult`, `InvalidResult`, `ValidationState`, `LuqValidationException`, `createLuqValidationException`, `BasicValidationResult`, `StandardPluginImplementation`, `ConditionalPluginImplementation`, `TransformPluginImplementation`, `FieldReferencePluginImplementation`, `ArrayElementPluginImplementation`, `plugin`, `PluginImplementation`, `pluginPredefinedTransform`, `pluginConfigurableTransform`, `pluginBuilderExtension`, `GlobalConfig`, `globalConfig`, `setGlobalConfig`, `getGlobalConfig`, `resetGlobalConfig`, `requiredPlugin`, `optionalPlugin`, `nullablePlugin`, `requiredIfPlugin`, `optionalIfPlugin`, `skipPlugin`, `validateIfPlugin`, `orFailPlugin`, `oneOfPlugin`, `literalPlugin`, `compareFieldPlugin`, `customPlugin`, `stitchPlugin`, `stringMinPlugin`, `stringMaxPlugin`, `stringExactLengthPlugin`, `stringPatternPlugin`, `stringEmailPlugin`, `stringUrlPlugin`, `stringAlphanumericPlugin`, `stringStartsWithPlugin`, `stringEndsWithPlugin`, `stringDatetimePlugin`, `stringDatePlugin`, `stringTimePlugin`, `stringDurationPlugin`, `stringIpv4Plugin`, `stringIpv6Plugin`, `stringHostnamePlugin`, `stringJsonPointerPlugin`, `stringRelativeJsonPointerPlugin`, `stringBase64Plugin`, `stringIriPlugin`, `stringIriReferencePlugin`, `stringUriTemplatePlugin`, `stringContentEncodingPlugin`, `stringContentMediaTypePlugin`, `uuidPlugin`, `numberMinPlugin`, `numberMaxPlugin`, `numberPositivePlugin`, `numberNegativePlugin`, `numberIntegerPlugin`, `numberFinitePlugin`, `numberMultipleOfPlugin`, `numberRangePlugin`, `booleanTruthyPlugin`, `booleanFalsyPlugin`, `arrayMinLengthPlugin`, `arrayMaxLengthPlugin`, `arrayUniquePlugin`, `arrayIncludesPlugin`, `arrayContainsPlugin`, `objectPlugin`, `objectRecursivelyPlugin`, `recursivelyPlugin`, `objectMinPropertiesPlugin`, `objectMaxPropertiesPlugin`, `objectAdditionalPropertiesPlugin`, `objectPropertyNamesPlugin`, `objectPatternPropertiesPlugin`, `objectDependentRequiredPlugin`, `objectDependentSchemasPlugin`, `transformPlugin`, `unionGuardPlugin`, `tupleBuilderPlugin`, `fromContextPlugin`, `readOnlyWriteOnlyPlugin`, `jsonSchemaPlugin`, `jsonSchemaFullFeaturePlugin`, `validateValueAgainstSchema`, `getDetailedValidationErrors`, `getSpecificValidationErrors`, `convertJsonSchemaToLuqDSL`, `convertDSLToFieldDefinition`, `resolveRef`, `resolveSchemaRef`, `resolveAllRefs`, `validateFormat`, `getSupportedFormats`, `isFormatSupported`, `use`, `for`, `v`, `field`, `useField`, `strict`, `build`, `validate`, `parse`, `pick`, `fromJsonSchema`, `isValid`, `isError`, `unwrap`, `unwrapOr`, `unwrapOrElse`, `map`, `flatMap`, `tap`, `tapError`, `data`, `errors`, `valid`, `toPlainObject`, `isObject`, `isPlainObject`, `isString`, `isNumber`, `isBoolean`, `isFunction`, `isArray`, `isNullish`, `isUndefined`, `isNull`, `isError`, `hasProperty`, `isValidDate`, `isFiniteNumber`, `isInteger`, `isOneOfTypes`, `createDefaultValue`, `createReplace`, `createReplaceAll`, `sanitize`
