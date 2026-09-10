# test-intent-integration

Read: 38 files under test/integration, 3 under test/edge-cases, 1 under
test/type-restrictions, 6 under test/plugin-registry and 8 under test/demo —
22,490 lines. **test/type-safety/ is an empty directory**, and not one automated
test in this area records a type-level contract: `@ts-expect-error`,
`expectTypeOf` and `tsd` appear zero times. Negative type tests exist only in
three forms: commented-out code blocks; a type-level assignment
`const x: IsForbiddenTransformOutput<T> = true`; and files under `test/demo/`
that jest never collects — its `testMatch` is `*.test.ts` and the demos are
plain `.ts`, so **they have never run**.

Four families of real semantics could be extracted:

1. the builder's published API and chain semantics (validate against parse,
   abortEarly, the error path format)
2. the null/undefined boundary against required/optional/nullable — where
   **three edge-case files contradict each other**
3. array element validation — where **two groups of tests in one directory
   contradict each other head-on**
4. reading JSON Schema Draft-07 at run time (fromJsonSchema) and its keyword
   coverage

A great deal should be discarded. Of the 16 jsonschema-* files, 13 are
coverage-chasing against internal functions rather than the published API —
`validateValueAgainstSchema`, `resolveRef`, `convertJsonSchemaToLuqDSL`,
`convertDSLToFieldDefinition` — with mocks mixed in. Six array-* files are
either `console.log` plus `expect(true).toBe(true)`, or fantasies expecting
errors from constraints that were never declared. plugin-registry-mock-tests.
test.ts replaces the subject under test with `jest.mock`, so it tests the
behaviour of its own mock and is worth nothing at all.

## Contracts to preserve (26)

### must-preserve (15)

#### Builder().use(plugin).for<T>().v(path, b => chain).build()
- Source: `test/integration/plugin-system-integration.test.ts, test/integration/core-features-coverage.test.ts`
- Shape: Builder(): BuilderChain; .use(plugin): BuilderChain, accumulating plugin types; .for<T>(): TypedBuilder<T>; .v(fieldPath: a keyed path of T, def: (b: FieldContext<T>) => Chain): TypedBuilder<T>; .build(): Validator<T>
- Meaning: nearly all 137 test files take this shape. `.use()` may be called any number of times, and registering the same plugin twice is ignored rather than an error. Registration order does not affect the result — a test requires two validators built in different orders to agree. `Builder()` with no plugins can still reach `.for<T>().build()`, and a validator with no rules always answers valid. `.v()`'s second argument is always a `b => ...` callback, where `b` carries a namespace per type: b.string, b.number, b.boolean, b.array, b.object, b.union.

#### Validator.validate(value, options?) / Validator.parse(value, options?)
- Source: `test/integration/error-handling-comprehensive.test.ts, test/integration/core-features-coverage.test.ts, test/integration/complex-validations.test.ts`
- Shape: validate(value: unknown, options?: { abortEarly?: boolean; abortEarlyOnEachField?: boolean }): ValidationResult<T>; parse(value: unknown, options?: { abortEarly?: boolean }): ValidationResult<TOut>
- Meaning: **validate() runs no transform; only parse() applies them.** This is the single most important division of meaning in the library, and error-handling-comprehensive.test.ts records it explicitly ("validate() doesn't run transforms, so validation passes"). Because validate() judges the original value, a `min()` written on the assumption of a trim is judged against the untrimmed length. parse() returns the converted value through `data()` / `unwrap()`.

#### ValidationResult
- Source: `test/integration/abort-early-real-world.test.ts, test/plugin-registry/individual-field-validation.test.ts, test/demo/onSuccessPostProcess-usage-examples.ts`
- Shape: { valid: boolean; errors: ValidationError[]; isValid(): boolean; isError(): boolean; data(): T | undefined; unwrap(): T; tap(fn): this; tapError(fn): this; map(fn): ValidationResult<U>; onSuccessPostProcess(fn): this }
- Meaning: `.valid` (a property) and `.isValid()` (a method) are **both** used — 374 uses of `.isValid()` against many of `.valid` over 594 validate calls — and mean the same. `.errors` is a property, not a method. `.data()` is a method returning undefined on failure. `.unwrap()` returns the success value. `.tap`, `.tapError`, `.map` and `.onSuccessPostProcess` are chainable combinators.

#### ValidationError
- Source: `test/integration/array-implementation-status.test.ts, test/integration/error-handling-comprehensive.test.ts, test/plugin-registry/plugin-registry-comprehensive.test.ts`
- Shape: { path: string; message: string; code: string }
- Meaning: `path` is a dotted field path — `a.b.c.d.e.f` when nested, `items[0].name` for an array element, `matrix[0][1]` for two dimensions. `code` is the violating plugin's name in camelCase; measured values include `required`, `stringMin`, `arrayMinLength`, plus `FIELD_RULE_ERROR` and `FIELD_RULE_PARSE_ERROR` through FieldRule. `message` is a string, but when a messageFactory returns null the library keeps it as it is — error-handling-comprehensive.test.ts asserts `expect(result.errors[0].message).toBe(null)`.

#### abortEarly / abortEarlyOnEachField
- Source: `test/integration/abort-early-real-world.test.ts, test/integration/array-element-validation-fix.test.ts`
- Shape: validate(data, { abortEarly?: boolean /* default true */, abortEarlyOnEachField?: boolean })
- Meaning: **abortEarly defaults to true** — unspecified, `errors.length` is always 1, which abort-early-real-world.test.ts asserts with `expect(result.errors).toHaveLength(1) // Only first error`. With `abortEarly: false` every field's errors are collected. `abortEarlyOnEachField: true` means one error per field; false permits several, and a test requires `passwordErrors.length > 1` when a password violates min and three patterns. The two axes being orthogonal is the point of the design.

#### Nested field paths
- Source: `test/integration/nested-objects.test.ts, test/integration/error-handling-comprehensive.test.ts, test/edge-cases/null-undefined.test.ts`
- Shape: .v("a.b.c.d.e.f", b => ...)
- Meaning: dotted notation to any depth, with tests at five and six levels. When the parent is missing or null, a required child fails; declaring the parent `object.optional()` lets an undefined child pass. The error path is the declared path as written.

#### Array element field paths
- Source: `test/integration/complex-validations.test.ts, test/integration/array-batching-real-world.test.ts, test/integration/nested-array-object-validation.test.ts`
- Shape: .v("items[*].name", ...) and .v("items.name", ...)
- Meaning: **two notations coexist.** complex-validations.test.ts and nested-objects.test.ts use `items[*].productId`; array-element-validation-*.test.ts, array-batching-real-world.test.ts and nested-array-object-validation.test.ts use `items.name`, without brackets. Both intend "apply to every element". Either way the error path carries the concrete index, `items[0].name`. Multi-level nesting gives `departments[0].teams[0].teamName`, and an object inside an object inside an array gives `data[1].nested.inner`.

#### Conditional predicates: requiredIf / optionalIf / validateIf / skip
- Source: `test/integration/plugin-system-integration.test.ts, test/integration/complex-validations.test.ts, test/integration/core-features-coverage.test.ts, test/integration/edge-cases-coverage.test.ts`
- Shape: b.<type>.requiredIf((rootData: T) => boolean); b.<type>.optionalIf((rootData: T) => boolean); b.<type>.validateIf((rootData: T) => boolean); b.<type>.skip((rootData: T) => boolean)
- Meaning: the predicate receives **the whole root object**, and even inside a nested field's definition it walks from the root, as in `data.auth?.type === 'bearer'`. requiredIf: required when true, optional when false. validateIf: the later constraints are evaluated only when true. skip: when true the rest of the chain, required included, is skipped entirely and the field counts as valid. skip may appear several times in one chain, acting as an OR. A skip predicate is always evaluated at least once per validate. Touching a property that does not exist inside a predicate must not throw.

#### fromJsonSchema
- Source: `test/integration/jsonschema-full-feature.test.ts, test/integration/jsonschema-format.test.ts, test/integration/jsonschema-ultimate-final.test.ts`
- Shape: Builder().use(jsonSchemaFullFeaturePlugin).fromJsonSchema(schema: JSONSchema7, options?: { strictRequired?: boolean; allowAdditionalProperties?: boolean; customFormats?: Record<string, (value: string) => boolean> }).build()
- Meaning: reads a Draft-07 schema at run time and produces a validator. It is called directly, without going through `.for<T>()` — a second entry point on Builder. What it returns can then be `.build()`. One `use` of jsonSchemaFullFeaturePlugin is enough for the whole feature set, it being a composite plugin. `customFormats` registers user-defined format names.

#### The JSON Schema keywords the tests actually use
- Source: `test/integration/jsonschema-full-coverage.test.ts, test/integration/jsonschema-100-percent.test.ts, test/integration/jsonschema-full-feature.test.ts, test/integration/jsonschema-final-assault.test.ts`
- Shape: type, properties, required, additionalProperties, patternProperties, propertyNames, minProperties, maxProperties, dependentRequired, dependentSchemas, dependencies, items, additionalItems, contains, minItems, maxItems, uniqueItems, minLength, maxLength, pattern, format, contentEncoding, contentMediaType, minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, enum, const, allOf, anyOf, oneOf, not, if, then, else, $ref, $defs, definitions, readOnly, writeOnly, nullable, $schema
- Meaning: every keyword appearing in a schema across the jsonschema-* tests, counted, with none omitted. `type` supports both a single value and an array (`type: ["string","number"]`). `$ref` resolves both `#/definitions/x` and `#/$defs/x`. `items` takes both a single schema, for every element, and an array, for a tuple. Primitive type decisions: `type: 'number'` rejects NaN; `type: 'integer'` rejects 3.14; `type: 'null'` rejects undefined and 0; `type: 'array'` rejects `{}`; `type: 'object'` rejects `[]` and null.

#### The JSON Schema format values the tests actually use
- Source: `test/integration/jsonschema-100-percent.test.ts, test/integration/jsonschema-format.test.ts, test/integration/jsonschema-full-feature.test.ts`
- Shape: standard — email, uuid, uri, uri-reference, uri-template, url, date, date-time, time, duration, ipv4, ipv6, hostname, json-pointer, relative-json-pointer, iri, iri-reference, regex. Non-standard, treated as custom — ssn, phone, credit-card, postal-code, product-code, custom-id, custom-format, custom, unknown-format, undefined-format.
- Meaning: every format value appearing across the jsonschema-* files. Each standard format has one corresponding plugin (stringEmailPlugin, uuidPlugin, stringUrlPlugin, stringIpv4Plugin, stringIpv6Plugin, stringHostnamePlugin, stringTimePlugin, stringDurationPlugin, stringJsonPointerPlugin, stringRelativeJsonPointerPlugin, stringIriPlugin, stringIriReferencePlugin, stringUriTemplatePlugin, stringBase64Plugin, stringContentEncodingPlugin). An unknown format name passes through rather than erroring unless registered through customFormats; tests exist for `unknown-format` and `undefined-format`. Accepted examples: email `test@example.com`, uuid `550e8400-e29b-41d4-a716-446655440000`, ipv6 `2001:db8::8a2e:370:7334`, duration `P1Y2M3DT4H5M6S`, json-pointer `/foo/bar/0`, relative-json-pointer `1/foo/bar`, an IRI with non-ASCII host and path, uri-template `/users/{id}/posts/{postId}`, time `12:34:56`. Rejected examples: email `not-an-email`, date `2024-13-01`, ipv4 `999.999.999.999`, date-time `not-a-datetime`. date-time must accept both the `Z` suffix and a `+09:00` offset.

#### The basic meaning of required / optional / nullable
- Source: `test/edge-cases/null-undefined.test.ts, test/edge-cases/null-undefined-fixed.test.ts, test/integration/array-implementation-status.test.ts`
- Shape: b.<type>.required() / .optional() / .nullable()
- Meaning: required rejects undefined, null, a missing property and the empty string alike; null-undefined-fixed.test.ts states the empty string case explicitly. optional permits undefined and absence and skips the rest of the chain, running it when a value is present. nullable permits null and skips the rest of the chain, running it when a value is present. `b.array.required()` accepts an empty array, it being present. `b.object.required()` rejects null and undefined.

#### Boundaries for numbers, strings and arrays
- Source: `test/integration/edge-cases-coverage.test.ts`
- Shape: whether min / max / minLength / maxLength include their boundary
- Meaning: all of them are **closed intervals**. `string.min(5).max(10)`: 5 and 10 characters are valid, 4 and 11 are not. `number.min(0).max(100)`: 0 and 100 are valid, -0.1 and 100.1 are not. `number.min(0)` counts -0 as valid and Infinity as valid, and -Infinity as invalid. NaN is unspecified; the tests require only that nothing crashes. `string.min(1)` rejects `''` and accepts `' '`, `'\n'` and `'\t'`, nothing being trimmed. String length is JavaScript's `.length`, in UTF-16 code units. `array.minLength(0)` accepts `[]`.

#### Robustness: it must not crash
- Source: `test/integration/edge-cases-coverage.test.ts, test/integration/error-handling-comprehensive.test.ts`
- Shape: —
- Meaning: none of these inputs may throw: a circular object (`obj.self = obj`); a recursive structure a thousand levels deep, without a stack overflow; an object with no prototype from `Object.create(null)`; an array with a replaced `__proto__`; a sparse array `['a', , 'c', , 'e']`, treated as length 5; an object with a thousand properties; an array of ten thousand elements; a string of 100KB; contradictory settings such as `min(-1).max(-5)`; and a contradictory chain such as `required().optional()`. All that is guaranteed is that a boolean comes back.

#### Transform chains
- Source: `test/integration/edge-cases-coverage.test.ts, test/integration/complex-validations.test.ts, test/edge-cases/null-undefined.test.ts`
- Shape: b.<type>.<constraints>().transform(fn).transform(fn)...
- Meaning: several transforms may be chained and are applied in declaration order (trim → toLowerCase → replace). Constraints and transforms may be mixed in any order, as in `min(5).transform(trim).max(10)`. `parse()` returns the converted value. A transform may be called with null or undefined, so the recorded examples defend against that on the caller's side.

### should-preserve (9)

#### compareField
- Source: `test/integration/plugin-system-integration.test.ts, test/integration/complex-validations.test.ts`
- Shape: b.string.required().compareField(otherPath: string)
- Meaning: checks equality with another field of the same object. It accepts not only a top-level name such as `password` but **a dotted nested path such as `account.password`**.

#### union with guard
- Source: `test/integration/complex-validations.test.ts`
- Shape: b.union.required().guard((v): v is X => ..., (b) => b.object.required()).guard(...)
- Meaning: each branch of a discriminated union is declared as a type guard paired with a sub-builder, and guards chain. Validating the fields of a particular branch is written separately, as `.v("paymentMethod.cardNumber", b => b.string.validateIf(d => d.paymentMethod.type === 'credit').pattern(...))`.

#### object.recursively
- Source: `test/integration/nested-objects.test.ts`
- Shape: b.object.recursively({ maxDepth: number, validate: (ctx: { current: unknown; path: string }) => { valid: boolean; errors?: Array<{path,message,code}> } })
- Meaning: walks a recursive tree — nodes carrying children — to a depth limit, calling a user function at each node. `ctx.path` is the path to that node and `ctx.current` is the node itself. The paths on returned errors are assembled by the user, as `ctx.path + '.id'`.

#### The messageFactory option
- Source: `test/integration/error-handling-comprehensive.test.ts, test/integration/edge-cases-coverage.test.ts, test/edge-cases/null-undefined.test.ts`
- Shape: b.string.required({ messageFactory: (ctx: { value: unknown, ... }) => string })
- Meaning: passing `messageFactory` in the validator call's first argument replaces the error message. `ctx.value` gives the actual value, so null and undefined can be told apart. **A messageFactory that throws does not crash the validation; an error comes back with a fallback message.** Multi-byte characters, emoji and very long strings are kept as they are.

#### custom validators
- Source: `test/plugin-registry/individual-field-validation.test.ts, test/plugin-registry/field-rule-practical-examples.test.ts`
- Shape: b.<type>.custom(fn, options?) — fn: (value) => boolean | { valid: boolean; message?: string }; options: { message: string }
- Meaning: **both return forms are supported.** individual-field-validation.test.ts uses `(value) => boolean` with a `{ message }` option; field-rule-practical-examples.test.ts uses `(value) => ({ valid: false, message: '...' })`. One of the two should be chosen.

#### createPluginRegistry / FieldRule / useField
- Source: `test/plugin-registry/individual-field-validation.test.ts, test/plugin-registry/simplified-test.test.ts, test/plugin-registry/plugin-registry-comprehensive.test.ts`
- Shape: createPluginRegistry(): Registry with `.use(plugin)`, `.getPlugins()`, `.toBuilder()` and `.createFieldRule<T>(def, options?)`; FieldRule<T>: { name?; description?; validate(value, options?); parse(value, options?); getPluginRegistry() }
- Meaning: a way to make a reusable rule that validates one field against a type T independently. Several FieldRules can be made from one registry and work independently of each other. `.getPlugins()` returns the registered plugins as a record keyed by name — `required`, `stringMin`, `stringEmail`, `transform` and so on, the plugin symbol without its `Plugin` suffix. `.toBuilder()` converts to an ordinary Builder, and `.for<T>().useField(fieldName, fieldRule)` folds a FieldRule in as a field definition, mixable with ordinary `.v()` calls. When the rule definition throws, validate returns an error with code `FIELD_RULE_ERROR` and parse one with `FIELD_RULE_PARSE_ERROR` rather than rethrowing. When something that is not an Error is thrown, the message becomes `Validation failed` or `Parse failed`.

#### contentEncoding / contentMediaType actually check the content
- Source: `test/integration/jsonschema-content-validation.test.ts`
- Shape: { type: 'string', contentEncoding: 'base64', contentMediaType: 'application/json' }
- Meaning: these are **not annotations; the content is checked**. `contentEncoding: 'base64'` checks that the string really is base64 — `'Not valid base64!@#'` fails. `contentMediaType: 'application/json'` checks that it parses as JSON, decoding first when a contentEncoding is present. `'text/html'` checks that it looks like HTML and `'text/xml'` that it looks like XML: `'not xml'` fails, and so does `'Not HTML content'`. `'text/css'`, `'text/javascript'` and `'text/plain'` are covered too. It applies to a nested object's properties in the same way.

#### array.unique's notion of equality
- Source: `test/integration/edge-cases-coverage.test.ts, test/plugin-registry/individual-field-validation.test.ts`
- Shape: b.array.required().unique()
- Meaning: `[null, undefined, 1]` is unique and valid. `[null, null]` is a duplicate and invalid. `[1,2,2,3]` is invalid. It reads as strict equality over primitives.

#### The shape of parse()'s output object
- Source: `test/edge-cases/null-undefined.test.ts, test/integration/complex-validations.test.ts`
- Shape: parse(input).data(): TOut
- Meaning: **only the declared fields that were present in the input appear in the output.** Given `{}`, a field declared `optional().transform(v => v ?? 'Anonymous')` still yields `{}` — a transform runs only on a value that is there. Given a present null, the transform runs and yields `{ name: 'Anonymous', count: 0 }`. Undeclared fields are preserved; a `metadata` field in complex-validations passes straight through to the output.

### optional (2)

#### The type-level restriction on transform's return type
- Source: `test/type-restrictions/transform-array-object-restriction.test.ts, test/demo/editor-error-demonstration.ts, test/demo/final-union-restriction-verification.ts, test/demo/implementation-status-report.md`
- Shape: IsForbiddenTransformOutput<T>, CheckTransformFunction<F>, ForbiddenTransformError<T>
- Meaning: a transform returning `Array<plain object>` or `Array<union containing a plain object>` is **a compile error**. Permitted: `Array<primitive>` (string[], number[], boolean[]); `Array<primitive union>` ((string|number)[], (string|number|boolean)[]); `Array<Date>` and `Array<RegExp>`, special objects being excluded; and anything that is not an array (string, number, object). The error type is an object type with `_error`, `_reason`, `_received`, `_suggestion` and `_example`, offering the developer an alternative. **The stated reason for the restriction is "how nested array validation happens to be implemented" — an implementation constraint, not a design principle.**

#### onSuccessPostProcess
- Source: `test/demo/onSuccessPostProcess-usage-examples.ts`
- Shape: result.onSuccessPostProcess((data: T) => void | Promise<void>): this
- Meaning: a side-effect hook running only on success, usable on the result of either validate() or parse(). The demo itself states it is "the same as tap() with a clearer name". An async function may be passed and is not awaited.

## Behavioural rules

- validate() applies no transform at all and evaluates constraints against the original input. Only parse() applies transforms and returns the converted value through data() / unwrap(). This separation must be kept.
- abortEarly defaults to true. A validate() with no options always returns exactly one error.
- `abortEarly: false` with `abortEarlyOnEachField: true` means one error per field; `abortEarly: false` with `abortEarlyOnEachField: false` enumerates every violation. The two axes are orthogonal.
- An error path is the declared path with the concrete array index filled in: `items[0].name`, `departments[0].teams[0].teamName`, `data[1].nested.inner`, `matrix[0][1]`.
- required() rejects undefined, null, a missing property and the empty string.
- optional() permits only undefined and absence, and skips the rest. It does not permit null.
- nullable() permits only null and skips the rest. undefined passes through unchecked.
- `array.required()` counts an empty array as valid; length is minLength's and maxLength's business.
- min / max / minLength / maxLength are all closed intervals.
- `number.min(0)` counts 0, -0 and Infinity as valid, and -Infinity as invalid.
- String length is JavaScript's `.length`, in UTF-16 code units, with no trimming. `' '` and `'\n'` have length 1 and are valid.
- The predicates of requiredIf / optionalIf / validateIf / skip receive the whole root object, and walk from the root even inside a nested field's definition.
- skip may appear several times in one chain, and any of them being true skips that field's validation entirely and counts it valid. A skip predicate is always evaluated.
- compareField accepts a dotted nested path.
- Using the same plugin twice is ignored rather than an error, and registration order does not affect the result.
- A Builder with no plugins, and a validator with no rules, always answer valid.
- A messageFactory that throws does not crash the validation; an error comes back with a fallback message.
- A messageFactory returning null has that null stored on `error.message` unaltered.
- A FieldRule definition that throws does not rethrow; it returns an error with code `FIELD_RULE_ERROR` from validate and `FIELD_RULE_PARSE_ERROR` from parse. When something that is not an Error is thrown, the message is `Validation failed` or `Parse failed`.
- None of these may throw: a circular reference, a thousand levels of nesting, an object with no prototype, a sparse array, an array with a replaced `__proto__`, ten thousand elements, a 100KB string, or contradictory settings such as `min(-1).max(-5)` and `required().optional()`.
- JSON Schema's `type` accepts both a single value and an array.
- JSON Schema's `$ref` resolves both `#/definitions/x` and `#/$defs/x`.
- JSON Schema's contentEncoding and contentMediaType check the content rather than annotating it: whether it decodes as base64, and whether it is valid as JSON, HTML or XML.
- An unknown JSON Schema format passes through rather than erroring unless registered through customFormats.
- JSON Schema's date-time accepts both the `Z` suffix and a `+09:00` offset.
- parse()'s output contains only the fields present in the input, and a transform does not run for a missing field.
- All of this without `eval` or `new Function`; being CSP-safe is an absolute requirement.

## Not carried forward

- **test/type-safety/, an empty directory** — there is not one type-safety test. The premise that type-level contracts are recorded anywhere does not hold. Real negative type tests have to be written from nothing.
- **The eight files under test/demo/** (editor-error-demonstration.ts, specific-error-cases.ts, improved-error-messages.ts, final-error-message-test.ts, final-union-restriction-verification.ts, simple-union-error-test.ts, onSuccessPostProcess-usage-examples.ts, implementation-status-report.md) — jest's `testMatch` is `*.test.ts` and these are `.ts` and `.md`, so **they have never run once**. Their contents are `console.log` calls and comments saying an error should appear when opened in an editor. As a means of verifying a type restriction they do nothing. The one piece of recorded meaning, transform's `Array<object>` restriction, has been extracted; the files go.
- **test/plugin-registry/plugin-registry-mock-tests.test.ts, 277 lines** — `jest.mock('src/core/builder/context/field-context')` **replaces the subject under test with a mock**, so passing `'execution-test'` and getting `'EXECUTION-TEST'` back verifies behaviour the test itself wrote. Its own opening comment admits the purpose: "to reach 90% coverage". Worth nothing.
- **Thirteen jsonschema-* files** (-final-100-percent, -final-assault, -turbo-100-percent, -surgical-100-percent, -ultimate-final, -ultra-final-266, -final-290-lines, -final-140-lines, -final-push, -simple-final, -precision-coverage, -targeted-coverage, -uncovered; about 7,700 lines) — all of them chasing a coverage number. The filenames and the opening comments admit it. They test internal functions that `src/index.ts` does not export, asserting `toHaveBeenCalledWith` against a mock builder — implementation-coupled tests that die wholesale when the internals change, and that record no contract worth keeping.
- **The function-level API in jsonschema-full-coverage.test.ts and jsonschema-comprehensive-coverage.test.ts** (`validateValueAgainstSchema(value, schema, formats?, rootSchema?)`, `resolveRef`, `getDetailedValidationErrors`) — none of these is exported from `src/index.ts` and none is a published contract. **The JSON Schema semantics written down there are valuable**, though, and should be rewritten as a conformance suite through the published `fromJsonSchema`. The function signatures themselves are not carried forward.
- **array-implementation-status.test.ts, array-implementation-summary.test.ts, array-optimization-demonstration.test.ts and array-type-analysis-demonstration.test.ts, about 1,200 lines** — essentially all `console.log` "implementation status reports", with assertions that are either `expect(true).toBe(true)` or checks on internal type utilities (BuildTimeArrayAnalyzer, `ArrayDepth<T>`, an index pattern `[i][j]`, loop variables `['i','j']`). Those are implementation details of an internal array optimisation and not a published contract. Worse, array-implementation-status.test.ts **pins the fact that array element validation does not work**, with `expect(result.isValid()).toBe(true)` — freezing broken behaviour in a test.
- **multidimensional-array-validation.test.ts, 437 lines** — unrealisable fantasy. It declares only `.v('imageData', b => b.array.required().minLength(1))` and then expects the error paths to contain `imageData[0][2]` for a value of 300 exceeding 255 — a constraint declared nowhere. The same holds for `data[0][0][0].value` on a 3-D tensor. The tests record a wish, not an implementation. **The design intent behind the multi-dimensional error path notation (`a[0][1]`, `a[0][1][2].field`) is worth carrying forward as an open question.**
- **performance-optimization-verification.test.ts, 713 lines, and the `performance.now()` threshold assertions scattered elsewhere** — machine- and load-dependent numbers such as "simple validation ≥100k ops/sec", "complex ≥10k ops/sec", "within 50ms" and "within 10ms" embedded in unit tests, which are unstable in CI. Performance belongs in a separate benchmark suite with its own harness, statistics and regression rule, never in a jest assertion. The `memoryUsageMB` measurement depending on `global.gc` means nothing without `--expose-gc` either.
- **v8-optimization-integration.test.ts.disabled** — disabled by its extension, and containing a typo in the `result` variable name in nine places. Already dead.
- **The test files that do not compile** — error-handling-comprehensive.test.ts (normalresult, parseresult, errorresult, failresult), nested-objects.test.ts (invalidresult), array-validation-simple.test.ts (validresult), array-batching-real-world.test.ts (invalidresult) and multidimensional-array-validation.test.ts (validresult, invalidresult) all reference undefined lower-case variables, so those suites are effectively failing. Their meaning has been extracted here and the files can go.
- **Offering both a `.valid` property and an `.isValid()` method** — two entrances to the same information, mixed without order across every test (374 uses of `.isValid()` plus many of `.valid` over 594 validate calls), leaving a reader unable to tell which is canonical. One of them. A discriminated union (`{ valid: true; data: T } | { valid: false; errors: E[] }`) argues for the property; a Result-monad shape argues for the method.
- **parse() throwing a transform's exception** — error-handling-comprehensive.test.ts records `expect(() => validator.parse({ text: 'FAIL' })).toThrow('Middle transform failed')`. In a design where validate and parse return a Result, letting only a transform's exception escape is inconsistent — and FieldRule already catches and returns `FIELD_RULE_PARSE_ERROR`, so it contradicts itself. It should be caught as a Result error.
- **onSuccessPostProcess** — the demo itself states it is "the same as tap() with a clearer name". A pure alias enlarging the API surface for nothing. Fold into tap().
- **The 'should apply default value' test in plugin-registry/individual-field-validation.test.ts** — it never calls `.default()` and expects `parse(undefined)` to return `'active'`. The test itself is broken.
- **Two coexisting array element notations, `items[*].field` and `items.field`** — one meaning with two syntaxes is ambiguity itself. Choose one; the explicit `items[*].field` is the recommendation, since `items.field` cannot be told apart from "the field of an object called items".

## Published symbols (139)

`Builder`, `createPluginRegistry`, `FieldRule`, `use`, `for`, `v`, `build`, `validate`, `parse`, `fromJsonSchema`, `toBuilder`, `createFieldRule`, `getPlugins`, `getPluginRegistry`, `useField`, `valid`, `errors`, `isValid`, `isError`, `data`, `unwrap`, `tap`, `tapError`, `map`, `onSuccessPostProcess`, `abortEarly`, `abortEarlyOnEachField`, `strictRequired`, `allowAdditionalProperties`, `customFormats`, `messageFactory`, `maxDepth`, `required`, `optional`, `nullable`, `min`, `max`, `minLength`, `maxLength`, `exactLength`, `pattern`, `email`, `url`, `alphanumeric`, `startsWith`, `endsWith`, `integer`, `finite`, `positive`, `negative`, `multipleOf`, `range`, `truthy`, `falsy`, `unique`, `includes`, `contains`, `oneOf`, `literal`, `custom`, `transform`, `skip`, `requiredIf`, `optionalIf`, `validateIf`, `compareField`, `recursively`, `guard`, `object`, `default`, `string`, `number`, `boolean`, `array`, `union`, `tuple`, `requiredPlugin`, `optionalPlugin`, `nullablePlugin`, `skipPlugin`, `transformPlugin`, `customPlugin`, `literalPlugin`, `oneOfPlugin`, `compareFieldPlugin`, `requiredIfPlugin`, `optionalIfPlugin`, `validateIfPlugin`, `objectPlugin`, `objectRecursivelyPlugin`, `objectMinPropertiesPlugin`, `objectMaxPropertiesPlugin`, `objectAdditionalPropertiesPlugin`, `objectPatternPropertiesPlugin`, `objectPropertyNamesPlugin`, `objectDependentRequiredPlugin`, `objectDependentSchemasPlugin`, `unionGuardPlugin`, `tupleBuilderPlugin`, `readOnlyWriteOnlyPlugin`, `stringMinPlugin`, `stringMaxPlugin`, `stringExactLengthPlugin`, `stringPatternPlugin`, `stringEmailPlugin`, `stringUrlPlugin`, `stringAlphanumericPlugin`, `stringStartsWithPlugin`, `stringEndsWithPlugin`, `stringIpv4Plugin`, `stringIpv6Plugin`, `stringHostnamePlugin`, `stringTimePlugin`, `stringDurationPlugin`, `stringJsonPointerPlugin`, `stringRelativeJsonPointerPlugin`, `stringIriPlugin`, `stringIriReferencePlugin`, `stringUriTemplatePlugin`, `stringBase64Plugin`, `stringContentEncodingPlugin`, `uuidPlugin`, `numberMinPlugin`, `numberMaxPlugin`, `numberRangePlugin`, `numberIntegerPlugin`, `numberFinitePlugin`, `numberPositivePlugin`, `numberNegativePlugin`, `numberMultipleOfPlugin`, `booleanTruthyPlugin`, `booleanFalsyPlugin`, `arrayMinLengthPlugin`, `arrayMaxLengthPlugin`, `arrayUniquePlugin`, `arrayIncludesPlugin`, `arrayContainsPlugin`, `jsonSchemaPlugin`, `jsonSchemaFullFeaturePlugin`
