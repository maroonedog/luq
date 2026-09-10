# plugin-catalog-relational

## The whole picture

This area covers validation that cannot be decided from one field's value
alone, and the rewriting of values. The previous implementation split into five
independent clusters of meaning.

1. **Field reference (fieldReference)** — `compareField`. Compares the field's
   own value with another field's, named by a dotted path, through a comparison
   function.
2. **Multi-field reference (multiFieldReference)** — `stitch`. Takes a tuple of
   field paths, bundles their values into a `{ [path]: value }` object and
   hands it to a user function. Its essential value is that
   `FieldsToObject<TObject, TFields>` recovers each field's real type at the
   type level.
3. **Conditionals (conditional)** — `validateIf`, `requiredIf`, `optionalIf`,
   `skip` and `orFail`. All take `(allValues) => boolean` and control whether
   validation runs, whether the field is required, and forced failure.
4. **Context reference (context)** — `fromContext`. The way to bring
   asynchronously resolved external data, such as a database uniqueness check,
   into validation.
5. **Transform (transform)** — `transform`. Rewrites the value and
   **propagates the output type at the type level**, which reaches
   `.build()`'s return type and changes what `parse()` returns.

`custom` (an arbitrary predicate) and `conditionalSchema` (JSON Schema
if/then/else) also belong here.

## Execution order — the one measured truth

The main route through `Builder().….build()` is validator-factory into
`createUnifiedValidator`. All of its execution paths use the same order:

1. **Apply the field option's default** — `.v(path, def, defaultValue)`'s third
   argument, applied to `undefined` and, when `applyDefaultToNull !== false`,
   to `null`. It happens first in both `validate()` and `parse()`.
2. **Short-circuit on `skipForNull` / `skipForUndefined`** — a null reaching a
   field with `nullable()`, or an undefined reaching one with `optional()`,
   **skips validation and transformation entirely**, and parse returns the
   original value.
3. **Run every validator in registration order**, breaking the moment
   `shouldSkipAllValidation` — which is `validateIf` or `skip` — returns true,
   skipping **everything after it**. So `validateIf` and `skip` mean nothing
   unless placed at the head of the chain; they are position-dependent.
4. Stop as soon as one validator fails; with `abortEarlyOnEachField` defaulting
   to true, it returns on the first.
5. **Only in parse mode**, compose and apply the transforms in registration
   order.

So the settled meaning is **validate first, transform after**, and
**`validate()` performs no transformation and returns the original data**.
Writing `.transform(f).min(3)` still runs `min(3)` against the untransformed
value: where `.transform()` sits in the chain does not affect execution order,
because validators and transforms are accumulated into separate arrays.

**Note:** one test asserts the opposite — that the transform runs first and
`validate()` returns transformed data — which does not hold against the
implementation; a rotten test. The `FieldRule.parse` fallback in the plugin
registry is the only place implemented as "transform first", contradicting the
main route, and since the `_executionPlan` it checks for was removed for bundle
size and is never generated, that fallback always runs. **The new
implementation must settle on one order and hold it on every path.**

## The type semantics of transform

- The chain method's type is
  `<TOutput>(fn: (value: ApplyTypeState<TCurrent, TTypeState>) => TOutput) => ChainableFieldBuilder<..., TOutput, ...>`.
  The input type reflects the null/undefined removal state that `required()`
  and `nullable()` produced, and `TOutput` becomes the chain's current type.
  Chained transforms compose at the type level too.
- `.v()` extracts the final `TOutput` and adds `Record<path, TOutput>` to
  `TMap` **only when the type actually changed**.
- `.build()` returns
  `TransformAwareValidator<TObject, ApplyFieldTransforms<TObject, TMap>>`, where
  `ApplyFieldTransforms` is `DeepMerge<TObject, FlatMapToNested<TMap>>` —
  expanding dotted and array paths into a nested type and deep-merging it into
  the original. So `validate()` gives `Result<TObject>` and `parse()` gives
  `Result<the transformed type>`.
- **Forbidden output types**: `Array<plain object>` and
  `Array<union containing a plain object>`. When `IsForbiddenTransformOutput<T>`
  is true, the argument type is replaced by an error string literal type
  instead of a function, and the assignment fails to compile. The stated reason
  is how nested array support happens to be implemented.
  `Array<string|number>`, `Date[]`, `RegExp[]`, arrays of functions and arrays
  of arrays are permitted.

## How messageFactory works

- The types are `MessageFactory<TContext> = (ctx: MessageContext & TContext) => string`
  and `MessageContext = { path: string; value: any; code: string }`. Each plugin
  extends the context with its own `TContext`: compareField adds
  `{ fieldPath, targetValue }`, stitch adds `{ fields, fieldValues, allValues }`,
  and requiredIf, optionalIf and validateIf add `{ condition: boolean }`.
- The shared options are
  `ValidationOptions = { code?: string; fieldName?: string; severity?: Severity; messageFactory?: MessageFactory }`,
  with `Severity = "INFO" | "WARN" | "ERROR"`. Neither `fieldName` nor
  `severity` is read anywhere at run time.
- Resolution at run time goes through `computeErrorMessage`: prefer
  `validator.getErrorMessage(value, path, rootData)`, fall back to
  `validator.messageFactory({path, value, code})`, and if either throws, use
  `` `Validation failed for ${path}` ``.
- The code resolves as `validator.code || validator.pluginName || "VALIDATION_ERROR"`.
- `resolveMessage` in message-factories.ts is entirely dead: the file its
  opening comment refers to does not exist, and nothing imports it.

## Default code and message per plugin

| Method | category | Default code | How the message is decided | Context reaching messageFactory |
|---|---|---|---|---|
| `compareField(fieldPath, opts?)` | fieldReference | `"equals"` | `` `Value must be equal to ${fieldPath}` ``; `"Values must be equal"` only when no fieldPath is given, which is unreachable | `{path, value, code, fieldPath, targetValue}` |
| `stitch(fields, validate, opts?)` | multiFieldReference | `"stitch_validation_failed"` | the `message` returned by `validate()`, then `messageFactory(...)`, then `` `Cross-field validation failed for ${path}` ``; with no `allValues`, `"Cross-field validation failed - no form data available"` | `{path, value, code, fields, fieldValues, allValues}` |
| `orFail(condition, opts?)` | conditional | `"validation_error"` | `opts.message` as a bare string, then `messageFactory({path,value,code,message})`, then `"Validation failed"` | `{path, value, code, message}` |
| `custom(validator, opts?)` | standard | `"CUSTOM_VALIDATION_FAILED"` | the `message` from a `{valid,message}` return, then `messageFactory({path,value,code})`, then `` `${path} custom validation failed` `` | `{path, value, code}` |
| `fromContext(options)` | context | `"context_validation"` | with a context: `validate().message`, then `errorMessage`, then `"Context validation failed"`. Without one and `required`: `errorMessage`, then `"Context data is required for validation"`. On an exception: `errorMessage`, then `` `Context validation error: ${error}` `` | no messageFactory; an `errorMessage` string only |
| `requiredIf(condition, opts?)` | conditional | `"requiredIf"` | `"Field is required when condition is met"` | `{path, value, code, condition}` |
| `optionalIf(condition, opts?)` | conditional | `"optionalIf"`, **ignoring `opts.code`** | fixed at `"Field is optional when condition is met"`, **ignoring messageFactory** | — |
| `validateIf(condition, opts?)` | conditional | `"validateIf"` | `getErrorMessage` throws, on the premise that it produces no error | — |
| `skip(condition, opts?)` | conditional | `"skip"` | the unreachable `"Skip condition not met"`, **ignoring opts entirely** | — |
| `transform(fn)` | transform | `"transform"` | the unreachable `"Transform operation failed"`. An exception inside a transform is not caught and **propagates** | — |
| `conditionalSchema(options)` | standard, objects only | `"CONDITIONAL_SCHEMA"` | if matched with a then: `` `Value at ${path} must match "then" schema` ``; if unmatched with an else: the same for "else"; otherwise `` `Conditional validation failed at ${path}` `` | `{path, value, code}` |

## The validation semantics of each plugin

**compareField(fieldPath, { compareFn?, code?, messageFactory? })** —
`createFieldAccessor(fieldPath)` compiles the dotted path into a composed
optional-chaining function in advance and reads the target from `allValues`.
`compareFn(value, targetValue)` defaults to strict equality. Without
`allValues` it **fails**. Its uses are password/confirmPassword, start/end
dates, min/max. Its allowedTypes are string, number, boolean, date, object,
array, tuple and union — the documentation comment listing "null" and
"undefined" is wrong.

**stitch(fields, validate, options?)** — `fields` is a const tuple of
`readonly (NestedKeyOf<TObject> & string)[]`. `createBatchAccessors` builds an
accessor per path in advance, assembles `{ [fieldPath]: value }` and calls
`validate(fieldValues, currentValue, allValues)`, which returns
`{ valid: boolean; message?: string }`. Without `allValues` it **fails**. The
problem it set out to solve is receiving, in a type-safe way, only the fields a
cross-field check declares — rather than taking the whole `allValues` as `any`.
That is why it sits between compareField (one to one) and custom (untyped
access to everything).

**orFail(condition, options?)** — fails unconditionally when the condition is
true, whatever the value. A **negative gate**, for a deprecated field, a debug
field that must not exist in production, a field a user lacks permission for,
or an item behind a feature flag that is off. `check` returns
`!condition(allValues)`. Without `allValues` it **passes** — the opposite
default from compareField and stitch.

**custom(validator, options?)** —
`validator: (value, rootData?) => boolean | { valid: boolean; message?: string }`.
A validator that throws **counts as a failure**; the exception is swallowed.
`rootData` is the whole root object being validated.

**fromContext(options)** — the intent is to bring externally fetched data — an
email uniqueness check, stock, permissions — into validation.
`ContextValidationOptions = { validate(value, context, allValues): {valid, message?}; errorMessage?; code?; required? (default false); fallbackToValid? (default true) }`.
The intended use is `validator.withAsyncContext(ctx).validate(data)`.

**The asynchronous context is not connected to the main route.** The hoisted
`check` only does `if (allValues && !required) contextData = allValues`, so
specifying `required: true` leaves `contextData` unset and it **always returns
false**. `performContextValidation`, the real implementation using
`getAsyncContext(ctx)`, is held on the object and called by no execution path.
`createAsyncContext`, `addAsyncSupport` and `withAsyncContext` are not even
exported from `src/index.ts`, so they are not published API.

**validateIf / skip** — both provide `shouldSkipAllValidation` and break the
validator loop the moment it returns true. **Validators registered before them
have already run.** The difference between them is a nuance of meaning —
"validate only when true" against "do not validate when true" — and in the
implementation it is only the polarity of the condition.

**requiredIf** — when the condition is true it requires
`value !== undefined && value !== null && value !== ""`. When false it always
passes. Without `allValues` it passes.

**optionalIf** — a true condition with an empty value passes; a false condition
with an empty value **fails**, making it required in effect; a present value
always passes. It carries a `shouldSkipValidation` hook, but the unified
validator only ever calls `shouldSkipAllValidation`, so **the "skip the rest"
meaning is not implemented**.

**conditionalSchema({ ifSchema, thenSchema?, elseSchema?, validator? })** —
Draft-07's if/then/else. null and undefined pass unconditionally. A supplied
`validator` decides; otherwise the built-in `evaluateSchema` does, and that
built-in looks only at `type` (distinguishing `integer` as its own type),
`const` and `enum` inside `properties`, and `const` and `enum` at the top. A
branch with no then or else passes. **It is exported from no index.ts.**

## ArrayContext — declared and non-functional

`ArrayContext = { index: number; item: TItem; array: TItem[] }`. `requiredIf`,
`optionalIf` and `validateIf` are designed to receive it as their condition's
second argument, and the documentation shows an `items[].billingAddress`
example. But the main route passes only three arguments —
`check(value, rootData)` and `getErrorMessage(value, path, rootData)` — so
**arrayContext is always undefined**. Validating an array element passes the
root object and neither the index nor the item. Only validation-engine.ts
propagates an arrayContext, and the main route does not use that file.

## Inconsistencies in the published surface

`src/index.ts`, the package's main entry, **does not export `stitchPlugin`,
`orFailPlugin`, `fromContextPlugin` or `optionalIfPlugin`**.
`src/core/plugin/index.ts` exports those four and does not export
`conditionalSchemaPlugin`. package.json's exports has
`./plugins/compareField`, `./plugins/transform` and `./plugins/custom` but not
`./plugins/stitch`, `./plugins/orFail` or `./plugins/fromContext`. So **stitch,
orFail and fromContext are reachable through none of the three published
routes**. All three routes should be derived from one source.

## Entirely dead code in this area

- `src/core/transform/` (index.ts, string/index.ts, sanitize.ts, replace.ts,
  defaultValue.ts) — imported from nowhere inside src; only tests reference it.
- `resolveMessage` in `src/core/plugin/message-factories.ts`.
- `src/core/plugin/stitchSimple.ts` and `src/core/plugin/stitch-typed.ts` — a
  third and second implementation carrying the same `methodName: "stitch"`.
- `fromContextPlugin` in `src/core/async.experimental/from-context-plugin.ts` —
  the same name as the one in `src/core/plugin/fromContext.ts`, written in an
  older form that does not use `plugin()` and is incompatible with the plugin
  system.
- fromContext.ts's helpers — `emailDuplicationCheck`, `passwordConfirmation`,
  `inventoryCheck`, `conditionalRequired`, `createTypedContextValidator` and
  `ContextValidationTemplates` — used from nowhere and exported from nowhere;
  sample code in effect.
- types.ts's flag types and guards (`SkipAllValidationFlag`,
  `SkipFurtherValidationFlag`, `TransformFlag`, `NullableFlag`,
  `RecursiveFlag`, `ValidationResultWithFlags`, `WithFlags`,
  `ValidationFlags`) — at run time the work is done by separate machinery
  (`shouldSkipAllValidation`, `__isTransform`, `skipForNull`), and these guards
  are never called.
- `ValidatorFormat`'s unused markers `__isDefault`, `__isPreprocess`,
  `__isCoerce`, `__isStitch` and `__stitchOptions`. No plugin corresponds to
  any of them.

## Contracts to preserve (23)

### must-preserve (12)

#### compareField
- Source: `src/core/plugin/compareField.ts`
- Shape: b.<type>.compareField(fieldPath: NestedKeyOf<TObject> & string, options?: { compareFn?: (value, targetValue) => boolean; code?: string; messageFactory?: (ctx: { path; value; code; fieldPath; targetValue }) => string })
- Meaning: takes the other field's value out of allValues by dotted path and judges with compareFn(own value, other value), which defaults to strict equality. Fails when allValues is unavailable. Default code "equals" and default message `Value must be equal to ${fieldPath}`.

#### compareFieldPlugin
- Source: `src/core/plugin/compareField.ts`
- Shape: export const compareFieldPlugin (name "compareField", methodName "compareField", category "fieldReference", allowedTypes string, number, boolean, date, object, array, tuple, union)
- Meaning: the published symbol that grows `.compareField()` through `Builder().use(compareFieldPlugin)`. Reachable through all three routes: the main entry, the category index, and the `./plugins/compareField` subpath.

#### stitch
- Source: `src/core/plugin/stitch.ts`
- Shape: b.<type>.stitch<const TFields extends readonly (NestedKeyOf<TObject> & string)[]>(fields: TFields, validate: (fieldValues: FieldsToObject<TObject, TFields>, currentValue, allValues: TObject) => { valid: boolean; message?: string }, options?: { code?: string; messageFactory?: (ctx: { path; value; code; fields; fieldValues; allValues }) => string })
- Meaning: three positional arguments. Bundles the declared paths' values into `{ [path]: value }` and hands them to validate, where FieldsToObject recovers each path's real type — the type safety is the point. The message prefers validate()'s own, then messageFactory, then `Cross-field validation failed for ${path}`. Fails without allValues. Default code "stitch_validation_failed".

#### FieldsToObject<T, K>
- Source: `src/types/stitch-types.ts`
- Shape: type FieldsToObject<T, K extends readonly (NestedKeyOf<T> & string)[]> = { [P in K[number]]: TypeOfPath<T, P> }
- Meaning: builds, from a tuple of field paths, an object type carrying those paths' real types. The core of stitch's type safety.

#### transform
- Source: `src/core/plugin/transform.ts, src/core/builder/plugins/plugin-types.ts:470-483`
- Shape: b.<type>.transform<TOutput>(fn: (value: current type) => TOutput): ChainableFieldBuilder<..., TOutput, ...>
- Meaning: rewrites the value and replaces the chain's current type with TOutput. At run time it accumulates into an array separate from the validators, and is composed and applied in registration order only after every validator succeeds. It runs in parse() and not in validate(). An exception inside a transform is not caught and propagates. Chainable.

#### TransformAwareValidator<T, TTransformed>
- Source: `src/core/builder/plugins/plugin-types.ts:1133`
- Shape: interface TransformAwareValidator<T extends object, TTransformed = T> { validate(value, options?): Result<T>; parse(value, options?): Result<TTransformed>; pick<K extends NestedKeyOf<T>>(key: K): FieldValidator<T, TypeOfPath<T, K>>; validateRaw?(value, options?): boolean; parseRaw?(value, options?): { valid; data?; error? } }
- Meaning: what `.build()` returns. That validate gives back the original type T, applying no transform, while parse gives back the transformed type, is the published contract.

#### ApplyFieldTransforms<TObject, TMap>
- Source: `src/core/builder/plugins/plugin-types.ts:1164, src/core/builder/types/types.ts:60-166`
- Shape: type ApplyFieldTransforms<TObject, TMap> = DeepMerge<TObject, FlatMapToNested<TMap>>
- Meaning: takes the flat "path to transformed type" map that `.v()` accumulated, expands the dotted and array paths into a nested type, and deep-merges it into the original. It decides parse()'s return type. The accumulation leaves TMap unchanged when the transformed type is assignable to the original — it records only a real change.

#### custom
- Source: `src/core/plugin/custom.ts`
- Shape: b.<type>.custom(validator: (value, rootData?) => boolean | { valid: boolean; message?: string }, options?: { code?: string; messageFactory?: (ctx: MessageContext) => string })
- Meaning: validation by an arbitrary predicate. `rootData` is the whole root object being validated. Returning an object makes its message the error message. A validator that throws counts as a failure, the exception being swallowed. Default code "CUSTOM_VALIDATION_FAILED", default message `${path} custom validation failed`.

#### requiredIf
- Source: `src/core/plugin/requiredIf.ts`
- Shape: b.<type>.requiredIf(condition: (allValues: TObject, arrayContext?: ArrayContext) => boolean, options?: ValidationOptions<{ condition?: boolean }>)
- Meaning: required only when the condition is true. Emptiness is `value === undefined || value === null || value === ""`. A false condition always passes, and so does a missing allValues. Default code "requiredIf", default message "Field is required when condition is met".

#### validateIf
- Source: `src/core/plugin/validateIf.ts`
- Shape: b.<type>.validateIf(condition: (allValues: TObject, arrayContext?: ArrayContext) => boolean, options?: ValidationOptions).<the rest of the chain>
- Meaning: when the condition is false, every validator registered after this call is skipped — position-dependent, on the premise that it goes at the head of the chain. It produces no error of its own. Transforms are not skipped; only the validator loop breaks.

#### MessageFactory / MessageContext / ValidationOptions
- Source: `src/core/plugin/types.ts:28-47`
- Shape: type MessageFactory<TContext = {}> = (ctx: MessageContext & TContext) => string; interface MessageContext { path: string; value: any; code: string }; interface ValidationOptions<TContext = {}> { code?: string; fieldName?: string; severity?: Severity; messageFactory?: MessageFactory<TContext> }
- Meaning: the shared error-message contract across every plugin, with each extending the context through TContext. The default code is overridable with options.code. `fieldName` and `severity` are dead fields, read nowhere at run time.

#### The execution-order contract
- Source: `src/core/optimization/unified-validator.ts:218-330, 505-700; src/core/builder/context/field-context.ts:344-368`
- Shape: apply the default → short-circuit on skipForNull/skipForUndefined → every validator in registration order, breaking on shouldSkipAllValidation → stop on failure → in parse mode only, compose every transform in registration order
- Meaning: validate() performs no transformation and returns the original data; only parse() transforms. Where `.transform()` sits in the chain does not affect execution order. A null on a nullable field and an undefined on an optional one skip validation and transformation entirely, and parse returns the original value.

### should-preserve (8)

#### orFail
- Source: `src/core/plugin/orFail.ts`
- Shape: b.<type>.orFail(condition: (allValues: TObject) => boolean, options?: { code?: string; message?: string; messageFactory?: (ctx: MessageContext & { message?: string }) => string })
- Meaning: a negative gate failing unconditionally when the condition is true, whatever the value. It expresses a deprecated field, a field that must not exist in production, and prohibitions from permissions or a feature flag. Without allValues it passes — the opposite default from compareField and stitch. Default code "validation_error", default message "Validation failed".

#### optionalIf
- Source: `src/core/plugin/optionalIf.ts`
- Shape: b.<type>.optionalIf(condition: (allValues: TObject, arrayContext?: ArrayContext) => boolean, options?: ValidationOptions)
- Meaning: a true condition with an empty value passes; a false condition with an empty value fails, making it required in effect; a present value always passes. The logical dual of requiredIf. That its code and message are hard-coded and its options ignored is a bug.

#### skip
- Source: `src/core/plugin/skip.ts`
- Shape: b.<type>.skip(condition: (allValues: TObject) => boolean, options?: ValidationOptions).<the rest of the chain>
- Meaning: validateIf with the polarity of the condition inverted, and nothing else. A true condition skips every later validator. Its options are ignored entirely.

#### fromContext
- Source: `src/core/plugin/fromContext.ts, src/core/builder/plugins/plugin-interfaces.ts:506`
- Shape: b.<type>.fromContext<TContext>(options: ContextValidationOptions<TContext>), where ContextValidationOptions = { validate: (value, context: TContext, allValues) => { valid: boolean; message?: string }; errorMessage?: string; code?: string; required?: boolean (default false); fallbackToValid?: boolean (default true) }
- Meaning: validation using externally injected context — an asynchronously resolved uniqueness check, stock, permissions. With `required: true` the context is mandatory and its absence fails; with false, its absence returns fallbackToValid. An exception inside validate counts as a failure. Default code "context_validation". The intent is `validator.withAsyncContext(ctx).validate(data)`, and the asynchronous route is not connected.

#### conditionalSchema
- Source: `src/core/plugin/conditionalSchema.ts`
- Shape: b.object.conditionalSchema(options: { ifSchema: JSONSchema7; thenSchema?: JSONSchema7; elseSchema?: JSONSchema7; validator?: (value, schema: JSONSchema7) => boolean; code?: string; messageFactory?: (ctx: MessageContext) => string })
- Meaning: Draft-07's if/then/else. null and undefined pass unconditionally. It evaluates ifSchema and validates against thenSchema when true and elseSchema when false, passing when the relevant schema is absent. A supplied validator plugs in any schema evaluator. Default code "CONDITIONAL_SCHEMA".

#### ArrayContext
- Source: `src/core/plugin/types.ts:68-75`
- Shape: interface ArrayContext<TItem = any> { index: number; item: TItem; array: TItem[] }
- Meaning: the context telling a condition which index and which item is being validated. It is declared as the second parameter of requiredIf, optionalIf and validateIf, and the main execution path never passes it — it is always undefined. As an intended feature it is worth carrying forward.

#### Field default options
- Source: `src/core/builder/types/field-options.ts`
- Shape: .v(path, definition, config?: FieldConfig<T>), where FieldConfig<T> = T | (() => T) | { default?: T | (() => T); applyDefaultToNull?: boolean; description?: string; deprecated?: boolean | string; metadata?: Record<string, any> }
- Meaning: `.v()`'s third argument. The default applies when the value is undefined, and when `applyDefaultToNull !== false` also when it is null. A function is called. It applies before validation in both validate() and parse(). Both the bare-value shorthand and the options object are accepted, told apart by normalizeFieldConfig.

#### Plugin categories
- Source: `src/core/builder/plugins/plugin-types.ts:47-58, 355-483`
- Shape: type PluginCategory = "standard" | "conditional" | "transform" | "fieldReference" | "multiFieldReference" | "arrayElement" | "composable" | "composable-conditional" | "composable-directly" | "context" | "builder-extension"
- Meaning: the category decides the chain method's type signature — conditional gives `(condition, options?)`, fieldReference `(fieldPath, options?)`, multiFieldReference `(fields, validate, options?)`, and transform `<TOutput>(fn)` replacing the current type — and at the same time decides the run-time routing, into the transform array or the validator array.

### optional (3)

#### The forbidden-output guard on transform
- Source: `src/core/plugin/transform-type-restrictions.ts`
- Shape: IsForbiddenTransformOutput<T> / ForbiddenTransformError<T> / ValidateTransformOutput<T> / SafeTransformFunction<TInput,TOutput> / RestrictedTransformFunction<TInput,TOutput> / CheckTransformFunction<F>
- Meaning: when a transform's output is `Array<plain object>` or `Array<union containing a plain object>`, the argument type is replaced by an error string literal type instead of a function, making it a compile error. `Date[]`, `RegExp[]`, arrays of functions, arrays of arrays and primitive arrays are permitted. The constraint follows from how nested array support is implemented.

#### Severity / SEVERITY
- Source: `src/core/plugin/types.ts:15-21`
- Shape: const SEVERITY = { INFO: "INFO", WARN: "WARN", ERROR: "ERROR" } as const; type Severity = "INFO" | "WARN" | "ERROR"
- Meaning: a validation's severity. It is published as a type, and no branch at run time uses it.

#### sanitize / createReplace / createReplaceAll / createDefaultValue
- Source: `src/core/transform/string/{sanitize,replace,defaultValue}.ts`
- Shape: sanitize(value: string): string; createReplace(searchValue: string | RegExp, replaceValue: string): (value: string) => string; createReplaceAll(searchValue: string, replaceValue: string): (value: string) => string; createDefaultValue(defaultValue: string): (value: string | null | undefined) => string
- Meaning: generators for reusable string transforms to hand to `transform`. `sanitize` replaces `& < > " ' /` with HTML entities. `createReplaceAll` has a special rule for an empty search string, inserting at each character boundary. Imported from nowhere in src and unpublished: a dead module.

## Behavioural rules

- Define ONE execution order and use it on every path. The settled meaning is: apply the default, short-circuit on null/undefined, run every validator in registration order, and only in parse mode compose every transform in registration order. validate() returns the original type without transforming; only parse() returns the transformed type.
- validate() returns TObject and parse() returns ApplyFieldTransforms<TObject, TMap>. That pairing is a published contract and stays.
- A transform replaces the chain's current type at the type level, so the input type of every later chain method is the transformed one. Chained transforms compose at the type level too.
- Settle on one treatment of an exception thrown by a transform function. The main route propagates it while the registry fallback converts it into a TRANSFORM_ERROR — a contradiction.
- The default when allValues is unavailable currently differs per plugin: compareField and stitch fail while orFail, requiredIf, optionalIf and validateIf pass. Guarantee, in both the types and the execution, that allValues is always present, and delete the branch.
- The "skip the rest" meaning of the conditionals (validateIf, skip) depends on position in the chain. Either keep the position dependence and force the head position in the types, or make it position-independent — but decide explicitly.
- Do not create an extension point the engine never calls, as optionalIf's `shouldSkipValidation` is. `ValidatorFormat`'s `__isDefault`, `__isPreprocess`, `__isCoerce`, `__isStitch` and `__stitchOptions` are the same kind of unused marker.
- If an ArrayContext (index, item, array) is passed to a condition, the engine must actually propagate it. Do not declare one and leave it always undefined.
- Resolve error messages in one function. The precedence — the message a plugin returns, then messageFactory, then the plugin's default — is already shared by stitch, custom and orFail, so make it the rule for every plugin.
- The context type handed to messageFactory must be extensible per plugin while always containing `MessageContext { path, value, code }`. Express it with generics, without `any`.
- Honour `options.code` and `options.messageFactory` consistently in every plugin. optionalIf, skip and validateIf currently ignore them.
- Do not re-run a user's validation function to build an error message. stitch and custom currently call it twice, which breaks for a function with side effects.
- Do not hold mutable state on a plugin instance. custom keeps `dynamicMessage` in a closure variable, so using one validator over several values leaks the previous message.
- Do not let several implementations share one methodName. stitch has three and fromContext two.
- Derive the published exports — the main entry, the category index and package.json's exports subpaths — from one definition rather than duplicating them by hand. The three currently disagree, leaving stitch, orFail and fromContext reachable from nowhere.
- Derive the documented allowed types and the `allowedTypes` constant from one source. They currently disagree for compareField.
- stitch must keep taking its fields as a const tuple and recovering each path's real type through FieldsToObject. That type safety is stitch's reason to exist.
- Resolve compareField's and stitch's path types (`NestedKeyOf<TObject>`) and value types (`TypeOfPath<TObject, P>`) without a non-null assertion, an `as any` or an `any`. The current code casts `plugin()`'s impl with `as any` to get the generics through, and as a result compareField's `compareFn` option and orFail's `message` option have disappeared from the chain type.

## Not carried forward

- **stitchSimple.ts (stitchSimplePlugin) and stitch-typed.ts (stitchPluginTyped / createStitchValidator)** — a third and second implementation carrying stitch.ts's `methodName: "stitch"`. Neither is exported from an index and neither is used, and their API shapes differ, one positional and one taking an options object. Choose one and discard the rest.
- **fromContextPlugin and conditionalRequiredCheck in src/core/async.experimental/from-context-plugin.ts** — a duplicate of the one in `src/core/plugin/fromContext.ts`, written in an older form (createMethod / validationFunction) that is incompatible with the plugin system.
- **fromContext.ts's helpers**: emailDuplicationCheck, passwordConfirmation, inventoryCheck, conditionalRequired, createTypedContextValidator and ContextValidationTemplates (emailDuplication, passwordConfirmation, inventoryCheck, userPermission, accountLimits, geoRestriction) — referenced from nowhere and exported from nowhere; sample code standing in for documentation. A validation library should not carry the vocabulary of a business domain — stock levels, geographic restrictions, account limits. `createTypedContextValidator` is an identity function returning its argument.
- **All of src/core/transform/** (index.ts, string/index.ts, sanitize.ts, replace.ts, defaultValue.ts) — a dead module imported from nowhere in src, whose existence only the tests confirm. Its `export * as string from "./string"` namespace re-export also defeats tree-shaking. If needed, rebuild it as individual preset transform plugins.
- **resolveMessage in src/core/plugin/message-factories.ts** — the file its opening comment refers to does not exist and nothing imports it. Its body also branches on a messageFactory that is not a function and returns it as a string, which the type makes unreachable.
- **types.ts's flag types and guards**: SkipAllValidationFlag, SkipFurtherValidationFlag, TransformFlag, NullableFlag, RecursiveFlag, ValidationResultWithFlags, WithFlags, ValidationFlags — at run time the work is done by a `shouldSkipAllValidation` method, an `__isTransform` property and `skipForNull`/`skipForUndefined` booleans, and these guards are never called. The residue of a specification that split in two.
- **ValidatorFormat's unused markers**: `__isDefault`, `__isPreprocess`, `__isCoerce`, `__isStitch`, `__stitchOptions` — field-context.ts's extractTransformFunction branches on them and no plugin corresponds to any. A hole opened for a future that never came.
- **conditionalSchema.ts's built-in evaluateSchema** — far too incomplete as a JSON Schema evaluator, looking only at `type`, `const` and `enum` inside `properties`, and `const` and `enum` at the top. JSON Schema evaluation belongs to the single evaluator on the JSON Schema side, and conditionalSchema should carry only the if/then/else control structure.
- **custom.ts's dynamicMessage closure variable** — a mutable variable allocated when the plugin instance is created, written by `check()` and read by `getErrorMessage()`. Using one validator over several values leaves the previous value's message behind. It is a workaround for `ValidatorFormat`'s `check` being able to return only a boolean.
- **stitch's, custom's and conditionalSchema's getErrorMessage re-running the validation function** — a user's function is called twice so that an error message can be built, which breaks for anything with side effects or a cost. Return the verdict and the message from one call.
- **ValidationOptions' fieldName and severity** — exposed in every plugin's options as types and read nowhere at run time. severity even has a SEVERITY constant and a Severity type behind it, and not one branch. Implement them or delete them.
- **validateIf's getErrorMessage throwing** — it asserts "this should never be called" with an exception. `computeErrorMessage` swallows it so there is no harm done, but an invariant that belongs in the types is being expressed as a run-time exception. A plugin that produces no error should have a type with no getErrorMessage.
- **The skip plugin** — validateIf with the polarity inverted and nothing else, ignoring its options entirely. Fold it into validateIf, or make it a thin alias that only inverts the condition.
- **Passing stitch's validate function through `impl: stitchImpl as any`** — cast with `as any` to get the generics through, with the type signature then re-declared by hand on the chain-mapping side from the category name. The implementation's type and the published type end up maintained separately, which is how options that exist in the implementation vanish from the chain type — compareField's `compareFn`, orFail's `message`.
- **The parse fallback in src/core/registry/plugin-registry.ts**, applying transforms before validating — the opposite order from the main route. The `_executionPlan` it checks for was removed for bundle size and never exists, so this contradictory route always runs.
- **The unified validator's four execution paths** (createUltraFastValidator, createOptimizedTransformValidator, executeFastSeparated, executeDefinitionOrder) **and the branching on validator and transform counts** — the same meaning written four times, and despite its name "definition order" does not interleave transforms in declaration order; it runs every validator and then every transform. The residue of an optimisation whose name and substance came apart. Collapse the meaning into one implementation.
- **Two tests**: one asserts the opposite of the implementation — transform first, validate() returning transformed data — and the other calls `.isValid()` on a `{valid: boolean}`, which does not type-check. Neither may be taken as evidence of the specification.

## Published symbols (111)

`compareFieldPlugin`, `stitchPlugin`, `stitchSimplePlugin`, `stitchPluginTyped`, `createStitchValidator`, `orFailPlugin`, `customPlugin`, `transformPlugin`, `fromContextPlugin`, `conditionalSchemaPlugin`, `requiredIfPlugin`, `optionalIfPlugin`, `validateIfPlugin`, `skipPlugin`, `compareField`, `stitch`, `orFail`, `custom`, `transform`, `fromContext`, `conditionalSchema`, `requiredIf`, `optionalIf`, `validateIf`, `skip`, `ConditionalSchemaOptions`, `ContextValidationOptions`, `TypeSafeStitchOptions`, `StitchValidationFn`, `FieldsToObject`, `TupleFieldsToObject`, `MessageFactory`, `MessageContext`, `ValidationOptions`, `SEVERITY`, `Severity`, `ValidationContext`, `RecursiveContext`, `ArrayContext`, `ValidationFunctionReturnType`, `ValidationResult`, `TransformFunctionReturnType`, `ValidationFunction`, `TransformFunction`, `ExtractTypes`, `SkipAllValidationFlag`, `SkipFurtherValidationFlag`, `TransformFlag`, `NullableFlag`, `RecursiveFlag`, `ValidationResultWithFlags`, `WithFlags`, `ValidationFlags`, `ConditionalMethod`, `WithConditionalMethods`, `ValidateIfMethods`, `IsForbiddenTransformOutput`, `ForbiddenTransformError`, `ValidateTransformOutput`, `SafeTransformFunction`, `RestrictedTransformFunction`, `CheckTransformFunction`, `resolveMessage`, `emailDuplicationCheck`, `passwordConfirmation`, `inventoryCheck`, `conditionalRequired`, `createTypedContextValidator`, `ContextValidationTemplates`, `conditionalRequiredCheck`, `sanitize`, `createReplace`, `createReplaceAll`, `createDefaultValue`, `TransformAwareValidator`, `ApplyFieldTransforms`, `ApplyNestedTransforms`, `AddFieldTransform`, `ExtractFieldType`, `TransformParseResult`, `PluginCategory`, `PluginType`, `ValidatorFormat`, `TransformPluginImplementation`, `PredefinedTransformImplementation`, `ConfigurableTransformImplementation`, `GenericTransformImplementation`, `TransformValidationMethod`, `TransformResult`, `ConditionalValidationMethod`, `FieldReferenceValidationMethod`, `MultiFieldReferenceValidationMethod`, `ContextPluginImplementation`, `FieldOptions`, `FieldConfig`, `DefaultValue`, `normalizeFieldConfig`, `applyDefault`, `createAccessor`, `createFieldAccessor`, `createBatchAccessors`, `getCachedAccessor`, `VALID_RESULT`, `INVALID_RESULT`, `ERROR_SEVERITY`, `ErrorCodes`, `ErrorCode`, `plugin`, `pluginPredefinedTransform`, `pluginConfigurableTransform`, `pluginBuilderExtension`
