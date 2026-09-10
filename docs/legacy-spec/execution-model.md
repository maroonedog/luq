# execution-model

## The whole picture, from measurement

`build()` calls
`createValidatorFactory(plugins).buildOptimizedValidator(processedDefinitions)`
(field-builder.ts 190-227) and returns a
`TransformAwareValidator<T, TTransformed>` — `{ validate, parse, pick, validateRaw?, parseRaw? }`.

### What `build()` genuinely precomputes, and is worth keeping

1. **The list of validator records per field.** The builder function is run once
   through `createFieldContext(path, plugins)`, fixing `_validators` and
   `_transforms` as arrays (unified-validator.ts 66-77). At validation time
   those arrays are simply walked.
2. **Path accessors compiled in advance.** `createNestedValueAccessor(path)` and
   `createAccessor` expand depths 0 to 5 into a dedicated closure
   (`obj?.[k1]?.[k2]?.[k3]`) and loop beyond that. **No `new Function`** — this
   is CSP-safe. Setters are generated the same way.
3. **An existence checker compiled in advance**
   (`createFieldExistenceChecker`, validator-factory.ts 994-1021), based on the
   `in` operator, so an explicit undefined is distinguished from absence.
4. **Error codes and message functions prefetched**:
   `errorCodes[i] = validator.code || validator.pluginName || "VALIDATION_ERROR"`
   into an array.
5. **The array batch hierarchy.** `buildNestedArrayHierarchy` builds, from paths
   like `items[*].name`, a tree of array path → its element fields → child
   arrays, with an accessor generated in advance per element field.

### What happens at validation time

`validate(value, options)`:

- `value == null` returns immediately with
  `[{path:"", code:"REQUIRED", message:"Value is required"}]`
- with a field options map (from `.default()` and the like), **the input is
  shallow-copied and the defaults applied** before validating
- step 1: the array batches, expanding elements by index
- step 2: the fast field group
- step 3: the slow field group, including the existence check and the implicit
  REQUIRED
- errors give `Result.error(errors)`, and none gives `Result.ok(value)`,
  **returning the original object as it is**

`parse(value, options)` follows the same order but writes transform results back
into `transformedData = { ...obj }` — **one shallow copy** — with
`setNestedValue`. Nested objects and array elements are shared references, so
**it mutates the input's inner structure**: the array batch optimiser does
`{...element}` per element, and the nested array processor passes a
non-object element straight through.

### Two levels of abort — this is the essential semantics

**There are two, and both default to true.**

- `abortEarly`, at the object level: `options?.abortEarly !== false`. It returns
  `Result.error` at the first field to produce an error and validates no
  further field.
- `abortEarlyOnEachField`, at the field level:
  `options?.abortEarlyOnEachField !== false`. Among several validators on one
  field (`.required().min(3).pattern(...)`) it stops at the first failure. With
  false it collects every violation on that field.

An integration test pins the combination
`{abortEarly: false, abortEarlyOnEachField: true}` — one error per field across
every field — as the arrangement a form wants. That is the core specification
to carry forward.

**One exception**: validating array elements **hard-codes**
`effectiveAbortEarlyOnEachField = false` (array-batch-optimizer.ts 235,
nested-array-processor.ts 393). Every field of an element is always validated;
between elements, `abortEarly` still applies.

### Ordering is not currently guaranteed

Errors come out in the order array batches, then fast fields, then slow fields —
not in `.v()` declaration order. Which group a field lands in depends on a
`Map`'s insertion order. The new implementation should guarantee declaration
order explicitly.

### How many strategies there are, and what switches between them

The `ValidationStrategy` enum (strategy-factory.ts 16-21) has **four values**:
`FAST_SEPARATED`, `DEFINITION_ORDER`, `ARRAY_BATCH`, `HOISTED_OPTIMIZED`.

**At most two do anything, and not per field — one for the whole schema.**
execution-strategy-selector.ts 33-37 carries a
`// TODO: Support per-field strategy analysis`, and `analyzeFields()` hands its
**single** `StrategyAnalysis` to every field. What it decides:

- any field containing an array element path → `ARRAY_BATCH`, so every field
  counts as slow
- any field containing a transform → `DEFINITION_ORDER`, so every field counts
  as slow
- otherwise → `FAST_SEPARATED`, so every field counts as fast

`HOISTED_OPTIMIZED` is generated from nowhere. The `IValidationStrategy`
implementations for `ARRAY_BATCH` and `DEFINITION_ORDER` —
`createArrayBatchStrategy`, `createMultiFieldStrategy`, `createStrategy`,
`createOptimalStrategy`, `createSingleFieldStrategy` — are **never called**; the
only imports from strategy-factory are `analyzeFields`, `StrategyAnalysis` and
`ValidationStrategy`.

And `buildUnifiedValidators` **always hard-codes**
`createUnifiedValidator(..., "fast_separated", accessor)` (validator-factory.ts
344-352). So the only effect the strategy analysis has is which map a field
goes into, fast or slow.

**And fast against slow is a difference in MEANING, not in speed** — the worst
trap here:

- the fast path does no existence check for a missing field; the plugins decide
- the slow path checks existence through `fieldExistenceCache` and
  **generates an implicit `REQUIRED` error when a field is missing, is not
  optional, and has no required plugin either** (validator-factory.ts
  1284-1295)

So for one schema, "adding one array or one transform drops every field into
slow and starts firing implicit REQUIRED errors". That cannot be maintained as
a specification. The new implementation must separate "does an implicit
REQUIRED happen" from any strategy and make it an explicit rule.

The transform detection inside `analyzeFields` also works by running a regular
expression `/\.(\w+)\(/g` over `builderFunction.toString()` to pull method names
out (strategy-factory.ts 530-541). It is not eval and does not break CSP, but
`.toString()` breaks under minification, transpilation and coverage
instrumentation. Discard it.

### The unified / ultra-fast / raw trio, as measured

| Module | Actually used? | What it is |
|---|---|---|
| `optimization/unified-validator.ts` | **yes, the only live route** | the per-field validator, branching three ways internally |
| `builder/raw-validator.ts` | **only through an environment variable** | reached only when `process.env.LUQ_ULTRA_FAST === "true"` or `global.__LUQ_ULTRA_FAST__ === true`, with no array batch and at most 50 validators (validator-factory.ts 462-471) |
| `builder/ultra-fast-validator.ts` | **entirely dead** | `createUltraFastSingleFieldValidator` and `createUltraFastMultiFieldValidator` are imported at validator-factory.ts 48-50 and **never called** |

The internal branching in `createUnifiedValidator` (79-105):

1. no skip plugin, no transform, at most 10 validators →
   `createUltraFastValidator`, specialised for one, two and N, returning the
   frozen singleton `ULTRA_FAST_VALID_RESULT` on success — **zero allocation**
2. no skip, with transforms, at most 10 validators and 5 transforms →
   `createOptimizedTransformValidator`, hand-expanded for one-validator and
   two-validator cases with one transform
3. otherwise → `executeFastSeparated`, validating then transforming in two
   phases, or `executeDefinitionOrder` when a skip plugin is present, in one
   loop in declaration order

`executeInDefinitionOrder = strategy === "definition_order" || hasSkipPlugins`,
and since the strategy is always `"fast_separated"`, **in practice only a field
using a skip-family plugin runs in definition order**.

### What actually produced the published throughput, and should be reproduced

1. **No object is created on the success path** — a frozen singleton
   `{valid:true, errors:[]}` comes back.
2. **An error message is computed only on failure** (`computeErrorMessage`).
3. **Accessors are baked into closures at build time**, so nothing calls
   `split(".")` at validation time.
4. **Functions are specialised by validator count** — one, two, N.
5. **`validate` skips the transform phase entirely**; only `parse` runs it.
6. **An array is read once and all its element fields validated together**,
   rather than walking the same array once per field.

### What the array batch optimisation actually made faster

The comment at the top of array-batch-optimizer.ts states the intent: handling
`customer.addresses.type`, `.name` and `.street` separately walks the array
three times. Batching folds it into "fetch the array once, then validate type,
name and street together per element". **That is a correct optimisation and
should be reproduced** — loop interchange, data-oriented.

The nested array processor turns an arbitrarily deep `a[*].b[*].c` into a
hierarchy and assembles **an error path carrying the real indices**, like
`items[0].tags[2]`. That is a specification to keep too.

**But the implementation kills its own optimisation**:
`createArrayBatchValidator(batchInfo, allValidators)` is called **inside**
`executeValidate` and `executeParse`'s loops (validator-factory.ts 1112, 1419,
1453), so the batch validator is **rebuilt on every validate()**. The design
intent of precomputing at build time is not honoured by the implementation, and
it is fair to call this one of the main reasons the complex shape measured so
much slower than the simple one.

### The measured cost of building

A builder function runs **at least six times per field**: once in `build()`,
whose result is thrown away into `rules`; once for the optional/required
decision in `fieldsWithBuilders`; and, across the three `buildUnifiedValidators`
calls (slow, fast, all), once in the body and once inside
`createUnifiedValidator` for each of the two that apply. Nothing caches the
result.

### A hole in the CSP guarantee

`src/types/array-type-analysis.ts:196` contains **`new Function(...)`**, a loop
generator for multi-dimensional arrays. validator-factory.ts:46 and
array-batch-optimizer.ts:20 use only the type `ArrayStructureInfo` from it, and
because they do not write `import type`, **the module ends up in the runtime
bundle**. The README's "CSP-safe: no eval or Function" can therefore be false
in the shipped bundle. Discard the file entirely and be strict about
`import type`.

### Shared mutable state, which breaks under re-entry

Several mutable singletons introduced in the name of speed. All of them go:

- ultra-fast-validator.ts 12-13: `SUCCESS_RESULT` and `ERROR_RESULT` reused at
  module scope
- unified-validator.ts 701: `const singleError = {path, code, message}` reused
  across validators
- unified-validator.ts 961-977: `validateError`, `parseError` and
  `parseSuccess` allocated once and overwritten each time —
  `parseSuccess.data = transform(value)` returns an object still holding the
  previous result
- validator-factory.ts 705: an `errors` array shared through a closure and
  reset with `errors.length = 0`, defended with `.slice()` but fragile

### Dead or broken code in this area

- `src/core/optimization/array-batch-validator.ts` (214 lines): **imported from
  nowhere**
- `src/core/optimization/core/validation-engine.ts` (763 lines) and
  `field-utils.ts`: referenced only from strategy-factory, whose relevant
  functions are never called — substantially all dead
- `src/core/builder/ultra-fast-validator.ts` (258 lines): all dead
- strategy-factory.ts's `IValidationStrategy`,
  `createFastSeparatedStrategy`, `createDefinitionOrderStrategy`,
  `createArrayBatchStrategy`, `createMultiFieldStrategy`, `createStrategy`,
  `createOptimalStrategy`, `createSingleFieldStrategy` and
  `createArrayBatchStrategyFromFields`: all dead
- validator-factory.ts's `validateArrayElementField`, `parseArrayElementField`
  and `hasOptionalValidator`: defined, referenced zero times
- array-batch-optimizer.ts's legacy path (209-363): it calls
  `result.isValid()`, and the unified validator's return value has no
  `isValid` method — reaching it **throws a TypeError**
- unified-validator.ts's static message precomputation (682-695):
  field-context.ts:409 always supplies a `(() => "Validation failed")` fallback
  for `messageFactory`, so `isDynamic` is **always true** and the optimisation
  never fires
- raw-validator.ts's `validate()` for two or more fields: it looks only at
  `validateRaw`'s boolean and returns
  `{path:"", code:"VALIDATION_ERROR", message:"Validation failed"}`, **losing
  both the path and the cause**. The ultra-fast mode is not semantically
  equivalent.

### Inconsistent error paths, to be settled

One `items[*].name` reports a different path depending on the route taken:

- the array batch route (nested-array-processor) gives `items[0].name`, with the
  index, which is correct
- the non-batch route (validator-factory.ts, `validateArrayElementPath`:2016)
  uses `error.path || elementPath`, and the validator's own `error.path` is the
  pattern string `items[*].name`, which wins — so it **never becomes
  `items[0].name`**

## Contracts to preserve (25)

### must-preserve (17)

#### TransformAwareValidator<T, TTransformed>
- Source: `src/core/builder/plugins/plugin-types.ts:1133-1147`
- Shape: { validate(value: Partial<T> | unknown, options?: ValidationOptions): Result<T>; parse(value: Partial<T> | unknown, options?: ParseOptions): Result<TTransformed>; pick<K extends NestedKeyOf<T>>(key: K): FieldValidator<T, TypeOfPath<T, K>> }
- Meaning: what build() returns. validate puts the input into Result.ok as it is, applying no transform; parse returns a new object with the transforms applied; pick returns a sub-validator for one field.

#### ValidationOptions
- Source: `src/types/index.ts:41-53`
- Shape: { abortEarly?: boolean; abortEarlyOnEachField?: boolean; messageFactory?: MessageFactory; translate?: (key: string, params?: Record<string, unknown>) => string; context?: Record<string, unknown> }
- Meaning: abortEarly and abortEarlyOnEachField both default to true, decided as `options?.abortEarly !== false`, so undefined and true mean the same. messageFactory, translate and context exist in the type and are not read here — validator-factory reads only the abort options.

#### abortEarly, the object-level abort
- Source: `src/core/builder/validator-factory.ts:1060, 1102, 1176, 1291, 1316`
- Shape: abortEarly?: boolean, default true
- Meaning: when true, the first field to produce an error ends validation and Result.error is returned; when false, every field is validated and errors accumulate.

#### abortEarlyOnEachField, the field-level abort
- Source: `src/core/optimization/unified-validator.ts:118,141,571-591`
- Shape: abortEarlyOnEachField?: boolean, default true
- Meaning: when true, several validators chained on one field stop at the first failure, giving that field one error; when false, every violation on the field is collected. It is orthogonal to abortEarly, and `{abortEarly: false, abortEarlyOnEachField: true}` — one representative error per field across every field — is the form-facing combination, pinned by a test.

#### Result<T>
- Source: `src/types/result.ts:86-158, 234-340`
- Shape: { isValid(): boolean; readonly valid: boolean; isError(): boolean; unwrap(): T; unwrapOr(d: T): T; unwrapOrElse(fn): T; map<U>(fn): Result<U>; flatMap<U>(fn): Result<U>; tap(fn): Result<T>; tapError(fn): Result<T>; data(): T | undefined; readonly errors: ValidationError[]; toPlainObject(): { valid: boolean; data?: T; errors: ValidationError[] } }
- Meaning: what validate and parse return. On success errors is an empty array; on failure data() is undefined. unwrap() throws LuqValidationException on failure. Result.ok is prototype-based (`Object.create(successProto)`) to hold down allocation on the success path. `valid` is a backward-compatibility getter for isValid().

#### ValidationError
- Source: `src/types/index.ts:25-30`
- Shape: { path: string; message: string; code: string; paths(): string[] }
- Meaning: the published error shape. `paths()` is a function, not an array. The code falls back from the validator's `code` to its `pluginName` to "VALIDATION_ERROR". The path is a field path, and for an array element the correct form carries the index (`items[0].name`).

#### REQUIRED at the root
- Source: `src/core/builder/validator-factory.ts:1029-1038, 1336-1345`
- Shape: value == null → Result.error([{ path: "", code: "REQUIRED", message: "Value is required", paths: () => [""] }])
- Meaning: the fixed answer when null or undefined is handed to validate or parse. The path is the empty string.

#### validate applies no transform; only parse does
- Source: `src/constants.ts:10-12 / src/core/optimization/unified-validator.ts:594-603`
- Shape: VALIDATE_MODE = "validate", PARSE_MODE = "parse"
- Meaning: validate runs only the validation phase, skips the transform phase, and puts the input object into Result.ok as it is. parse applies the transforms in order after validation succeeds and returns the rewritten object. That separation is the core of validate's speed.

#### The order within a field
- Source: `src/core/optimization/unified-validator.ts:107-110, 218-338, 514-655`
- Shape: run the validators in declaration order, then (in parse only) the transforms in declaration order
- Meaning: the default is two phases, all validators then all transforms. Only a field containing a skip-family plugin — one carrying shouldSkipAllValidation — runs its validators and transforms as one pipeline in declaration order.

#### The skip semantics (shouldSkipAllValidation)
- Source: `src/core/optimization/unified-validator.ts:260-268, 556-565 / src/core/plugin/skip.ts:80 / src/core/plugin/validateIf.ts:123`
- Shape: validator.shouldSkipAllValidation?(value, rootData): boolean
- Meaning: returning true skips every later validator on that field and counts it as a success — a break. skipPlugin and validateIfPlugin produce it.

#### The skipForNull / skipForUndefined semantics
- Source: `src/core/optimization/unified-validator.ts:232-252, 529-550, 1186-1197 / src/core/plugin/nullable.ts:74 / src/core/plugin/optional.ts:76`
- Shape: validator.skipForNull?: true, validator.skipForUndefined?: true
- Meaning: when any one validator on a field carries the flag and the value is null (or undefined), the field skips both validation and transformation and counts as a success, and parse returns the original value without transforming it. nullablePlugin sets skipForNull; optionalPlugin and optionalIfPlugin set skipForUndefined.

#### The internal validator record
- Source: `src/core/builder/context/field-context.ts:395-450`
- Shape: { check: (value, rootData) => boolean; name: string; code: string; pluginName: string; getErrorMessage?: (value, path, rootData) => string; messageFactory: (issueContext) => string; inputType; outputType; metadata; shouldSkipAllValidation?; shouldSkipValidation?; shouldSkipFurtherValidation?; skipForNull?; skipForUndefined?; __isRecursive?; recursive?; params? }
- Meaning: the one contract between a plugin and the engine. `check` is a synchronous boolean predicate taking the root data second — and only two arguments are ever passed, the third `arrayContext` the validation engine assumed never reaching the live route. Messages prefer getErrorMessage, falling back to messageFactory, and if both throw, to `Validation failed for ${path}`.

#### Lazy message computation
- Source: `src/core/optimization/unified-validator.ts:881-906`
- Shape: computeErrorMessage(validator, value, path, rootData): string
- Meaning: a message is produced only when validation failed, never on the success path. An exception from getErrorMessage or messageFactory does not fail the validation; it falls back to the default wording.

#### Path accessors compiled at build time, CSP-safe
- Source: `src/core/plugin/utils/field-accessor-optimized.ts:26-80`
- Shape: createAccessor(pathSegments: readonly string[]): (obj: unknown) => unknown
- Meaning: depths 0 to 5 expand into a dedicated closure (`obj?.[k1]?.[k2]...`) and deeper ones loop, so nothing calls `split(".")` at validation time. Achieving that without new Function or eval is what being CSP-safe actually consists of. Setters likewise.

#### The array batch, loop interchange
- Source: `src/core/builder/array-batch-optimizer.ts:1-16, 270-360 / src/core/builder/nested-array-processor.ts:383-620`
- Shape: per array path, `{ elementFields: string[], accessors: Map<field, accessor>, childArrays }`, reading the array once and validating every element field per element
- Meaning: however many element fields there are, the array is walked once. It is not re-walked per field. This is the central intent behind the complex schema's performance.

#### Expanding an array element's error path to real indices
- Source: `src/core/builder/nested-array-processor.ts:410-412, 552`
- Shape: the pattern `items[*].name` becomes the real path `items[0].name`, and deeper nesting `a[0].b[2].c`
- Meaning: an error path must carry the real indices rather than the declared pattern, assembled at any depth by carrying the parent's index down.

#### Empty arrays
- Source: `src/core/builder/array-batch-optimizer.ts:262-266 / src/core/optimization/core/strategy-factory.ts:254-257`
- Shape: `arrayData.length === 0` skips element validation and runs only the array's own validators, such as minLength
- Meaning: an element-level required does not fire against an empty array. Validation of the array itself still runs.

### should-preserve (7)

#### ParseOptions
- Source: `src/types/index.ts:58-71`
- Shape: ValidationOptions & { transforms?: Record<string, (value: unknown) => unknown> }
- Meaning: for parse. The `transforms` field exists in the type and is read nowhere in the execution model — dead.

#### Array elements always force abortEarlyOnEachField to false
- Source: `src/core/builder/array-batch-optimizer.ts:235 / src/core/builder/nested-array-processor.ts:393`
- Shape: effectiveAbortEarlyOnEachField = false
- Meaning: validating an array element validates every field of that element regardless of what the caller passed. Aborting between elements still follows abortEarly.

#### Zero allocation on success
- Source: `src/core/optimization/unified-validator.ts:869-876`
- Shape: const ULTRA_FAST_VALID_RESULT = Object.freeze({ valid: true, errors: [] })
- Meaning: a field validating successfully returns a frozen singleton rather than allocating. It is the central technique behind the published throughput, and freezing it also stops a caller mutating it.

#### A failing array skips its element validation
- Source: `src/core/builder/validator-factory.ts:1091-1108`
- Shape: the array path's own validator failing continues past the element loop
- Meaning: when `items` is not an array or violates required, errors from `items[*].name` are not piled on top.

#### When a default is applied
- Source: `src/core/builder/validator-factory.ts:509-521, 1044-1057, 1352-1362`
- Shape: applyDefault(currentValue, fieldOptions, { allValues }) before validating
- Meaning: in both validate and parse, validation runs against a shallow copy with the field options' defaults applied. validate validates the copy while returning the ORIGINAL value in Result.ok, so a default does not reach validate's result; parse's result does carry it.

#### pick(key)
- Source: `src/core/builder/validator-factory.ts:2641-2760`
- Shape: pick<K extends NestedKeyOf<T>>(key: K): FieldValidator<T, TypeOfPath<T, K>>, returning { validate(value, allValues?, options?), parse(value, allValues?, options?) }
- Meaning: a sub-validator covering one field and the derived paths sharing its prefix (`key[*]...`, `key.*...`, `key....`). For a key with no definition it returns a validator that always succeeds. Note that it returns a plain `{ valid, value, errors }` rather than a Result — a different shape from validate and parse.

#### The recursion model of objectRecursively
- Source: `src/core/builder/validator-factory.ts:328-331, 2061-2115 / src/core/plugin/objectRecursively.ts:115`
- Shape: validator.__isRecursive === true, validator.recursive = { targetFieldPath: string | "__Self" | "__Element", maxDepth?: number }, maxDepth defaulting to 10
- Meaning: exceeding maxDepth stops as a success. Visited objects are tracked in a WeakSet, and a cycle stops as a success too. `__Self` reapplies the root's field validators to a nested object, `__Element` does the same to array elements. Fields do not abort early during recursion.

### optional (1)

#### An empty schema
- Source: `src/core/builder/validator-factory.ts:263-281`
- Shape: `fieldDefinitions.length === 0` gives `validate: () => Result.ok({})` and `parse: (v) => Result.ok(v)`
- Meaning: a builder declaring no field always succeeds. There is an asymmetry: validate ignores the input and returns an empty object, while parse returns the input as it is.

## Behavioural rules

- build() is a pure precomputation phase. The only objects that may be constructed at validation time are the error array and, for parse, the output object. Building at validation time — as the previous implementation did by calling createArrayBatchValidator inside validate()'s loop — is forbidden.
- Run each field's builder function exactly once during build(). The previous implementation ran it at least six times. Do not depend on a builder function's side effects, and do not assume repeated execution either.
- Speed at validation time rests on six things: return a frozen singleton on success so nothing is allocated; compute an error message only on failure; bake path accessors and setters into closures at build time so nothing splits a string at validation time; have validate skip the transform phase entirely; walk an array once and validate all its element fields together; and keep branching minimal until something fails.
- Hand-expanding functions by validator count — the previous one-validator and two-validator specialisations — should be introduced only where a measured benchmark shows a significant difference. The previous implementation multiplied the code several times over with no sign of the effect being measured. The default is one straightforward for loop.
- Keep abortEarly and abortEarlyOnEachField as two independent levels of abort, both defaulting to true. Write the decision as an explicit default (`const abortEarly = options?.abortEarly ?? true`) rather than as `!== false`.
- Inside an array element, ignore abortEarlyOnEachField and always validate every field. The asymmetry is deliberate and stays, but express it as a named constant or rule rather than hard-coding it.
- Errors must come out in `.v()` declaration order. The previous implementation's order followed internal data structures — array batches, then the fast map, then the slow map — and was never guaranteed. One ordered field list should be the single truth.
- A field's execution route (an internal fast/slow classification) must not change the meaning of validation. The previous implementation generated an implicit REQUIRED only on the slow path, so adding one array or one transform to a schema changed every field's behaviour. Only the plugins — required and optional — decide what a missing field means.
- Decide once, at design time, whether an implicit REQUIRED exists at all, and apply it uniformly. Decide whether a field is missing with an `in`-based existence check, distinguishing an explicit undefined from absence.
- An array element's error path must always carry the real index (`items[0].name`). A pattern string (`items[*].name`) must never escape as an error. The previous implementation emitted both, depending on the route.
- Never use eval or new Function. Read a module used only for its types with `import type`, so it stays out of the runtime bundle. The previous implementation shipped a new Function in the bundle.
- Do not create a mutable singleton result object at module or validator scope. Share a success result only as a frozen immutable value. The previous SUCCESS_RESULT, ERROR_RESULT, singleError and parseSuccess were overwritten after being returned — a design that cannot be re-entered.
- Decide explicitly whether parse leaves its input untouched. The previous implementation made only a shallow `{ ...obj }` copy, sharing nested objects and array elements with the input, so a transform rewrote the caller's data.
- Fix a validator's check as a synchronous pure predicate, `(value, rootData) => boolean`. Do not build on side effects, asynchrony or throwing — a throw is swallowed only on the message-producing side.
- Have one engine variant. Of the previous three — unified, raw and ultra-fast — one was dead and another was not semantically equivalent.
- Do not switch execution mode on an environment variable or a global. Behaviour then differs by environment, and the two modes were not equivalent.

## Not carried forward

- **All of src/core/builder/ultra-fast-validator.ts (258 lines)** — its two exports are imported at validator-factory.ts 48-50 and called nowhere in the repository. It also reuses module-scope SUCCESS_RESULT and ERROR_RESULT, so it cannot be re-entered. Entirely dead.
- **All of src/core/optimization/array-batch-validator.ts (214 lines)** — not one module in src imports it.
- **src/core/optimization/core/validation-engine.ts (763 lines) and field-utils.ts** — referenced only from strategy-factory.ts, whose relevant functions (createFastSeparatedStrategy and the rest) are never reached from the live route. `validateHoisted` and `reconstructErrors`, deferring message construction by returning only error indices, are a good idea whose implementation shows no sign of use — and the same effect is already achieved by computing messages only on failure.
- **The four values of the ValidationStrategy enum and the IValidationStrategy abstraction** — HOISTED_OPTIMIZED is generated from nowhere; the implementations for ARRAY_BATCH and DEFINITION_ORDER are constructed only through three functions that nothing calls. In practice it is one bit — which map a field goes into — and even that is decided once per schema rather than per field. The abstraction supports nothing.
- **Splitting fields into fast and slow maps through selectOptimalStrategies / groupByStrategy** — execution-strategy-selector.ts 33-37 carries its own TODO and hands every field the same analysis. The split's only real effect is a difference in MEANING, the implicit REQUIRED existing on the slow path alone, and not one in speed. It produces the unmaintainable bug where adding one array or transform changes every field's validation semantics.
- **Extracting plugin calls from `builderFunction.toString()` with a regular expression** (strategy-factory.ts 530-541) — source-string analysis breaks under minification, transpilation, coverage instrumentation and a bound closure. Whether a field has a transform is known exactly by running the builder function once and reading `_transforms.length`, which is what the unified validator already does. Two decision paths existed and one of them was wrong.
- **raw-validator.ts and the LUQ_ULTRA_FAST environment variable / global** — validation semantics changing with the environment, and not equivalently: with two or more fields, raw `validate()` looks only at `validateRaw`'s boolean and returns an information-free `{path:"", code:"VALIDATION_ERROR", message:"Validation failed"}` (raw-validator.ts 355-368, 456-467). Which field failed and why are both lost. A broken mode was shipped under the name of a fast one.
- **TransformAwareValidator's optional validateRaw? and parseRaw?** — mentioned in neither the README nor the documentation, and populated only in the ultra-fast mode, so in practice always undefined. There is no reason for them to appear in the type.
- **array-batch-optimizer.ts's legacy path (209-363)** — it calls `result.isValid()` at line 312, and the unified validator returns a plain `{ valid, errors }` with no such method, so reaching it throws a TypeError. It is unreachable on the current route, so it is dead as well as broken.
- **ArrayTypeAnalyzer's generateOptimizedValidator / createNestedLoopValidator / generateNestedLoopCode in src/types/array-type-analysis.ts** — `new Function` violates CSP and contradicts the README head-on. Nothing calls them, but validator-factory.ts:46 and array-batch-optimizer.ts:20 import the module with value syntax rather than `import type`, so it reaches the runtime bundle. A multi-dimensional array is fine as an ordinary recursive loop.
- **The one-validator and two-validator hand expansions in unified-validator.ts (706-786) and the 1v1t / 2v1t expansions in createOptimizedTransformValidator (953-1110)** — the same logic copied four to six times, which has already produced a bug fixed in only one copy: the skipForNull check exists on the parse side at 1114-1197 and not in the specialised paths. V8 optimises a simple for loop perfectly well. The code was multiplied fivefold with no measurement behind it.
- **The "static error message precomputation" at unified-validator.ts 682-695** — field-context.ts:409 always supplies a `(() => "Validation failed")` fallback for messageFactory, so `isDynamic[i]` is always true and the branch never takes the static side. An optimisation that does not run.
- **Mutable result objects at module or closure scope** (unified-validator.ts 701's singleError, 961-977's validateError / parseError / parseSuccess, ultra-fast-validator.ts 12-13's SUCCESS_RESULT / ERROR_RESULT, validator-factory.ts 705's shared errors array) — a returned object is overwritten by the next call, and `parseSuccess.data` comes back still holding the previous transform's result. It breaks when a caller keeps a result, when one validator is called inside another, and under concurrency. The correctness lost outweighs the allocation saved.
- **validator-factory.ts's validateArrayElementField, parseArrayElementField and hasOptionalValidator** — defined and referenced zero times. hasOptionalValidator also carries six lines of commented-out debug logging.
- **The "skip when the parent array is empty" loops at validator-factory.ts 1137-1154 and 1227-1244** — copied verbatim into both the fast and slow loops, and calling getNestedValue for every prefix of a field path, an O(depth) walk performed for every field on every validate(). A linear search on the hot path. The nesting structure of arrays is known at build time, so nothing needs to split a string and re-walk to the parent at validation time.
- **The three buildUnifiedValidators calls (slow, fast, all) and the patch at 230-240 that overwrites the fast and slow maps from allValidators afterwards** — three sets of the same validators, with the paths containing `[*]` swapped in later. One ordered map with one validator per field is enough. It triples build time and leaves it unclear which map is authoritative.
- **The "V8 optimization:" comments** — dozens across unified-validator.ts and validator-factory.ts, mostly ritual with nothing behind them ("for is faster than for...of", "taking a local is faster"), and some of them not optimisations at all (returning a frozen object and then mapping over `.errors`). They give the appearance of guaranteeing the implementation's correctness with no measurement behind them. Write no optimisation comment that a benchmark cannot demonstrate.
- **build() running `def.builderFunction(context)` once and storing the result in `FieldDefinition.rules` (field-builder.ts 202-222)** — the rules field is never read by validator-factory. A whole execution of the builder function is thrown away.

## Published symbols (49)

`Builder`, `.use()`, `.for<T>()`, `.v(path, builderFn)`, `.field()`, `.useField()`, `.strict()`, `.build()`, `TransformAwareValidator`, `validate(value, options?)`, `parse(value, options?)`, `pick(key)`, `ValidationOptions`, `ParseOptions`, `abortEarly`, `abortEarlyOnEachField`, `messageFactory`, `translate`, `context`, `transforms`, `Result`, `Result.ok`, `Result.error`, `Result<T>.isValid()`, `Result<T>.isError()`, `Result<T>.valid`, `Result<T>.errors`, `Result<T>.unwrap()`, `Result<T>.unwrapOr()`, `Result<T>.unwrapOrElse()`, `Result<T>.map()`, `Result<T>.flatMap()`, `Result<T>.tap()`, `Result<T>.tapError()`, `Result<T>.data()`, `Result<T>.toPlainObject()`, `ValidationError`, `ValidationError.path`, `ValidationError.code`, `ValidationError.message`, `ValidationError.paths()`, `LuqValidationException`, `REQUIRED`, `VALIDATION_ERROR`, `PARSE_ERROR`, `FieldValidator`, `NestedKeyOf`, `TypeOfPath`, `ApplyFieldTransforms`
