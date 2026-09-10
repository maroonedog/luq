# documented-promises

Files read: the previous README (214 lines, in full); every `.astro`, `.ts` and
`.json` under the documentation site's `src/` (13 pages, 16 components, 3 data
files); `docs/generated/plugins.md` (2269 lines); and, to check them against
reality, package.json's exports map plus the `methodName` declarations in
`src/index.ts`, `src/types/result.ts`,
`src/core/registry/plugin-registry.ts` and `src/core/plugin/*.ts`.

## What the documentation promises

1. **The builder chain**:
   `Builder().use(plugin...).for<T>().v(path, b => chain, options?).useField(path, rule).strict().build()`.
   `Builder()` is a function, needing no `new`. `use()` also takes variadic
   arguments. `use()` comes before `for()`. A duplicate `use` is ignored. Order
   does not matter, for most plugins.
2. **The Validator that `build()` returns**: `validate(value, options?)`,
   `parse(value, options?)`, `pick(fieldName)`. validate applies no transform
   and returns the original value; parse returns the transformed one. This is
   the most important distinction in the library and every page repeats it.
3. **Result<T>**: isValid(), isError(), unwrap(), unwrapOr(d), unwrapOrElse(fn),
   map(fn), flatMap(fn), tap(fn), tapError(fn), data(), errors,
   toPlainObject(), `valid` (a backward-compatibility property) and `value`.
   unwrap() throws `LuqValidationException` on failure, identifiable by
   `e.name` and carrying `e.errors`. toPlainObject() gives
   `{ valid, data?, errors }`.
4. **ValidationError**: `{ path: string; message: string; code: string }` —
   only core-concepts also lists `value`. The path is dotted, `'user.email'`.
5. **The field path grammar**: `fieldName`, `nested.field.path`, `array[*]`,
   `nested.array[*].field`, `data[*][*]` for several dimensions. That a
   specific index such as `items[0].name` is NOT supported, only `[*]`, is an
   explicit promise in troubleshooting.
6. **ValidationOptions**: `{ abortEarly?: boolean (default false); context?: unknown }`.
7. **FieldOptions**, `v()`'s third argument:
   `{ default?: T | (() => T); applyDefaultToNull?: boolean (default true); description?: string; deprecated?: boolean | string; metadata?: Record<string, unknown> }`,
   with a shorthand where a bare value in the third position becomes the
   default — `.v('language', b => b.string.optional(), 'en')`.
8. **strict()**: a compile-time exhaustiveness check over fields with no
   run-time effect. With a field left undeclared it returns a type carrying no
   `build()`. It may be called anywhere in the chain and the chain continues
   after it. `strictOnEditor()` is an alias. That **strict() does not reject a
   surplus property at run time — `objectAdditionalProperties(false)` does** is
   an explicit promise.
9. **The plugin registry**:
   `createPluginRegistry().use(plugin).for<T>().createFieldRule(builderFn, { name, description?, fieldOptions? })`,
   plus `toBuilder()` and `getPlugins()`. A FieldRule has
   `validate(value, options?)`, `parse(value, options?)` and
   `getPluginRegistry()`, and is folded in with `builder.useField(path, rule)`.
   The documentation itself demotes it: "with a Builder, use pick(); the
   registry is unnecessary".
10. **Custom plugins**: `plugin({ name, methodName, allowedTypes, category, impl })`
    plus `pluginPredefinedTransform` and `pluginConfigurableTransform`, on the
    design principle that the category controls the chain builder's type
    variables (standard, fieldReference, transform, conditional,
    multiFieldReference, context).
11. **JSON Schema Draft-07**: `use` either `jsonSchemaFullFeaturePlugin` or
    `jsonSchemaPlugin` plus individual plugins, then
    `.fromJsonSchema(schema).build()`. A schema fetched at run time from an API
    or a CMS can be read — dynamic validation.
12. **Performance and size claims** (README and the benchmarks page, measured
    2025-08-14 on an AMD Ryzen 7 5825U with Node v22.12.0 over a million
    iterations): bundles of 19.10KB (simple) to 22.48KB (complex) gzipped,
    26.06/29.08KB with JSON Schema, 31.75/32.31KB with JSON Schema Full. Speeds
    of 694,692 ops/sec simple — where **the README says 1.2M** — and 35,946
    ops/sec complex — where **the README says 43K**. Being CSP-safe, using
    neither eval nor new Function, is promised unconditionally on every page.
    Tree-shaking is per plugin.
13. **Environment**: Node.js 14+, TypeScript 4.1+, target ES2015 or later,
    strict and strictNullChecks recommended. MIT licence.

## What the documentation promises and does not exist

- `result.getErrors()`, `result.getErrorMessages()` and `result.getFieldErrors()`
  appear nowhere in src — zero grep hits. The examples in getting-started,
  core-concepts and troubleshooting are all broken by it.
- `validator.validateWithContext(data, context)` does not exist; it appears in
  the context-category example on the custom-plugins page.
- `registry.register(plugin)` does not exist; the real method is `use(plugin)`.
- `equalsPlugin` and `.equals(true)` are in neither the catalog nor src, yet
  appear in the "accept the terms" examples on two pages.
- `conditionalPlugin` does not exist; it appears in the plugin-registry's
  complete example.
- The README's Quick Start calls `validateUser(data)` and reads
  `result.issues`, while the reality is `validator.validate(data)` and
  `result.errors`. **The first thirty lines of the README do not run.**
- The subpaths `./core`, `./core/registry`, `./plugin`, `./plugins`,
  `./async.experimental` and `./core/builder/plugins/plugin-creator` are in
  package.json's exports map nowhere, so most import lines in the
  documentation do not resolve. `./plugins/numberRange` is missing too.
- Only core-concepts uses the `items.*.id` dot-star notation; every other page
  uses `items[*].id`.
- The key for a custom error message is doubled: `messageFactory` in the README
  and the plugins data (59 places) against `issueFactory` in the generated
  plugin documentation (72 places). And there are examples passing a bare
  string as a second argument, `.pattern(/re/, 'message')` and
  `.compareField('password', 'message')`. Three ways.
- The generated plugin documentation's table of contents lists `stringEquals`,
  `selfRecursively` and `recursivelyWithContext`, which are in neither the site
  catalog nor `src/core/plugin/`.
- The site's plugin data records export names as method names — stringEmail,
  stringUrl, stringDatetime, stringBase64, stringHostname, stringIpv4,
  stringIpv6, stringIri, stringJsonPointer, stringContentMediaType — because
  the documentation generator is broken. The real methods are `.email()`,
  `.url()`, `.datetime()`, `.base64()`, `.hostname()`, `.ipv4()`, `.ipv6()`,
  `.iri()`, `.jsonPointer()` and `.contentMediaType()`, which is what every
  hand-written page uses, and what is correct. `readOnlyWriteOnlyPlugin`'s real
  method is `.readOnly()`.
- The documentation sidebar links to `/generator`, a page that does not exist;
  the real catalog is `/plugins`.

## The 69 published plugins, as the site catalog lists them

Export name :: real method :: applicable types

arrayContainsPlugin :: .contains() :: array
arrayIncludesPlugin :: .includes() :: array
arrayMaxLengthPlugin :: .maxLength() :: array
arrayMinLengthPlugin :: .minLength() :: array
arrayUniquePlugin :: .unique() :: array
booleanFalsyPlugin :: .falsy() :: boolean
booleanTruthyPlugin :: .truthy() :: boolean
compareFieldPlugin :: .compareField() :: string, number, boolean, date, object, array, null, undefined
conditionalSchemaPlugin :: .conditionalSchema() :: object
customPlugin :: .custom() :: string, number, boolean, date, array, object, tuple, union
fromContextPlugin :: .fromContext() :: string, number, boolean, object, array, date, union, tuple
jsonSchemaFullFeaturePlugin :: .fromJsonSchema(), a builder extension :: every type
literalPlugin :: .literal() :: string, number, boolean, null
nullablePlugin :: .nullable() :: string, number, boolean, array, object, date, union
numberFinitePlugin :: .finite() :: number
numberIntegerPlugin :: .integer() :: number
numberMaxPlugin :: .max() :: number
numberMinPlugin :: .min() :: number
numberMultipleOfPlugin :: .multipleOf() :: number
numberNegativePlugin :: .negative() :: number
numberPositivePlugin :: .positive() :: number
numberRangePlugin :: .range() :: number
objectPlugin :: .object() :: object
objectAdditionalPropertiesPlugin :: .additionalProperties() :: object
objectDependentRequiredPlugin :: .dependentRequired() :: object
objectDependentSchemasPlugin :: .dependentSchemas() :: object
objectMaxPropertiesPlugin :: .maxProperties() :: object
objectMinPropertiesPlugin :: .minProperties() :: object
objectPatternPropertiesPlugin :: .patternProperties() :: object
objectPropertyNamesPlugin :: .propertyNames() :: object
objectRecursivelyPlugin :: .recursively() :: object
oneOfPlugin :: .oneOf() :: string, number, boolean
optionalPlugin :: .optional() :: string, number, boolean, array, object, date, union
optionalIfPlugin :: .optionalIf() :: string, number, boolean, array, object, date, union
orFailPlugin :: .orFail() :: string, number, boolean, array, object, date, union, tuple
readOnlyWriteOnlyPlugin :: .readOnly() :: string, number, boolean, date, array, object
requiredPlugin :: .required() :: string, number, boolean, date, array, object, tuple, union
requiredIfPlugin :: .requiredIf() :: string, number, boolean, array, object, date, union
skipPlugin :: .skip() :: string, number, boolean, array, object, date, union
stitchPlugin :: .stitch() :: string, number, boolean, date, object, array, tuple, union
stringAlphanumericPlugin :: .alphanumeric() :: string
stringBase64Plugin :: .base64() :: string
stringContentEncodingPlugin :: .contentEncoding() :: string
stringContentMediaTypePlugin :: .contentMediaType() :: string
stringDatePlugin :: .date() :: string
stringDatetimePlugin :: .datetime() :: string
stringDurationPlugin :: .duration() :: string
stringEmailPlugin :: .email() :: string
stringEndsWithPlugin :: .endsWith() :: string
stringExactLengthPlugin :: .exactLength() :: string
stringHostnamePlugin :: .hostname() :: string
stringIpv4Plugin :: .ipv4() :: string
stringIpv6Plugin :: .ipv6() :: string
stringIriPlugin :: .iri() :: string
stringIriReferencePlugin :: .iriReference() :: string
stringJsonPointerPlugin :: .jsonPointer() :: string
stringMaxPlugin :: .max() :: string
stringMinPlugin :: .min() :: string
stringPatternPlugin :: .pattern() :: string
stringRelativeJsonPointerPlugin :: .relativeJsonPointer() :: string
stringStartsWithPlugin :: .startsWith() :: string
stringTimePlugin :: .time() :: string
stringUriTemplatePlugin :: .uriTemplate() :: string
stringUrlPlugin :: .url() :: string
transformPlugin :: .transform() :: string, number, boolean, array, object, date, union
tupleBuilderPlugin :: .tupleBuilder() :: tuple
unionGuardPlugin :: .unionGuard() :: union
uuidPlugin :: .uuid() :: string
validateIfPlugin :: .validateIf() :: string, number, boolean, array, object, date, union

A seventieth, `jsonSchemaPlugin :: .fromJsonSchema()`, is promised only by the
json-schema page. The README says "40+ built-in plugins"; the real count is 69
to 70.

## The JSON Schema keywords the site's mapping table lists

Twelve categories, 52 rows.

- **Core types**: `type: "string"`, `"number"`, `"boolean"`, `"array"` and
  `"object"` are built in; `"integer"` is numberIntegerPlugin; `"null"` is
  nullablePlugin.
- **String constraints**: minLength (stringMinPlugin), maxLength
  (stringMaxPlugin), pattern (stringPatternPlugin).
- **String formats**: email (stringEmailPlugin); url and uri (stringUrlPlugin);
  uuid (uuidPlugin); ipv4, ipv6 and hostname; date-time (stringDatetimePlugin,
  with time zones); date (YYYY-MM-DD); time (HH:MM:SS); duration (ISO 8601);
  json-pointer (RFC 6901); relative-json-pointer; iri (RFC 3987);
  iri-reference; uri-template (RFC 6570).
- **Number constraints**: minimum and exclusiveMinimum (numberMinPlugin),
  maximum and exclusiveMaximum (numberMaxPlugin), multipleOf.
- **Array constraints**: minItems (arrayMinLengthPlugin), maxItems
  (arrayMaxLengthPlugin), uniqueItems (arrayUniquePlugin), contains
  (arrayContainsPlugin), items as a tuple (tupleBuilderPlugin).
- **Object constraints**: minProperties, maxProperties, required
  (requiredPlugin), additionalProperties, properties (built in),
  patternProperties, propertyNames, dependentRequired, dependentSchemas.
- **Value constraints**: enum (oneOfPlugin), const (literalPlugin).
- **Composition**: allOf, anyOf and not (customPlugin); oneOf (oneOfPlugin plus
  customPlugin).
- **Conditionals**: if/then/else (requiredIfPlugin plus customPlugin).
- **References**: `$ref`, `definitions` and `$defs`, built into
  jsonSchemaPlugin.
- **Content**: contentEncoding, contentMediaType.
- **Access control**: readOnly and writeOnly (readOnlyWriteOnlyPlugin).

Note: `dependentRequired` and `dependentSchemas` are Draft 2019-09 keywords,
not Draft-07, whose keyword is `dependencies`. Claiming "100% JSON Schema
compatible" requires `dependencies` too.

## The site's page structure, which is the table of contents of what is published

Top navigation: /docs/getting-started, /plugins, /benchmarks, /json-schema,
/roadmap. The docs sidebar: Getting Started (Introduction, Core Concepts,
Examples & Patterns), Guides (Custom Plugins, Troubleshooting), API Reference
(Builder API, Validator API, Plugin Registry), Plugins (Builder Generator →
/generator, which does not exist), Tools (the same), Future (Roadmap).

`/plugins` is not a static catalog but an interactive generator: pick plugins
and it produces Builder code to copy, with a type filter (string, number,
boolean, array, object, date) and a search. The code it generates imports from
the package root, `import { xxxPlugin } from '@maroonedog/luq'` — which
contradicts every other page's instruction that individual subpath imports are
required.

## Contracts to preserve (22)

### must-preserve (15)

#### Builder
- Source: the README (lines 20-47) and the builder API page (29-56, 468-497)
- Shape: Builder(): ChainableBuilder — use(...plugins) → for<T>() → v(path, fn, options?) / useField(path, rule) → strict() → build()
- Meaning: a factory function; no `new`. `use()` comes before `for()`. Both the variadic `use(a,b,c)` and the chained `.use(a).use(b)` are accepted. A duplicate `use` of the same plugin is ignored. A method of a plugin that was not used does not appear in the type at all, so it is a compile error rather than a run-time one.

#### for<T>()
- Source: the builder API page (57-71) and core-concepts
- Shape: for<TObject extends object>(): FieldBuilder<TObject>
- Meaning: names an existing TypeScript type as the subject. This is the core of not forcing a schema to be redeclared. It fixes the path argument of every later `v()` and the type of `b`.

#### v(path, builderFn, options?)
- Source: the builder API page (73-124)
- Shape: v(path: NestedKeyOf<T> & string, fn: (b: FieldBuilder) => Chain, options?: FieldOptions<V> | V): FieldBuilder<T>
- Meaning: declares a field's validation. The `b` in the second argument carries the per-type entrances b.string, b.number, b.boolean, b.array, b.object and b.date, from which only the methods of used plugins chain. The third argument is either FieldOptions or the default value itself, as a shorthand.

#### The field path grammar
- Source: the troubleshooting page (63-186) and the builder API page's Field Path Syntax box
- Shape: 'name' | 'a.b.c' | 'tags[*]' | 'items[*].name' | 'items[*].attributes.color' | 'data[*][*]' | 'customer.addresses[*].city'
- Meaning: dots nest, `[*]` means every element, and `[*]` chains across dimensions. A specific index — `items[0].name`, `tags[0]`, `data[0][0]` — is declared explicitly unsupported. A primitive array is validated per element with `'tags[*]'`.

#### build()
- Source: the builder API page (226-247) and the examples page
- Shape: build(): Validator<T>
- Meaning: finalises the validator. Three pages instruct that construction is expensive and that a validator should be built once and reused — the examples page's Performance Patterns and the troubleshooting page's memory-leak section.

#### validator.validate(value, options?)
- Source: the validator API page (52-71, and the API table)
- Shape: validate(value: unknown, options?: ValidationOptions): Result<T>
- Meaning: validates only, applying no transform and returning the original value.

#### validator.parse(value, options?)
- Source: the validator API page (73-93), the builder API page, custom-plugins and examples
- Shape: parse(value: unknown, options?: ParseOptions): Result<TTransformed>
- Meaning: validates and returns the transformed value. Returning the transformed TYPE is promised as well (string→number, string→string[]). Five pages emphasise the difference between validate and parse, and that asymmetry is itself the semantics to carry forward.

#### validator.pick(fieldPath)
- Source: the validator API page (180-219, and the FieldValidator table)
- Shape: pick(path: NestedKeyOf<T> & string): FieldValidator<T, TypeOfPath<T, path>>; FieldValidator.validate(value, allValues?: Partial<T>, options?)
- Meaning: carves a single-field validator out of a built one, nested paths included, with other fields' values passable as context in the second argument. It is the recommended way to validate one form field live, and the documentation explicitly prefers it over the plugin registry.

#### Result<T>
- Source: the validator API page (95-172, and the Result Methods table)
- Shape: isValid(): boolean; isError(): boolean; unwrap(): T; unwrapOr(d: T): T; unwrapOrElse(fn: (e: ValidationError[]) => T): T; map(fn): Result<U>; flatMap(fn): Result<U>; tap(fn): Result<T>; tapError(fn): Result<T>; data(): T | undefined; errors: ValidationError[]; toPlainObject(): { valid: boolean; data?: T; errors: ValidationError[] }; valid: boolean; value: T
- Meaning: a functional Result. `unwrap()` throws `LuqValidationException` on failure, identifiable by `e.name` and carrying `e.errors`. `valid` is documented as a backward-compatibility property. `errors` is documented as a property, while src declares it as a property and implements it as a method.

#### ValidationError
- Source: the validator API page (117-121), getting-started and examples
- Shape: { path: string; message: string; code: string }
- Meaning: the path is an absolute dotted path, `'user.email'`. The code is a plugin-derived identifier, with `'required'`, `'stringEmail'`, `'min_length'` and `'invalid_email'` all appearing as examples — the naming convention is inconsistent within the documentation itself. An example puts the errors straight into an API response.

#### ValidationOptions
- Source: the validator API page (221-238)
- Shape: { abortEarly?: boolean; context?: unknown }
- Meaning: abortEarly defaults to false, collecting every error. `context` propagates to every field validator and is readable from a context-category plugin.

#### fromJsonSchema(schema)
- Source: the README (72-107) and the json-schema page's two Quick Setup blocks
- Shape: Builder().use(jsonSchemaFullFeaturePlugin).fromJsonSchema(schema).build(), or Builder().use(jsonSchemaPlugin).use(...individual plugins).fromJsonSchema(schema).build()
- Meaning: a builder-extension plugin grows the method on Builder itself, bypassing `for<T>()`. It takes any schema object obtained at run time. The full-feature version contains every keyword; the plugin version takes only the plugins for the keywords in use and tree-shakes. That choice is the basis of the published bundle-size difference, 31.75KB against 26.06KB.

#### plugin()
- Source: the custom-plugins page (26-119, 275-320) and the README (109-139)
- Shape: plugin({ name: string; methodName: string; allowedTypes: readonly TypeName[]; category: 'standard'|'fieldReference'|'transform'|'conditional'|'multiFieldReference'|'context'; impl: (...args) => { check(value, allValues?, context?): boolean | { valid: boolean; ... }; code: string; getErrorMessage?(value, path): string; params?: unknown[] } })
- Meaning: the one way a user adds a business rule as a type-safe chain method. That the category decides the type variables reaching the chain builder is the whole subject of that page. A transform's `check` returns `{ valid, transformedValue }` and changes the later types. A conditional can skip the rest with `{ valid: true, __skipAllValidation: true }`.

#### Per-plugin tree-shaking through individual subpath imports
- Source: getting-started (174-180), troubleshooting (24-29) and package.json's exports
- Shape: import { requiredPlugin } from '@maroonedog/luq/plugins/required'; import { stringEmailPlugin } from '@maroonedog/luq/plugins/stringEmail';
- Meaning: both getting-started and troubleshooting state that a barrel or wildcard import is to be avoided and that `import * as plugins from '@maroonedog/luq/plugins'` is no longer supported. ESM is assumed. The current form has a types/import/require triple in package.json's exports per plugin.

#### CSP-safe
- Source: the README (lines 66 and 183) and the benchmarks page (Key Insights, the CSP badge column)
- Shape: never eval, never new Function
- Meaning: claimed unconditionally on the README, the benchmarks page and the landing page as the differentiator against AJV, and sold as compatible with reading a schema dynamically — fetching a JSON Schema and handing it straight to fromJsonSchema. Break it and the reason to exist goes.

### should-preserve (5)

#### FieldOptions
- Source: the builder API page (88-124)
- Shape: { default?: T | (() => T); applyDefaultToNull?: boolean; description?: string; deprecated?: boolean | string; metadata?: Record<string, unknown> }
- Meaning: a default may be a function, for a lazy value. `applyDefaultToNull` defaults to true, applying the default to null as well. `deprecated` may be a string giving the reason. `metadata` is arbitrary. A bare value in the third position is shorthand for the default.

#### strict() / strictOnEditor()
- Source: the builder API page (159-224, and the Strict Mode Behavior box)
- Shape: strict(): FieldBuilder<T> | { /* an error type with no build() */ }
- Meaning: a type-level exhaustiveness check over fields, with no run-time effect. With a field left undeclared it returns a type carrying no `build()` and stops compilation. It may be called anywhere in the chain, and more `v()` calls may follow. `strictOnEditor` is an alias. Rejecting a surplus property at run time is stated to be `objectAdditionalProperties(false, { allowedProperties: [...] })`'s job.

#### pluginPredefinedTransform() / pluginConfigurableTransform()
- Source: the custom-plugins page (157-273)
- Shape: pluginPredefinedTransform({ name, allowedTypes, impl: () => (value, ctx) => ({ valid: true, __isTransform: true, __transformFn: (v) => U }) }); pluginConfigurableTransform({ name, allowedTypes, impl: (...config) => (value, ctx) => ({ ...the same }) })
- Meaning: the entry points for a fixed transform with no arguments and a transform taking configuration. The documentation states there are three ways to make a transform plugin: plugin, predefined and configurable.

#### The asynchronous layer (experimental)
- Source: the troubleshooting page (308-406, the "Async Architecture" box)
- Shape: import { createAsyncContext, addAsyncSupport } from '@maroonedog/luq/async.experimental'; addAsyncSupport(syncValidator); await createAsyncContext<C>().set(key, promise).build(); await validator.withAsyncContext<C>(ctx).validate(data); getAsyncContext<C>(context)
- Meaning: a clear design principle — validation itself stays synchronous, and anything asynchronous is resolved in parallel beforehand and passed in as context. It promises exactly one await across the whole process and zero overhead when nothing asynchronous is used. It is a separate entry point with "experimental" in its name.

#### Environment requirements
- Source: getting-started (12-18, 219-224)
- Shape: Node.js 14.0+, TypeScript 4.1+, target ES2015+, strict and strictNullChecks recommended, esModuleInterop, moduleResolution node
- Meaning: published as the Prerequisites and a tsconfig example. TypeScript 4.1 is the release that introduced template literal types, which sets the floor for the path types.

### optional (2)

#### createPluginRegistry()
- Source: the plugin-registry page (29-55, 826-870)
- Shape: createPluginRegistry(): PluginRegistry; .use(plugin); .for<T>(): TypedPluginRegistry<T>; .createFieldRule<V>(fn, { name, description?, fieldOptions? }): FieldRule<V>; .toBuilder(): ChainableBuilder; .getPlugins(): Record<string, Plugin>
- Meaning: a way to make reusable single-field rules for a team to share and unit-test. After `for<T>()` the name is type-constrained to a valid path of T and the type is inferred. The documentation itself demotes it: with a Builder, use `pick()`.

#### FieldRule / useField()
- Source: the plugin-registry page (166-200, 872-900) and the builder API page (126-160)
- Shape: FieldRule<V>.validate(value, options?): Result<V>; .parse(value, options?): Result<V>; .getPluginRegistry(): PluginRegistry; builder.useField(path, rule): FieldBuilder<T>
- Meaning: a rule validates on its own, and folding it in with `useField` applies its fieldOptions — defaults and metadata — as well. `useField` and `v()` mix in one chain, and it works on array element paths such as `tags[*]`.

## Behavioural rules

- `Builder()` is produced by a call, not by `new Builder()`. `use()` must come before `for()`, and a method of a plugin that was not used appears nowhere in the type — it fails at compile time, not at run time. That "the types grow with the plugins you used" is the type-level reflection of tree-shaking, and it is what the library is.
- A used plugin takes effect once, and a duplicate `use` is ignored. Order does not affect the result. The documentation qualifies this as "for most plugins"; order dependence should not be carried into the new design at all.
- `validate()` applies no transform; `parse()` does. Both return `Result<T>`, but parse's T must be the transformed type, which four pages promise with worked examples (string→number, string→string[]). Break the asymmetry and the whole documentation becomes false.
- A field path is a static string, type-constrained to the union of valid paths derived from T. An invalid path is a compile error. Arrays use `[*]` only; a concrete index such as `[0]` is unsupported. `[*]` chains across dimensions (`data[*][*]`). A primitive array is validated per element with `'tags[*]'`.
- Validation is entirely synchronous. Anything asynchronous is handled in a separate layer that resolves it in parallel beforehand and passes it as context, and no Promise enters the core API. Overhead is zero when nothing asynchronous is used.
- Never eval, never new Function, never the Function constructor, never dynamic code generation. Working under a restrictive CSP is the one differentiator against AJV and must not be broken for speed.
- Building a validator is designed to cost more than validating with it. Three places instruct the reader to build once at module scope and reuse it rather than building inside a request handler, so this performance characteristic is a published promise.
- Each plugin is an independent module with no side effects, statically reachable, importable individually from `@maroonedog/luq/plugins/<name>`. A barrel import is declared unsupported.
- JSON Schema support comes in two forms: `jsonSchemaFullFeaturePlugin` contains every keyword in one plugin, favouring convenience over size, while `jsonSchemaPlugin` plus individual plugins takes only what is used. The existence of that choice is the basis of the published bundle-size table.
- A custom plugin's category is not a label: it decides the type variables reaching the chain builder and the signature of the method that appears. standard takes bare arguments; fieldReference takes a valid path of T first; conditional takes `(allValues: T) => boolean`; transform takes `<U>(fn: (v: TCurrent) => U)` and changes the later type to U; multiFieldReference takes a readonly array of paths; context takes a context argument. That correspondence is the skeleton of the custom-plugin API.
- Errors are a flat array of `{ path, message, code }`. The path must reach the user as an absolute path with real indices, `'items[0].name'` — `[*]` is the declaring notation, not the reporting notation.
- `strict()` does nothing at run time. Rejecting a surplus property at run time is `objectAdditionalProperties(false)`'s role, and the documentation flags the separation as a common misunderstanding.
- Never make the user rewrite their existing TypeScript types. Rather than deriving a type from a schema, an interface or type already in hand is passed to `for<T>()`. This is the principal idea, held up on the landing page, in the README and in core-concepts.

## Not carried forward

- **Result's duplicated accessors** — `isValid()` beside `valid`, `data()` beside `value`, an `errors` property beside an `errors()` method, and the full set of unwrap, unwrapOr, unwrapOrElse, map, flatMap, tap, tapError, onSuccessPostProcess and toPlainObject. In src, `errors` is a property in the interface (line 148) and a method in the implementation (line 210), and the documentation mixes `result.errors` with `result.getErrors()`. The documentation calls `valid` a backward-compatibility property, but a library nobody uses yet has no backward compatibility. Settle on one discriminated union (`{ valid: true; value: T } | { valid: false; issues: ValidationIssue[] }`) and keep the functional helpers to a minimum.
- **result.getErrors() / getErrorMessages() / getFieldErrors() / validator.validateWithContext()** — none exists in src. Documentation phantoms, to be deleted rather than inherited.
- **registry.register(plugin), conditionalPlugin, and equalsPlugin / .equals(true)** — none exists. `register` is a misspelling of `use`; the other two were invented by whoever wrote the documentation. `.equals(true)` matters because it appears twice for the common "accept the terms" case, so the new documentation has to decide whether booleanTruthy or literal covers it and rewrite the example.
- **The README's Quick Start API shape** — calling `validateUser(data)` directly and reading `result.issues`. The README's first thirty lines disagree with the implementation. "build() returns a callable function" is an attractive shape in itself, but all thirteen documentation pages assume `validator.validate(...)`, so one of the two has to be chosen. The current double specification must not be inherited.
- **Three ways to specify an error message: messageFactory, issueFactory, and a bare string as the second argument** — messageFactory in 59 places in the plugin data and 2 in the README, issueFactory in 72 places in the generated documentation, plus `.pattern(/re/, 'msg')`, `.compareField('password', 'msg')`, `.equals(true, 'msg')`, `.required({ message: '...' })` and `.email({ message: '...' })`. Five documented ways to do one thing. Choose one.
- **The `methodName` and `usage` fields in the site's plugin data** — the documentation generator is broken and writes export names into `methodName` (stringEmail, stringUrl, stringDatetime, stringBase64, stringHostname, stringIpv4, stringIpv6, stringIri, stringJsonPointer, stringContentMediaType). `usage` carries more than twenty meaningless generated strings such as `builder.v("field", b => b.string.stringEmail(..., "value", ..., "value"))`. The declarations in src are correct; this artefact should be discarded and rewritten.
- **docs/generated/plugins.md** — of its 2269 lines, the table of contents lists three plugins that do not exist, every entry carries a broken documentation fragment (`**Since**: 1.0.0\n/`), and its custom-message examples use `issueFactory`, disagreeing with the site. The generator itself needs rebuilding.
- **The import form the site's code generator emits** — `import { xxxPlugin } from '@maroonedog/luq'`, from the package root, while getting-started and troubleshooting instruct that a barrel import breaks tree-shaking and must not be used. The generator's output has to be individual subpath imports.
- **core-concepts' `items.*.id` dot-star notation** — every other page uses `items[*].id`. A one-off mistake; unify on `[*]`.
- **The sidebar's `/generator` link, appearing twice in two sections** — there is no such page; the real one is `/plugins`, and the duplicate link needs the site structure revisiting.
- **The README's "1.2M ops/sec (simple), 43K ops/sec (complex)" and "40+ built-in plugins"** — the benchmarks page measures 694,692 and 35,946, so the README inflates them by roughly 1.7× and 1.2×. The plugin count is 69 to 70, so "40+" understates it. Generate both from one measurement file.
- **Keeping the plugin registry (createPluginRegistry / createFieldRule / toBuilder / useField) as a first-class API** — the documentation demotes it in three places, saying that with a Builder one should use `pick()` and that the registry is unnecessary in most cases. Its page is the longest on the site at 1010 lines, and that length is duplication rather than value. Consider folding it into `pick()` plus "make the FieldRule equivalent as a plain function", and not creating a separate world.
- **Exposing `ChainableFieldBuilder<TObject, TPlugins, TType, TCurrentType, TTypeState>`, five type variables** — the custom-plugins page puts this internal signature straight into user-facing documentation. What is worth carrying forward is the contract of which methods each category grows; the order and names of the type variables are implementation detail.
- **The site's empty content collections** — the Astro content collections are configured and hold not one file, while every page's prose is hard-coded as a template literal inside an `.astro` file. Page and prose are fused, so neither a diff review nor a translation is possible. Grounds for rebuilding the documentation infrastructure.

## Published symbols (216)

`Builder`, `use`, `for`, `v`, `useField`, `strict`, `strictOnEditor`, `build`, `validate`, `parse`, `pick`, `fromJsonSchema`, `Result`, `isValid`, `isError`, `unwrap`, `unwrapOr`, `unwrapOrElse`, `map`, `flatMap`, `tap`, `tapError`, `data`, `errors`, `valid`, `value`, `toPlainObject`, `ValidationError`, `ValidationResult`, `ValidationOptions`, `ParseOptions`, `FieldOptions`, `FieldBuilder`, `FieldValidator`, `FieldRule`, `MessageContext`, `IssueContext`, `LuqValidationException`, `NestedKeyOf`, `TypeOfPath`, `TypeName`, `PluginCategory`, `PluginType`, `TypedPlugin`, `BuilderExtensionPlugin`, `BuilderExtensionMethod`, `TransformAwareValidator`, `ApplyFieldTransforms`, `ExtractFieldType`, `ExtractFieldRuleType`, `FieldRuleDefinition`, `PluginRegistry`, `TypedPluginRegistry`, `createPluginRegistry`, `createFieldRule`, `toBuilder`, `getPlugins`, `getPluginRegistry`, `plugin`, `PluginImplementation`, `pluginPredefinedTransform`, `pluginConfigurableTransform`, `pluginBuilderExtension`, `createAsyncContext`, `addAsyncSupport`, `withAsyncContext`, `getAsyncContext`, `GlobalConfig`, `globalConfig`, `setGlobalConfig`, `getGlobalConfig`, `resetGlobalConfig`, `arrayContainsPlugin`, `arrayIncludesPlugin`, `arrayMaxLengthPlugin`, `arrayMinLengthPlugin`, `arrayUniquePlugin`, `booleanFalsyPlugin`, `booleanTruthyPlugin`, `compareFieldPlugin`, `conditionalSchemaPlugin`, `customPlugin`, `fromContextPlugin`, `jsonSchemaPlugin`, `jsonSchemaFullFeaturePlugin`, `literalPlugin`, `nullablePlugin`, `numberFinitePlugin`, `numberIntegerPlugin`, `numberMaxPlugin`, `numberMinPlugin`, `numberMultipleOfPlugin`, `numberNegativePlugin`, `numberPositivePlugin`, `numberRangePlugin`, `objectPlugin`, `objectAdditionalPropertiesPlugin`, `objectDependentRequiredPlugin`, `objectDependentSchemasPlugin`, `objectMaxPropertiesPlugin`, `objectMinPropertiesPlugin`, `objectPatternPropertiesPlugin`, `objectPropertyNamesPlugin`, `objectRecursivelyPlugin`, `oneOfPlugin`, `optionalPlugin`, `optionalIfPlugin`, `orFailPlugin`, `readOnlyWriteOnlyPlugin`, `requiredPlugin`, `requiredIfPlugin`, `skipPlugin`, `stitchPlugin`, `stringAlphanumericPlugin`, `stringBase64Plugin`, `stringContentEncodingPlugin`, `stringContentMediaTypePlugin`, `stringDatePlugin`, `stringDatetimePlugin`, `stringDurationPlugin`, `stringEmailPlugin`, `stringEndsWithPlugin`, `stringExactLengthPlugin`, `stringHostnamePlugin`, `stringIpv4Plugin`, `stringIpv6Plugin`, `stringIriPlugin`, `stringIriReferencePlugin`, `stringJsonPointerPlugin`, `stringMaxPlugin`, `stringMinPlugin`, `stringPatternPlugin`, `stringRelativeJsonPointerPlugin`, `stringStartsWithPlugin`, `stringTimePlugin`, `stringUriTemplatePlugin`, `stringUrlPlugin`, `transformPlugin`, `tupleBuilderPlugin`, `unionGuardPlugin`, `uuidPlugin`, `validateIfPlugin`, `.required()`, `.optional()`, `.nullable()`, `.min()`, `.max()`, `.range()`, `.exactLength()`, `.pattern()`, `.email()`, `.url()`, `.uuid()`, `.alphanumeric()`, `.startsWith()`, `.endsWith()`, `.base64()`, `.date()`, `.datetime()`, `.time()`, `.duration()`, `.hostname()`, `.ipv4()`, `.ipv6()`, `.iri()`, `.iriReference()`, `.jsonPointer()`, `.relativeJsonPointer()`, `.uriTemplate()`, `.contentEncoding()`, `.contentMediaType()`, `.integer()`, `.finite()`, `.positive()`, `.negative()`, `.multipleOf()`, `.truthy()`, `.falsy()`, `.minLength()`, `.maxLength()`, `.unique()`, `.contains()`, `.includes()`, `.object()`, `.additionalProperties()`, `.minProperties()`, `.maxProperties()`, `.patternProperties()`, `.propertyNames()`, `.dependentRequired()`, `.dependentSchemas()`, `.recursively()`, `.oneOf()`, `.literal()`, `.custom()`, `.transform()`, `.compareField()`, `.stitch()`, `.requiredIf()`, `.optionalIf()`, `.validateIf()`, `.skip()`, `.orFail()`, `.conditionalSchema()`, `.fromContext()`, `.readOnly()`, `.tupleBuilder()`, `.unionGuard()`, `b.string`, `b.number`, `b.boolean`, `b.array`, `b.object`, `b.date`, `@maroonedog/luq`, `@maroonedog/luq/plugins/<pluginName>`
