# result-and-errors

## 0. Scope and method

I read every assigned file in full plus the code that actually produces results at runtime: `src/types/result.ts`, `src/types/indexed-result.ts`, `src/types/valitator.ts`, `src/types/util.ts`, `src/types/stitch-types.ts`, `src/types/array-type-analysis.ts`, `src/core/global-config.ts`, `src/types/index.ts`, `src/core/builder/plugins/plugin-types.ts`, `src/core/builder/validator-factory.ts`, `src/core/builder/raw-validator.ts`, `src/core/optimization/unified-validator.ts`, `src/core/optimization/core/validation-engine.ts`, `src/core/plugin/jsonSchema/types.ts`, `src/core/plugin/jsonSchema/error-generation.ts`, `src/core/plugin/shared-constants.ts`, `src/core/plugin/stringMin.ts`, `src/index.ts`. I also executed the built bundle (`dist/index.js`) to observe the *actual* runtime shape of `Result` rather than trusting the declared interface — that probe found two real defects (below).

---

## 1. What `build()` returns today

`build()` returns `TransformAwareValidator<T, TTransformed>` (`src/core/builder/plugins/plugin-types.ts:1133`):

```ts
interface TransformAwareValidator<T extends object, TTransformed = T> {
  validate(value: Partial<T> | unknown, options?: ValidationOptions): Result<T>;
  parse(value: Partial<T> | unknown, options?: ParseOptions): Result<TTransformed>;
  pick<K extends NestedKeyOf<T>>(key: K): FieldValidator<T, TypeOfPath<T, K>>;
  validateRaw?(value: T, options?: ValidationOptions): boolean;
  parseRaw?(value: T, options?: ParseOptions): { valid: boolean; data?: TTransformed; error?: any };
}
```

Four different return shapes are reachable from one built validator — this is the single biggest defect in the area:

| Method | Returns | Shape |
|---|---|---|
| `validate` | `Result<T>` | object with methods (`isValid()`, `unwrap()`, `data()`) + `valid`/`errors` |
| `parse` | `Result<TTransformed>` | same |
| `pick(k).validate` | `ValidationResult<V>` | **plain object** `{ valid, value, errors }` — no methods |
| `validateRaw` / `parseRaw` | `boolean` / `{valid, data?, error?}` | `error` is sometimes a string, sometimes a `ValidationError` |

### 1.1 `validate` vs `parse` semantics (verified in `validator-factory.ts:840-965`)

- `validate()` returns `Result.ok(value)` — **the original input reference, untransformed**. Field `default` values are computed into a local copy (`objWithDefaults`) and then **thrown away** (`return Result.ok(value)` at line 897, not `obj`). Transforms are not applied.
- `parse()` returns `Result.ok(transformedData)` — a shallow copy of the input with defaults applied and per-field transform outputs written back via `setNestedValue`.
- Both default to `abortEarly: true` and `abortEarlyOnEachField: true` (`options?.abortEarly !== false`). `abortEarly` stops at the first *field* that fails; `abortEarlyOnEachField` stops at the first *rule* within a field.
- Null/undefined input short-circuits to a single error `{ path: "", code: "REQUIRED", message: "Value is required" }` (`raw-validator.ts:96` says `"Value required"` — inconsistent wording across two implementations).

### 1.2 `Result<T>` — declared surface (`src/types/result.ts:86-158`)

`isValid(): boolean`, `isError(): boolean`, `valid` (readonly property), `errors` (readonly `ValidationError[]`), `data(): T | undefined`, `unwrap(): T`, `unwrapOr(d)`, `unwrapOrElse(fn)`, `map(fn)`, `flatMap(fn)`, `tap(fn)`, `tapError(fn)`, `toPlainObject(): { valid, data?, errors }`.

Static factory: `Result.ok(data)`, `Result.error(errors)`. Namespace `ResultUtils` with `all`, `any`, `partition`.

### 1.3 Runtime reality — two confirmed defects

I ran `node -e "const {Result}=require('./dist/index.js') …"`. Output:

```
ok.errors typeof: function   ok.data typeof: function   ok.valid: true   ok.value: {"a":1}
bad.errors typeof: object    isArray: true              bad.value: undefined   bad.valid: false
unwrap() threw → isError: false  name: LuqValidationException  errorsIsArray: true
```

1. **`errors` is a method on success and an array on failure.** `Result.ok` uses `Object.create(successProto)` where `successProto.errors()` is a *method* (`result.ts:210`); `Result.error` uses `createResult` where `errors` is a *getter* (`result.ts:337`). So `Result.ok(x).errors` is a function, not `[]`. `expect(result.errors).toHaveLength(0)` silently passes because `Function.length === 0`. The declared interface (`readonly errors: ValidationError[]`) is a lie on the success branch.
2. **`unwrap()` throws a non-`Error`.** `createLuqValidationException` returns a plain object literal (`result.ts:21-33`); `LuqValidationException` is `createLuqValidationException as any as { new(...) }` (line 36). `e instanceof Error` is `false`, there is no stack trace, and `LuqValidationException` is not even exported from `src/index.ts`. Any `catch (e) { if (e instanceof Error) … }` silently swallows validation failures.
3. `Result.ok` additionally exposes an undeclared `value` getter and an undeclared `onSuccessPostProcess` method; `Result.error` has neither. `validator-factory.ts:2765` actually reads `result.value` off a `Result`, which is `undefined` on the failure branch.

---

## 2. `ValidationIssue` — the full field set today

There is **no `ValidationIssue`**. There are **five** mutually incompatible error types:

| # | File | Shape |
|---|---|---|
| 1 | `src/types/index.ts:25` (canonical) | `{ path: string; message: string; code: string; paths(): string[] }` |
| 2 | `src/core/builder/types/types.ts:201` | `{ path; message; code }` |
| 3 | `src/core/optimization/core/validation-engine.ts:7` | `{ path; code; message }` |
| 4 | `src/core/optimization/unified-validator.ts:15` | `readonly { path; code; message }[]` |
| 5 | `src/core/plugin/jsonSchema/types.ts:71` | `{ path; message; code; value?: any; constraint?: any }` |

**Direct answer to "what about `expected` / `actual`?"** The core error carries **neither**. Only the JSON-Schema subsystem carries them, under the names `value` (= actual) and `constraint` (= expected). Plugins *compute* `min`/`max`/`actual`/`expected` and pass them to the `messageFactory` context (`stringMin.ts:80-93`, `numberMin.ts`, `arrayMaxLength.ts`, `objectMinProperties.ts`, …) but then **discard them** — only the rendered `message` string survives into the error. Eight test files contain commented-out assertions reading `// Context property is not available in current API` around `result.errors[0].context` (`arrayIncludes.test.ts:325`, `arrayMaxLength.test.ts:361`, `oneOf.test.ts:328`, `stringEndsWith.test.ts:280,294`, `stringEquals.test.ts:258`, `stringExactLength.test.ts:217`, `stringStartsWith.test.ts:260`). This was a wanted feature that was never delivered.

`paths()` always returns `[path]` — a single-element array. It is constructed in ~30 places and **never called anywhere** in `src/` or `test/`. Pure dead weight on the hot path.

### 2.1 `code` — the actual convention

`code` defaults to the **plugin name in camelCase**: `code = validator.code || validator.pluginName || "VALIDATION_ERROR"` (`validation-engine.ts:127`, `unified-validator.ts:1291`). Each plugin sets `const ERROR_CODE = "<pluginName>"` (`stringMin.ts:12` → `"stringMin"`; `required.ts:5` → `"required"`). Verified against passing test assertions: `"stringMin"`, `"numberMin"`, `"numberMax"`, `"arrayMinLength"`, `"booleanFalsy"`, `"required"`, `"optional"`, `"skip"`, `"literal"`, `"transform"`, `"stringStartsWith"`, `"stringEndsWith"`, `"stringAlphanumeric"`, `"unionGuard"`. Every plugin option bag accepts `{ code }` to override it.

Three competing dialects coexist:
- camelCase plugin names — the real one.
- `SCREAMING_SNAKE` for framework-level errors: `"REQUIRED"` (11 sites), `"VALIDATION_ERROR"`, `"TYPE_MISMATCH"`, `"STRICT_MODE"`, `"ACCESS_DENIED"`, `"FIELD_RULE_ERROR"`, `"FIELD_RULE_PARSE_ERROR"`, `"ASYNC_CONTEXT_ERROR"`, `"INVALID_ARRAY"`.
- A `snake_case` `ErrorCodes` table in `src/core/plugin/shared-constants.ts` (`min_value`, `max_value`, `min_length`, `max_length`, `exact_length`, `range`, `required`, `invalid_type`, `invalid_format`, `invalid_email`, `invalid_url`, `invalid_uuid`, `invalid_datetime`, `invalid_pattern`, `not_integer`, `not_finite`, `not_positive`, `not_negative`, `not_multiple`, `not_unique`, `missing_required`, `not_truthy`, `not_falsy`, `not_equal`, `validation_error`) — **imported by nothing**. Entirely dead.

JSON Schema emits its own complete SCREAMING_SNAKE set (all 29, from `error-generation.ts`): `TYPE_MISMATCH`, `ENUM`, `CONST`, `FORMAT`, `PATTERN`, `MIN_LENGTH`, `MAX_LENGTH`, `CONTENT_ENCODING`, `CONTENT_MEDIA_TYPE`, `MINIMUM`, `MAXIMUM`, `EXCLUSIVE_MINIMUM`, `EXCLUSIVE_MAXIMUM`, `MULTIPLE_OF`, `MIN_ITEMS`, `MAX_ITEMS`, `UNIQUE_ITEMS`, `CONTAINS`, `ADDITIONAL_ITEMS`, `REQUIRED`, `MIN_PROPERTIES`, `MAX_PROPERTIES`, `ADDITIONAL_PROPERTIES`, `PROPERTY_NAMES`, `ALL_OF`, `ANY_OF`, `ONE_OF`, `NOT`, `FALSE_SCHEMA`.

---

## 3. Path representation rules

### 3.1 Error paths (runtime, concrete)

- Object member separator: `.` → `user.profile.email`, `businessInfo.taxId`
- Array element: bracket with the **numeric index**, **no dot before the bracket** → `items[0]`, `items[2]`
- Multi-dimensional: adjacent brackets → `grid[0][1]`, `cube[0][1][2]`
- Element member: bracket then dot → `data[1].nested.inner`, `items[0].name`
- Root-level failure (input is null/undefined): `path === ""`

Construction sites: `array-batch-optimizer.ts:294`, `nested-array-processor.ts:411`, `validator-factory.ts:1614,1694,1966,2014,2305,2335,2498,2581`, `strategy-factory.ts:270,335`, `tupleBuilder.ts:179,327,353`. JSON Schema uses `path ? \`${path}[${index}]\` : \`[${index}]\`` (`error-generation.ts:472`) — same dialect, but falls back to a bare `[0]` / `items[0]` when path is empty, which is inconsistent.

**Exception:** the JSON-Schema internal helper `getSpecificValidationErrors` uses **JSON Pointer** paths (`/deeply/nested/field`, verified at `jsonschema-uncovered.test.ts:212`). Two path dialects exist in one library.

### 3.2 Declaration paths (`.v(path, …)`, compile-time)

`NestedKeyOf<T>` (`src/types/util.ts:44-68`) generates `[*]` as the array wildcard: `"items[*]"`, `"items[*].name"`, `"matrix[*][*]"`, `"cube[*][*][*]"`, `"users[*].profile.scores[*][*]"`. Depth-limited to 5 levels; array *methods* are filtered out via `ExcludeArrayMethods`.

`TypeOfPath<T, Path>` (`util.ts:70-131`) additionally accepts a `.*` form (`"users.*.name"`), and it is used in 8+ tests and in `pick()`'s pattern matcher (`validator-factory.ts:2665`). So **two wildcard spellings are accepted for the same thing** — `[*]` is typed, `.*` is a legacy untyped alias.

---

## 4. `global-config.ts` — what it configures and where it takes effect

`GlobalConfig` has exactly 7 keys: `messageKeyPrefix?: string`, `toBooleanTruthyValues?: string[]` (default `["true","1","yes","on"]`), `numberFormat?: { decimalSeparator?: string; thousandSeparator?: string }` (default `"."` / `","`), `dateFormat?: string` (default `"YYYY-MM-DD"`), `trimStrings?: boolean` (default `false`), `caseSensitive?: boolean` (default `true`), `customTransforms?: Record<string, (value: any) => any>` (default `{}`).

API: `globalConfig` singleton with `setConfig` (shallow merge, with a hand-written deep merge for `numberFormat` only), `getConfig`, `reset`, plus 7 defensive-copy getters. Free functions `setGlobalConfig`, `getGlobalConfig`, `resetGlobalConfig`. All exported from `src/index.ts`.

**Where it takes effect: nowhere.** `grep -rn "messageKeyPrefix|toBooleanTruthyValues|trimStrings|caseSensitive|customTransforms" src/` outside `global-config.ts` returns **zero hits**. `grep -rn "globalConfig|getGlobalConfig" src/` outside that file returns only two re-export lines (`src/index.ts:73`, `src/core/index.ts:82`). The only consumer is `test/unit/core/global-config.test.ts`, which tests the store against itself. This is a 98-line module-level mutable singleton that configures nothing, and it also breaks tree-shaking (module-level `let currentConfig` with a mutating export).

---

## 5. What `indexed-result.ts` was for

Deferred / lazy error materialization on the hot path. Instead of allocating `ValidationError` objects during validation, it stores `IndexedValidState<T> = { errorIndex: number /* -1 = valid */, data?: T, errorContext?: ErrorContext }` where `ErrorContext = { path, value, validators?, errorGenerator?(index, ctx) }`. The `errors` getter (line 125) calls `generateErrors()`, which memoizes into `cachedErrors` and either invokes `errorContext.errorGenerator` or synthesizes a fallback `{ path, code: \`VALIDATION_ERROR_${index}\`, message: \`Validation failed at validator ${index}\` }`. Intent: a caller doing `if (!result.isValid()) throw` never pays for message formatting.

**It was never wired in.** `grep -rn "indexed-result|IndexedResult" src/ test/` matches only inside `src/types/indexed-result.ts` itself. It also carries its own defects: `unwrap()` throws a plain `Error` (not `LuqValidationException`), `data !== undefined` is used as the validity test so a legitimately `undefined` payload is treated as an error, `IndexedResult.error([])` returns `ok(undefined)`, and it can only ever hold **one** error (`errorIndex` is a scalar), so it cannot represent `abortEarly: false`.

**The idea is worth keeping; this code is not.** The right form in the new implementation is a lazy `message` (a thunk or a `{ code, params }` pair rendered on demand), not a lazy whole-error indexed by validator position.

---

## 6. `valitator.ts` — misspelling and correct name

Content (27 lines, three interfaces):

```ts
export interface Validator<TObject, TValue> {
  validate(value: TValue, options?: ValidationOptions): ValidationResult<TValue>;
}
export interface FieldValidator<TObject, TValue, TRequiredKeys extends keyof TObject = never> {
  validate(value: unknown,
           allValues: TRequiredKeys extends never ? TObject | undefined : TObject,
           options?: ValidationOptions): ValidationResult<TValue>;
}
export interface ValidatorStrategy<TObject, TValue> {
  validate(value: unknown, options?: ValidationOptions): ValidationResult<TValue>;
}
```

It is a file of **validator call-signature contracts**. Its only importer in the whole repo is `src/types/util.ts:1`, for `InferType`.

**Proposed name: `src/types/validator-contract.ts`** (kebab-case, noun phrase, no `I` prefix, says what it holds — contracts, not an implementation). Plain `validator.ts` is the acceptable alternative, but it invites confusion with the concrete builder-produced validator; `validator-contract.ts` is unambiguous. Do **not** name it `validator-types.ts` or `validator-utils.ts`.

Defects to fix while renaming:
- `TObject` is a phantom parameter in both `Validator` and `ValidatorStrategy` — unused. Drop it.
- `ValidatorStrategy` is structurally identical to `Validator`. Delete one.
- `InferType<T extends Validator<any, any>> = T extends Validator<infer U, infer U> ? U : never` (`util.ts:3`) only resolves when `TObject === TValue`, so it is broken for every real validator — and `InferType` is imported by nothing anyway.
- This `FieldValidator<TObject, TValue, TRequiredKeys extends keyof TObject>` **collides by name** with a different `FieldValidator<TObject, TValue, TRequiredKeys = undefined>` in `src/core/builder/plugins/plugin-types.ts:139` (which also has an optional `parse`). `pick()` returns the *plugin-types* one. Only one may survive.

---

## 7. Recommended target shape for the new implementation

```ts
// One error type, one name, for every subsystem.
type ValidationIssue = {
  readonly path: string;          // "" for root; "a.b", "a[0]", "a[0].b", "g[0][1]"
  readonly code: string;          // plugin name, camelCase; overridable per call
  readonly message: string;
  readonly expected?: unknown;    // the constraint (min, max, pattern source, enum, schema keyword value)
  readonly actual?: unknown;      // the observed value or derived measure (length, count)
};

type ValidationResult<T> =
  | { readonly valid: true;  readonly data: T;   readonly issues: readonly [] }
  | { readonly valid: false; readonly data?: undefined; readonly issues: readonly [ValidationIssue, ...ValidationIssue[]] };
```

A discriminated union on `valid` gives narrowing for free with zero prototype tricks, is JSON-serializable (so `toPlainObject()` disappears), is one hidden class per branch, and cannot exhibit the "method on success / array on failure" defect. `isValid()` / `unwrap()` / `map()` become optional free functions in a separately importable module so a user who only wants `if (!r.valid)` pays nothing.

---

## 8. Files in scope, verdict

| File | Verdict |
|---|---|
| `src/types/result.ts` (403 L) | Delete. Keep the *concept* of a discriminated result. |
| `src/types/indexed-result.ts` (189 L) | Delete — never imported. Keep the lazy-message idea only. |
| `src/types/valitator.ts` (27 L) | Rename to `validator-contract.ts`, keep one interface. |
| `src/types/util.ts` (132 L) | Keep `NestedKeyOf` / `TypeOfPath` / `ElementType` semantics; rewrite. Drop `InferType`. |
| `src/types/stitch-types.ts` (166 L) | Belongs to the plugin area, not here. Keep `FieldsToObject`/`TypeOfPath` semantics; drop `TupleFieldsToObject`, `ValidateFieldPaths`, `CreateStitchOptions`, `createStitchOptions` (all unimported), and the 40-line comment block. |
| `src/types/array-type-analysis.ts` (333 L) | **Delete.** Uses `new Function` (line 196) — the only CSP violation in `src/`. Only `ArrayStructureInfo` (a type) is used in production. |
| `src/core/global-config.ts` (98 L) | Delete or redesign — currently inert. |

## Contracts to preserve (24)

### must-preserve (13)

#### Result<T>.valid
- Source: `src/types/result.ts:95`
- Shape: readonly valid: boolean
- Meaning: True when validation succeeded. Property, not a method. The single most-used assertion surface: 2568 occurrences of `.valid` across test/.

#### Result<T>.isValid()
- Source: `src/types/result.ts:90`
- Shape: isValid(): boolean
- Meaning: Method form of `valid`. 864 occurrences in test/. Both spellings exist and both are used heavily; the new design must decide which is canonical (see openQuestions).

#### Result<T>.errors
- Source: `src/types/result.ts:148`
- Shape: readonly errors: ValidationError[]
- Meaning: The failure list. `result.errors[0].message` / `.code` / `.path` is the dominant consumer pattern (84 / 39 / 24 occurrences in test/). MUST be a plain array on BOTH branches — today it is a function on the success branch (verified at runtime).

#### ValidationError
- Source: `src/types/index.ts:25`
- Shape: { path: string; message: string; code: string; paths(): string[] }
- Meaning: Canonical error record. `path`, `message`, `code` are the only fields ever read by callers. `paths()` is constructed ~30 times and never invoked — drop it. The type is NOT currently exported from src/index.ts, which is a gap: users cannot annotate the errors they receive.

#### ValidationError.code default
- Source: `src/core/optimization/core/validation-engine.ts:127`
- Shape: code = validator.code ?? validator.pluginName ?? "VALIDATION_ERROR"
- Meaning: The error code defaults to the plugin's own name in camelCase — "stringMin", "numberMax", "required", "arrayMinLength", "literal", "transform", "skip", "optional", "stringStartsWith", "stringEndsWith", "booleanFalsy", "unionGuard", "stringAlphanumeric". Every plugin option bag accepts `{ code }` to override it. Users branch on these strings.

#### Error path grammar
- Source: `src/core/builder/validator-factory.ts:1614,1966,2014`
- Shape: "" | "a" | "a.b" | "a[0]" | "a[0].b" | "a[0][1]"
- Meaning: Dot separates object members; a bracketed decimal index attaches directly to the array field with no preceding dot; adjacent brackets for multi-dimensional arrays; a dot follows the closing bracket before a member name. Root-level failure uses the empty string. Verified against passing assertions: "items[0]", "items[2]", "grid[0][1]", "data[1].nested.inner", "user.profile.email".

#### Declaration wildcard path `[*]`
- Source: `src/types/util.ts:44`
- Shape: NestedKeyOf<T> emits `${K}[*]`, `${K}[*].${sub}`, `${K}[*][*]`
- Meaning: `.v("items[*].name", …)` declares a rule for every element. Compile-time only; error paths substitute the concrete index. Depth-limited to 5 levels and array prototype methods are excluded from the key union.

#### TransformAwareValidator.validate
- Source: `src/core/builder/plugins/plugin-types.ts:1134`
- Shape: validate(value: Partial<T> | unknown, options?: ValidationOptions): Result<T>
- Meaning: Validation only. Returns the ORIGINAL input reference on success — no transforms applied, and field `default` values are computed then discarded. Accepts `unknown`, so it is the entry point for untrusted data.

#### TransformAwareValidator.parse
- Source: `src/core/builder/plugins/plugin-types.ts:1135`
- Shape: parse(value: Partial<T> | unknown, options?: ParseOptions): Result<TTransformed>
- Meaning: Validate + transform. Returns a shallow copy with field defaults applied and each field's transform output written back. The result type reflects transforms via ApplyNestedTransforms. This validate/parse split is a core design idea and must survive.

#### ValidationOptions.abortEarly
- Source: `src/types/index.ts:44`
- Shape: abortEarly?: boolean
- Meaning: Defaults to TRUE (`options?.abortEarly !== false`). Stops after the first FIELD that produces an error. Set false to collect errors from all fields.

#### ValidationOptions.abortEarlyOnEachField
- Source: `src/types/index.ts:46`
- Shape: abortEarlyOnEachField?: boolean
- Meaning: Defaults to TRUE. Stops after the first RULE within a single field. Set false to collect every failing rule per field. Array batch processing overrides this to false internally.

#### MessageContext
- Source: `src/core/plugin/types.ts:35`
- Shape: { path: string; value: any; code: string }
- Meaning: Base context handed to every plugin's `messageFactory`. Plugins widen it with constraint data — `{ min, actual }` (stringMin, numberMin, arrayMinLength, objectMinProperties), `{ max, actual }` (stringMax, numberMax, arrayMaxLength, objectMaxProperties), `{ prefix }`, `{ suffix }`, `{ pattern }`. This widened context is exactly the `expected`/`actual` data that should be persisted onto the issue instead of only being rendered into a string.

#### Per-rule messageFactory override
- Source: `src/core/plugin/stringMin.ts:56`
- Shape: b.string.min(8, { messageFactory: (ctx) => string, code?: string })
- Meaning: Every standard plugin accepts an options bag whose `messageFactory` replaces the default message and whose `code` replaces the default code. Verified across arrayIncludes, arrayMaxLength, arrayMinLength, arrayUnique, booleanFalsy, booleanTruthy, compareField, custom, literal, numberFinite/Integer/Max/Min/MultipleOf/Negative/Positive/Range, object*, string*. Tests assert custom codes like "CUSTOM_MIN_LENGTH", "abc-123".

### should-preserve (8)

#### Root-null error
- Source: `src/core/builder/validator-factory.ts:498`
- Shape: { path: "", code: "REQUIRED", message: "Value is required" }
- Meaning: validate()/parse() called with null or undefined short-circuits to exactly this single error. Note raw-validator.ts:96 emits "Value required" instead — the wording must be unified.

#### Result<T>.data()
- Source: `src/types/result.ts:143`
- Shape: data(): T | undefined
- Meaning: Returns the payload on success, undefined on failure. 87 call sites use `.data()`; ~51 test sites use `.data` as a PROPERTY (which silently yields the function object). The method/property ambiguity must be resolved — a plain `data` field on the success branch is the clean answer.

#### Result<T>.unwrap()
- Source: `src/types/result.ts:107`
- Shape: unwrap(): T // throws on failure
- Meaning: Returns payload or throws. 29 call sites. Keep the method, but it MUST throw a real `Error` subclass carrying the issue array — today it throws a plain object literal with `name: "LuqValidationException"` for which `instanceof Error` is false (verified at runtime).

#### TransformAwareValidator.pick
- Source: `src/core/builder/plugins/plugin-types.ts:1138`
- Shape: pick<K extends NestedKeyOf<T>>(key: K): FieldValidator<T, TypeOfPath<T, K>>
- Meaning: Extracts a single-field validator from a built object validator, keeping the rules declared for that path plus all its array-element and nested descendants. Implemented by running the full validator against `{ [key]: value }` and filtering errors by path pattern. Useful for per-field UI validation; the concept is worth keeping, the implementation is not.

#### JSON Schema issue codes
- Source: `src/core/plugin/jsonSchema/error-generation.ts`
- Shape: SCREAMING_SNAKE keyword names
- Meaning: Complete set emitted by the JSON Schema subsystem: TYPE_MISMATCH, ENUM, CONST, FORMAT, PATTERN, MIN_LENGTH, MAX_LENGTH, CONTENT_ENCODING, CONTENT_MEDIA_TYPE, MINIMUM, MAXIMUM, EXCLUSIVE_MINIMUM, EXCLUSIVE_MAXIMUM, MULTIPLE_OF, MIN_ITEMS, MAX_ITEMS, UNIQUE_ITEMS, CONTAINS, ADDITIONAL_ITEMS, REQUIRED, MIN_PROPERTIES, MAX_PROPERTIES, ADDITIONAL_PROPERTIES, PROPERTY_NAMES, ALL_OF, ANY_OF, ONE_OF, NOT, FALSE_SCHEMA. These map 1:1 to Draft-07 keywords and should be kept verbatim.

#### JSON Schema error `value` / `constraint`
- Source: `src/core/plugin/jsonSchema/types.ts:71`
- Shape: { path; message; code; value?: any; constraint?: any }
- Meaning: The ONLY place in the library where an error carries structured data: `value` is the offending value (= actual), `constraint` is the schema keyword's value (= expected: schema.minLength, schema.maximum, schema.pattern, schema.enum, schema.const, schema.format, schema.type, schema.multipleOf, schema.minItems, schema.maxItems, schema.contains, schema.minProperties, schema.maxProperties, schema.propertyNames, schema.contentEncoding, schema.contentMediaType, schema.exclusiveMinimum, schema.exclusiveMaximum, requiredProp, schemas, true/false). This is the model to generalize to `expected`/`actual` on every issue.

#### Public export names in this area
- Source: `src/index.ts:38-77`
- Shape: Result, ValidationResult, ValidationOptions, MessageContext, SEVERITY, BasicValidationResult, TransformAwareValidator, GlobalConfig, globalConfig, setGlobalConfig, getGlobalConfig, resetGlobalConfig
- Meaning: The complete set of result/error/config symbols exported from src/index.ts today. `ValidationError` and `ParseOptions` are NOT exported — a real gap, since ValidationError is the type users touch most.

#### FieldsToObject / StitchValidationFn
- Source: `src/types/stitch-types.ts:18`
- Shape: FieldsToObject<T, K extends readonly (NestedKeyOf<T> & string)[]> = { [P in K[number]]: TypeOfPath<T, P> }
- Meaning: Maps a readonly tuple of field paths to a typed object of those fields' values, giving `stitch(...)` cross-field validators fully typed access to the fields they declared. Genuinely useful type-level idea; used by src/core/plugin/stitch-typed.ts and referenced from plugin-interfaces.ts and plugin-types.ts.

### optional (3)

#### ResultUtils.all / any / partition
- Source: `src/types/result.ts:347`
- Shape: all<T>(Result<T>[]): Result<T[]>; any<T>(Result<T>[]): Result<T>; partition<T>(Result<T>[]): { valid: T[]; invalid: ValidationError[][] }
- Meaning: Combinators over arrays of results: `all` short-circuits on the first failure, `any` returns the first success or the concatenation of all errors, `partition` splits. Imported by nothing in src/ or test/. Reasonable concepts, zero proven demand.

#### Result functional combinators
- Source: `src/types/result.ts:112-157`
- Shape: map, flatMap, tap, tapError, unwrapOr, unwrapOrElse, toPlainObject
- Meaning: Rust-style combinators. Only `tap`/`tapError` appear outside the definition, and only in test/demo/onSuccessPostProcess-usage-examples.ts (not a real test). `map`/`flatMap`/`unwrapOr`/`unwrapOrElse`/`toPlainObject` have zero consumers. Ship them, if at all, as tree-shakeable free functions in a separate module — not as methods every result object must carry.

#### validateRaw / parseRaw
- Source: `src/core/builder/plugins/plugin-types.ts:1141`
- Shape: validateRaw?(value: T, o?): boolean; parseRaw?(value: T, o?): { valid: boolean; data?: TTransformed; error?: any }
- Meaning: Optional fast paths that skip the Result wrapper. `validateRaw` answers boolean only. `parseRaw`'s `error` is `any` and is sometimes a bare string ("Value required", raw-validator.ts:66) and sometimes a ValidationError object. Optional on the interface, so callers must feature-detect. If a fast path is kept, it needs one honest signature.

## Behavioural rules

- A result MUST be a discriminated union on a single boolean tag, with identical property types on both branches. The current design — a prototype object whose `errors` is a method on success and an array on failure — is a verified runtime defect, not a style choice.
- `valid === true` implies zero issues; `valid === false` implies at least one issue. Never emit `{ valid: false, issues: [] }` and never `{ valid: true, issues: [something] }`.
- The payload is present only on the success branch. Do not model it as `data: never` on the failure branch (the current `InvalidResult` does this, which is why every implementation has to cast).
- `validate()` returns the input unchanged: no transforms, no defaults, no copying. `parse()` returns a new object with defaults applied and transforms run. Never mutate the caller's input in either.
- Fix the existing defect: field `default` values applied during `validate()` are currently discarded. Decide explicitly whether `validate()` applies defaults before checking rules (it should, otherwise `.default()` + `.required()` disagree between validate and parse) and make the behaviour identical in both.
- `abortEarly` defaults to true and stops at the first FAILING FIELD. `abortEarlyOnEachField` defaults to true and stops at the first FAILING RULE within a field. Both defaults must survive; changing them changes every caller's error count.
- Error `path` uses exactly one grammar: `""` for root, `.` between object members, `[n]` attached directly to the array field with a decimal index and no leading dot, adjacent `[i][j]` for nested arrays, and `].` before an element's member. No JSON Pointer anywhere in the public surface.
- Declaration paths use `[*]` as the array wildcard. Pick one spelling: keep `[*]` (it is what `NestedKeyOf` generates and what most call sites use) and drop the untyped `.*` alias entirely.
- `code` defaults to the plugin's own name in camelCase and is overridable per rule via the options bag. Choose ONE casing convention library-wide — the current mix of camelCase plugin codes, SCREAMING_SNAKE framework codes, and a dead snake_case `ErrorCodes` table is not defensible.
- Every issue that has a numeric or structural constraint MUST carry it as structured data (`expected`/`actual`), not only baked into the message string. The plugins already compute this data and throw it away; eight test files carry commented-out assertions asking for it.
- Messages must be replaceable without re-implementing validation: per-rule `messageFactory` receives `{ path, value, code }` plus the rule's own constraint fields.
- Anything that throws MUST throw a real `Error` subclass with a stack trace and the issue list attached, and that class MUST be publicly exported. `e instanceof Error` returning false for a library's own thrown value is a bug.
- Every type a caller can observe must be exported from the package entry point. `ValidationError` and `ParseOptions` are reachable at runtime but not exported today — that cannot repeat.
- One error type for the whole library. Five structurally different `ValidationError`/`ValidationResult` declarations across five files is how the current codebase ended up with `as any` at every boundary.
- Nothing in this area may use `new Function` or `eval`. `src/types/array-type-analysis.ts:196` currently does, breaking the CSP-safe guarantee.
- No module-level mutable singleton state. If a global configuration survives at all it must be passed explicitly or created per-builder, so that tree-shaking and multiple independent validators in one bundle both work.
- Result helper combinators (`map`, `unwrap`, `unwrapOr`, `all`, `partition`, …) ship as separately importable pure functions, not as methods bolted onto every result object — otherwise a user who only writes `if (!r.valid)` still pays for all of them.
- Result objects must be plain JSON-serializable data. `JSON.stringify(result)` should produce the whole result; a dedicated `toPlainObject()` should not be necessary.

## Not carried forward

- **`src/types/result.ts` prototype-based `successProto` (`Object.create(successProto)` for the ok branch, an object literal with getters for the error branch).** — Verified at runtime: `Result.ok(x).errors` is a FUNCTION while `Result.error(e).errors` is an array, directly contradicting the declared `readonly errors: ValidationError[]`. `expect(result.errors).toHaveLength(0)` passes only because `Function.length === 0`. `Result.ok` also exposes undeclared `value` and `onSuccessPostProcess` members that `Result.error` lacks — and `validator-factory.ts:2765` reads `result.value` off a Result, which is undefined on failure. The 'V8 hidden class' rationale in the comments produced two different hidden classes, achieving the opposite of its stated goal.
- **`LuqValidationException` and `createLuqValidationException` (`src/types/result.ts:11-38`), including the `createLuqValidationException as any as { new (...) }` cast.** — Returns a plain object literal, so `e instanceof Error` is false (verified) and there is no stack trace. The `as any as { new(...) }` cast fakes a constructor that does not exist. The symbol is not exported from `src/index.ts`, so a caller cannot even name the thing `unwrap()` throws. Replace with a real `class ValidationFailure extends Error`.
- **`ValidationError.paths(): string[]`.** — Constructed at ~30 sites across validator-factory, raw-validator, array-batch-optimizer, nested-array-processor, tupleBuilder and async modules, and invoked exactly zero times in `src/` or `test/`. It always returns `[this.path]`. It allocates a closure per error, makes the error non-serializable by `JSON.stringify`, and forces every error-copying loop to re-wrap `paths: () => [e.path]`.
- **`src/types/indexed-result.ts` in its entirety (189 lines).** — Imported by nothing. Beyond being dead: it can hold only one error (scalar `errorIndex`), so it cannot express `abortEarly: false`; it uses `data !== undefined` as the validity test, so a valid `undefined` payload reads as an error; `IndexedResult.error([])` returns `ok(undefined)`; and `unwrap()` throws a bare `Error` while the sibling implementation throws a `LuqValidationException`. Keep only the idea of deferring message formatting.
- **`src/types/array-type-analysis.ts` — `BuildTimeArrayAnalyzer.createNestedLoopValidator` / `generateNestedLoopCode`.** — Builds JavaScript source as a string and evaluates it with `new Function` (line 196). This is the ONLY `new Function`/`eval` in `src/` and it directly violates the CSP-safe requirement. Production code imports only the `ArrayStructureInfo` type from this module; the class itself is reached solely from three integration tests. The file also ships `Test_ArrayDepth` / `Test_ElementType` type-test declarations in shipped source.
- **`src/core/global-config.ts` as it stands (module-level `let currentConfig` singleton with 7 settings and 3 free mutators).** — Nothing reads it. A repo-wide grep for `messageKeyPrefix`, `toBooleanTruthyValues`, `trimStrings`, `caseSensitive`, `customTransforms` outside this file returns zero hits, and `globalConfig` itself appears only in two re-export lines. Its only consumer is a test that asserts the store against itself. It is 98 lines of publicly exported API that configures nothing, and its mutable module state defeats tree-shaking and makes two validators in one bundle share hidden state.
- **`ErrorCodes` / `ErrorCode` in `src/core/plugin/shared-constants.ts` (25 snake_case constants).** — Imported by nothing. Actual codes are the camelCase plugin names. Shipping a dead code table alongside a live, differently-cased convention guarantees the next contributor picks the wrong one.
- **`translate?: (key, params?) => string` on `ValidationOptions` and `ParseOptions` (`src/types/index.ts:50,66`).** — Declared twice, consumed nowhere — grep for `translate` in `src/` matches only those two declarations. It is a promise of i18n that the library does not keep.
- **Validate-time `messageFactory` and `context` on `ValidationOptions`.** — The object validator never reads `options.messageFactory` or `options.context`; every `options?.messageFactory` hit in `src/` is a plugin *call-site* option (`.min(3, { messageFactory })`), a different thing at a different layer. Two identically-named knobs at two layers where only one works.
- **Five parallel declarations of the validation error/result shape: `src/types/index.ts:25`, `src/core/builder/types/types.ts:201`, `src/core/optimization/core/validation-engine.ts:7`, `src/core/optimization/unified-validator.ts:15`, `src/core/plugin/jsonSchema/types.ts:71` — plus `ValidationResult<T>` duplicated verbatim in `src/types/index.ts:15` and `src/core/builder/plugins/plugin-types.ts:1153`.** — Each layer re-declares a near-identical type, so every layer boundary needs a re-map loop (`errors.map(e => ({ path: e.path, code: e.code, message: e.message, paths: () => [e.path] }))` appears in at least six places) or an `any` cast. This duplication is a direct cause of the `no-explicit-any` count.
- **Two incompatible `FieldValidator` interfaces: `src/types/valitator.ts:10` (3 generics, `TRequiredKeys extends keyof TObject = never`, no `parse`) and `src/core/builder/plugins/plugin-types.ts:139` (3 generics, `TRequiredKeys = undefined`, optional `parse`).** — Same name, different arity semantics, different method sets, both reachable. `pick()` returns the plugin-types one; `src/types/util.ts` imports the other transitively. Guaranteed to be imported wrongly.
- **`ValidatorStrategy` (`src/types/valitator.ts:22`) and the phantom `TObject` parameter on `Validator`.** — `ValidatorStrategy<TObject, TValue>` is structurally identical to `Validator<TObject, TValue>` modulo `value: unknown` vs `value: TValue`. `TObject` is unused in both. Two names for one contract, one of which carries a parameter that does nothing.
- **`InferType<T extends Validator<any, any>> = T extends Validator<infer U, infer U> ? U : never` (`src/types/util.ts:3`).** — Inferring the same `infer U` into both slots means it resolves only when `TObject === TValue`, which is true for no real validator. It also has zero importers. A broken helper nobody uses.
- **Accepting both `[*]` and `.*` as the array wildcard in declaration paths.** — `NestedKeyOf` only generates `[*]`, but `TypeOfPath` and `pick()`'s pattern matcher both accept `.*`, and 8+ tests use it. The `.*` form is therefore untyped — a typo in it fails silently at the type level. One spelling only.
- **The JSON-Pointer path dialect in `getSpecificValidationErrors` (`/deeply/nested/field`).** — A second, incompatible path grammar inside one library. A consumer writing `errors.find(e => e.path === 'a.b')` gets different answers depending on which subsystem produced the error.
- **`parseRaw`'s `error?: any` field and the `validateRaw`/`parseRaw` pair being optional (`?`) on `TransformAwareValidator`.** — `error` is a bare string in `raw-validator.ts:66` and a `ValidationError` object elsewhere, and it is singular where every other path is plural. Being optional forces every caller to feature-detect two methods that either always exist or never do.
- **Two different wordings for the same root-null failure: `"Value is required"` (validator-factory, 8 sites) and `"Value required"` (raw-validator.ts:96).** — Callers that string-match on messages get non-deterministic behaviour depending on which internal execution strategy the builder happened to select.
- **`Result.toPlainObject()`.** — It exists only because the result object is not plain data. Making the result a plain discriminated union removes the need for it entirely.
- **The unused type-level machinery in `src/types/stitch-types.ts`: `TupleFieldsToObject`, `ValidateFieldPaths`, `CreateStitchOptions`, `createStitchOptions`, and the 40-line usage-example comment block.** — None of the four are imported anywhere; only `FieldsToObject` and `TypeSafeStitchOptions` have consumers. `TupleFieldsToObject` is a strictly worse duplicate of `FieldsToObject`. Shipped examples belong in docs, not in a type module.
- **`ValidationResult<T>.originalValue?: T` (`src/types/index.ts:19`, `plugin-types.ts:1157`).** — Written by the internal optimization layer but never read back by any caller; it duplicates data the caller already holds and leaks an internal execution detail into a public type.

## Published symbols (61)

`Result`, `ValidationResult`, `ValidationError`, `ValidationOptions`, `ParseOptions`, `MessageContext`, `MessageFactory`, `SEVERITY`, `Severity`, `TransformAwareValidator`, `FieldValidator`, `Validator`, `ValidatorStrategy`, `FieldValidationResult`, `PluginValidationResult`, `BasicValidationResult`, `ValidResult`, `InvalidResult`, `ValidationState`, `ResultUtils`, `LuqValidationException`, `createLuqValidationException`, `IndexedResult`, `createIndexedResult`, `ErrorContext`, `IndexedValidState`, `ErrorCodes`, `ErrorCode`, `ERROR_SEVERITY`, `VALID_RESULT`, `INVALID_RESULT`, `GlobalConfig`, `globalConfig`, `setGlobalConfig`, `getGlobalConfig`, `resetGlobalConfig`, `NestedKeyOf`, `TypeOfPath`, `ElementType`, `InferType`, `UnionToIntersection`, `FieldsToObject`, `TupleFieldsToObject`, `StitchValidationFn`, `TypeSafeStitchOptions`, `ValidateFieldPaths`, `CreateStitchOptions`, `createStitchOptions`, `ArrayDepth`, `ArrayElementType`, `ArrayIndexPattern`, `ArrayStructureInfo`, `ResolveArrayStructure`, `BuildTimeArrayAnalyzer`, `createTypedArrayValidator`, `ValidationContext`, `RecursiveContext`, `ArrayContext`, `ValidationFunctionReturnType`, `UnifiedValidator`, `ParseResult`

