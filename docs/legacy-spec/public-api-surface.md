# public-api-surface

# public-api-surface specification, extracted from the implementation

Files read:
- C:\projects\luq\src\index.ts
- C:\projects\luq\src\core\index.ts
- C:\projects\luq\core-entry.ts
- C:\projects\luq\src\core\builder\core\builder.ts
- C:\projects\luq\src\core\builder\core\field-builder.ts
- C:\projects\luq\src\core\builder\types\types.ts
- C:\projects\luq\src\core\builder\plugins\plugin-types.ts
- C:\projects\luq\src\core\builder\plugins\plugin-interfaces.ts
- C:\projects\luq\src\core\builder\plugins\plugin-creator.ts
- C:\projects\luq\src\core\builder\types\field-options.ts
- C:\projects\luq\src\core\builder\context\field-context.ts
- C:\projects\luq\src\core\builder\validator-factory.ts
- C:\projects\luq\src\core\registry\plugin-registry.ts
- C:\projects\luq\src\types\util.ts / index.ts / result.ts
- C:\projects\luq\src\core\plugin\types.ts, global-config.ts, index.ts, and every plugin file
- C:\projects\luq\src\core\plugin\jsonSchema\{index.ts,plugin.ts}, jsonSchemaFullFeature.ts
- C:\projects\luq\package.json, exports-config.json, build.js, README.md

---

## 1. Exact chain signatures and how the type arguments flow

### 1.1 `Builder()`
The real thing is `createBuilder` at `builder.ts:111`:
```ts
function createBuilder<TInput = any>(): IChainableBuilder<TInput, {}, {}>
export const Builder = createBuilder;
```
Three type arguments (`types.ts:475`):
```ts
interface IChainableBuilder<TInput, TPlugins = {}, TAccumulatedExtensions extends object = {}>
  extends ChainableBuilder<TPlugins>
```
- `TInput` — a slot for passing the target type up front as `Builder<T>()`. **It is not actually used**: `for<TInputType>()` overwrites the target type, so `TInput` is only ever read by `CreateMethodWithBuilder` when generating builder-extension method types.
- `TPlugins` — a **map type** from plugin name to plugin type, accumulated by intersection on every `use()`.
- `TAccumulatedExtensions` — the methods that builder-extension plugins graft onto the Builder itself, accumulated.

### 1.2 `.use(plugin)` — how the type arguments flow
`IChainableBuilder.use` has **11 overloads** (types.ts:481-675), in these groups:
1. `TypedPlugin<TName, TMethodName, TMethod, TAllowedTypes, TPluginType, TCategory>` — 1
2. `ComposablePlugin<TName, TMethodName, TAllowedTypes>` — 1
3. `ComposableConditionalPlugin<...>` — 1
4. `ComposableDirectlyPlugin<...>` — 1
5. `BuilderExtensionPlugin<TName, TMethodName, TMethodSignature>` — 1
6. fixed-arity variadic versions for 2/3/4/5 plugins
7. the universally quantified `...plugins: T` (`T extends readonly AnyPlugin[]`)

The single-`TypedPlugin` return type is the canonical one:
```ts
use<TName extends string, TMethodName extends string, TMethod extends Function,
    TAllowedTypes extends readonly TypeName[] | undefined,
    TPluginType extends PluginType = PluginType,
    TCategory extends PluginCategory = PluginCategory>(
  plugin: TypedPlugin<TName, TMethodName, TMethod, TAllowedTypes, TPluginType, TCategory>
): IChainableBuilder<TInput, TPlugins & { [K in TName]: TypedPlugin<...> }, TAccumulatedExtensions>
   & TAccumulatedExtensions
   & TPlugins
   & { [K in TMethodName]: TMethod };
```
**The essence of the flow**: `use()` builds a one-entry record keyed by the plugin's `name` literal whose value is the plugin type itself, intersects it into `TPlugins`, and returns. That is all it does. `TPlugins` passes straight through to `.for<T>()` and is taken apart on the field side.

`AnyPlugin` (types.ts:396):
```ts
type AnyPlugin =
  | TypedPlugin<any, any, any, any, any, any>
  | ComposablePlugin<any, any, any>
  | ComposableConditionalPlugin<any, any, any>
  | ComposableDirectlyPlugin<any, any, any>
  | BuilderExtensionPlugin<any, any>;
```
The multi-plugin overloads map the whole list at once with `PluginsToMap<T> = { [K in T[number] as ExtractPluginName<K>]: K }`.

The `BuilderExtensionPlugin` overload is the one exception: it intersects
`{ [K in TMethodName]: CreateMethodWithBuilder<TMethodSignature, <the Builder type at that point>> }`
into `TAccumulatedExtensions` and also puts the method directly on the return type. That is what makes `Builder().use(jsonSchemaFullFeaturePlugin).fromJsonSchema(...)` type-check **on the Builder, without going through `.for<T>()`**.

### 1.3 `.for<T>()`
```ts
interface ChainableBuilder<TPlugins = {}> {
  for<TInputType extends object>(): FieldBuilder<TInputType, unknown, TPlugins, never>;
}
```
The four type arguments of `FieldBuilder` (plugin-types.ts:1240):
```ts
interface FieldBuilder<TObject extends object, TMap = {}, TPlugins = {}, TDeclaredFields extends string = never>
```
- `TObject` — the existing TS type being validated (**the only constraint is `extends object`**)
- `TMap` — a flat map from path string to post-transform type. `.for()` starts it at `unknown`, not `{}` (effectively a bug, rescued by the intersection in `AddFieldTransform`)
- `TPlugins` — passed straight through from the Builder
- `TDeclaredFields` — the string union of declared field paths. Starts at `never` and gains `| Key` on every `.v()`. Used only by the exhaustiveness check in `strict()`.

### 1.4 `.v(path, definition, options?)`
An alias for `field()` (`const v = field;` at `field-builder.ts:124`). `field` is `@deprecated`; `v` is the real one.
```ts
v<Key extends NestedKeyOf<TObject> & string, TFieldBuilder>(
  path: Key,
  definition: FieldDefinition<TObject, TPlugins, TypeOfPath<TObject, Key>, TFieldBuilder>,
  options?: FieldConfig<TypeOfPath<TObject, Key>>
): FieldBuilder<
     TObject,
     AddFieldTransform<TMap, Key, TypeOfPath<TObject, Key>, ExtractFieldType<TFieldBuilder>>,
     TPlugins,
     TDeclaredFields | Key
   >;
```
Supporting types:
```ts
type FieldDefinition<TObject, TPlugins, TFieldType, TFieldBuilder> =
  (context: FieldBuilderContext<TObject, TPlugins, TFieldType>) => TFieldBuilder;

type AddFieldTransform<TMap, K extends string, TOriginal, TResult> =
  TResult extends TOriginal ? TMap : TMap & Record<K, TResult>;   // recorded only when the type changed

type ExtractFieldType<T> =
  T extends ChainableFieldBuilder<any, any, any, infer TOutput> ? TOutput
  : T extends { build(): FieldValidator<any, infer TValue> } ? TValue
  : T extends FieldValidator<any, infer TValue> ? TValue : never;
```
**The flow**: the literal `path` → `TypeOfPath<TObject, Key>` computes the field type → a `FieldBuilderContext` is built with that type and passed in as `b` → `ExtractFieldType` works backwards from the callback's return value (the terminal builder type of the chain) to the final output type → if it differs from the original, `{ [path]: newType }` is appended to `TMap` → `Key` is added to `TDeclaredFields`.

### 1.5 `.build()`
```ts
build(): TransformAwareValidator<TObject, ApplyFieldTransforms<TObject, TMap>>
```
```ts
interface TransformAwareValidator<T extends object, TTransformed = T> {
  validate(value: Partial<T> | unknown, options?: ValidationOptions): Result<T>;
  parse(value: Partial<T> | unknown, options?: ParseOptions): Result<TTransformed>;
  pick<K extends NestedKeyOf<T>>(key: K): FieldValidator<T, TypeOfPath<T, K>>;
  validateRaw?(value: T, options?: ValidationOptions): boolean;
  parseRaw?(value: T, options?: ParseOptions): { valid: boolean; data?: TTransformed; error?: any };
}
```
**`build()` does not return a function. It returns an object.** All three paths in validator-factory.ts (562/713/830) return an object literal of `{ validate, parse, pick, (validateRaw, parseRaw) }`. The README's `const validateUser = Builder()...build(); validateUser({...})` and its `result.issues` **do not exist in the implementation** — they are wrong.

`ApplyFieldTransforms<TObject, TMap>` = `ApplyNestedTransforms` = `DeepMerge<T, FlatMapToNested<TMap>>`. It expands `"a.b.c"` into `{a:{b:{c:V}}}` (via `PathToNested`/`Split`), and a leading array key becomes `{ key: Array<...> }` via `BuildArrayTransform`. **The `[*]` notation is not handled on this conversion side** (`Split` only splits on `.`), so transform types are reflected incompletely for array-element paths.

### 1.6 The other FieldBuilder methods
- `useField<Key>(path, fieldRule: FieldRule<TypeOfPath<TObject,Key>>): FieldBuilder<TObject, TMap, TPlugins, TDeclaredFields | Key>` — splices in a reusable rule that came from `createPluginRegistry()`
- `strict()` / `strictOnEditor()` (`strictOnEditor` is an alias of `strict`; both are `@deprecated` WIP):
```ts
strict(): MissingFields<TObject, TDeclaredFields> extends never
  ? FieldBuilder<TObject, TMap, TPlugins, TDeclaredFields>
  : { _error: `Missing field declarations in strict mode: ${...}`; _missingFields: ... };
type MissingFields<TObject, TDeclared extends string> = Exclude<NestedKeyOf<TObject>, TDeclared>;
```
When a field is left undeclared, **the return type turns into an error-object type and `.build()` disappears** — the "report the error through the type" technique.

---

## 2. How `use()` makes `b.string.xxx()` appear at the type level (the intended design)

This is the heart of the library: a five-stage pipeline.

**Stage 0: a plugin's type is self-describing**
```ts
interface TypedPlugin<TName extends string, TMethodName extends string, TMethod extends Function,
                      TAllowedTypes extends readonly TypeName[] | undefined = undefined,
                      TPluginType extends PluginType = "validator",
                      TCategory extends PluginCategory = "standard"> {
  name: TName; methodName: TMethodName; create(): TMethod;
  allowedTypes?: TAllowedTypes; category: TCategory;
}
```
A plugin is a value and at the same time carries its method name, accepted types, category and method signature **as literal types**. The `plugin({...})` factory preserves the literals that come from `as const`.

**Stage 1: accumulation** — `use()` produces `TPlugins & { [K in TName]: TypedPlugin<...> }`.

**Stage 2: narrowing by type (`FilterPluginsByType`)**
```ts
type FilterPluginsByType<TPlugins, TType extends TypeName> = {
  [K in keyof TPlugins as TPlugins[K] extends TypedPlugin<any,any,any, infer TAllowedTypes, any,any>
    ? TAllowedTypes extends readonly TypeName[]
      ? TType extends TAllowedTypes[number] ? K : never
      : K                                  // allowedTypes omitted = every type allowed
    : (the composable-family allowedTypes check)
    ]: TPlugins[K];
};
```
Entering `b.string` fixes `TType = "string"`, and only plugins whose `allowedTypes` contains `"string"` survive. **This is where `b.number.email()` becomes a type error.**

**Stage 3: method extraction (`ExtractPluginMethods` → `FlattenPluginMethods`)**
```ts
type ExtractPluginMethods<TPlugins,...> = { [K in keyof TPlugins]:
  TPlugins[K] extends TypedPlugin<any, infer TMethodName, infer TMethod, any,any,any>
    ? { [P in TMethodName]: TMethod } : ... }[keyof TPlugins];
type FlattenPluginMethods<...> = UnionToIntersection<ExtractPluginMethods<...>>;
```
The map keyed by plugin name is re-keyed into a **method table keyed by methodName**, then the union is collapsed to a single object type by intersection. This is where `stringMinPlugin` (name `stringMin`) shows up as `min`.

**Stage 4: chaining (`MapPluginMethodsToChainable`)** — the category rewrites the return type and the parameter types:

| category | generated method type |
|---|---|
| `standard` | `(...args: Params) => ChainableFieldBuilder<same type state>` |
| `conditional` | `(condition: (allValues: TObject) => boolean, options?: ValidationOptions) => Chainable<same>` |
| `fieldReference` | `(fieldPath: NestedKeyOf<TObject> & string, options?: ValidationOptions) => Chainable<same>` |
| `multiFieldReference` | `<const TFields extends readonly (NestedKeyOf<TObject>&string)[]>(fields, validate(fieldValues: FieldsToObject<TObject,TFields>, currentValue, allValues), options?) => Chainable<same>` |
| `transform` | `<TOutput>(fn: (value: ApplyTypeState<TCurrent,TState>) => TOutput) => ChainableFieldBuilder<..., TOutput, ...>` **← this is where TCurrentType is swapped** |
| `composable-conditional` + methodName `guard` + TType `"union"` | `<TGuardType extends TCurrent>(condition: (v:unknown)=>v is TGuardType, builderFn) => ChainableFieldBuilderWithUnionTracking<..., TGuardType added>` |
| methodName `required` / `optional` | arguments stay as the plugin declares them; `TTypeState` gets `excludeUndefined: true` |
| methodName `nullable` | widens to `TCurrentType \| null` and sets `TTypeState.excludeNull: true` |

**Branching hardcoded on method names is baked into the types** (`required`/`optional`/`nullable`/`guard`). The design intent is a "type state machine".

**Stage 5: type state (TypeStateFlags)**
```ts
interface TypeStateFlags { excludeUndefined?: boolean; excludeNull?: boolean; }
type ApplyTypeState<T, S> = S["excludeUndefined"] extends true
  ? S["excludeNull"] extends true ? NonNullable<T> : Exclude<T, undefined>
  : S["excludeNull"] extends true ? Exclude<T, null> : T;
```
The point is that after `.required()`, a following `.transform(v => ...)` sees `v` as `string`, not `string | undefined`.

**The entry point `FieldBuilderContext`** (the type of `b`, plugin-types.ts:1090):
```ts
type FieldBuilderContext<TObject extends object, TPlugins = {}, TFieldType = any> = {
  string:  ChainableFieldBuilder<TObject, TPlugins, "string",  string>;
  number:  ChainableFieldBuilder<TObject, TPlugins, "number",  number>;
  boolean: ChainableFieldBuilder<TObject, TPlugins, "boolean", boolean>;
  date:    ChainableFieldBuilder<TObject, TPlugins, "date",    Date>;
  array:   ChainableFieldBuilder<TObject, TPlugins, "array",   any[]>;
  tuple:   ChainableFieldBuilder<TObject, TPlugins, "tuple",   readonly any[]>;
  union:   <UnionFieldBuilderWithPlugins (with the guard exhaustiveness check) when TFieldType is a
            union; the error type UnionArrayObjectError when the union contains Array<object>>;
  object:  ChainableFieldBuilder<TObject, TPlugins, "object",  object>;
  any:     ChainableFieldBuilder<TObject, TPlugins, "any",     any>;
};
```
Nine type entry points — the nine members of `TypeName` (`"string"|"number"|"date"|"array"|"union"|"tuple"|"object"|"boolean"|"null"|"any"`) other than `null`. The runtime (field-context.ts:514-522) has the same nine keys, and `attachPluginMethods` decides which methods actually appear using `plugin.allowedTypes.includes(type)`. **Types and runtime being driven by one and the same rule (allowedTypes)** is the design philosophy.

**`refineXxx()`**: the eight methods `refineString/refineNumber/refineBoolean/refineArray/refineObject/refineTuple/refineUnion/refineDate` are present on every builder; they swap `TType` and move the chain onto another type's method set.

**Union exhaustiveness check**:
```ts
interface UnionFieldBuilder<...> {
  build(): Exclude<TUnionType, TDeclaredTypes> extends never
    ? FieldValidator<TObject, TUnionType>
    : { _error: `Missing guard declarations for union types: ...`; _missingTypes: ... };
}
```
Every `.guard()` call pushes a guard type onto `TDeclaredTypes`, and `build()` returns an error type until every member is covered.

---

## 3. Typing of field path strings

The first argument of `.v()` is `Key extends NestedKeyOf<TObject> & string`. `NestedKeyOf` (src\types\util.ts:44-68, depth limit 5, `Depth` counter technique) generates these path shapes:

| shape | condition |
|---|---|
| `"name"` | a direct key |
| `"user.address.street"` | recursion where `IsPlainObject<NonNullable<T[K]>> extends true` (`Function`/`Array`/`Date` are not plain objects, so recursion stops) |
| `"tags[*]"` | the element itself, where `T[K] extends Array<U>` |
| `"items[*].name"` | recursion where `U extends object` |
| `"matrix[*][*]"` | the element of a two-dimensional array |
| `"matrix[*][*].x"` | an object element of a two-dimensional array |
| `"shipping.addresses[*].street"` | a combination of the above (exercised by tests) |
| `"items[*].attributes.color"` | nesting inside an array element (exercised by tests) |
- Optional arrays (`NonNullable<T[K]> extends Array<U>`) are treated the same way.
- `ExcludeArrayMethods` strips array method names such as `length`/`map`/`filter` from the path candidates.

The matching type resolution is `TypeOfPath<T, Path>` (util.ts:70-131). It is **template-literal pattern matching**, tried in this order:
`${K}[*][*][*]` → `${K}[*][*]` → `${K}[*]` → `${K}.*` → `${K}[*][*][*].${Rest}` → `${K}[*][*].${Rest}` → `${K}[*].${Rest}` → `${K}.*.${Rest}` → `${K}.${Rest}` (this case implicitly descends into the element when `T[K]` is an array) → `Path extends keyof T`.
The `.*` notation (`"items.*"`, `"items.*.name"`) is also accepted at the type level.

`useField` and `TransformAwareValidator.pick` use the same `NestedKeyOf`/`TypeOfPath`. However, the tests need `pick("employees[*].name" as any)` — that is, `pick`'s `K extends NestedKeyOf<T>` is broken for array-element paths.

**How paths appear in errors**: at runtime they are **resolved to real indices**, not `[*]` (test: `result.errors[0].path === "items[2]"`).

---

## 4. Public exports — all 58 entries of package.json `exports`

Every entry has the three conditions `{ types: ./dist/<X>.d.ts, import: ./dist/<X>.mjs, require: ./dist/<X>.js }`. `exports-config.json` is a duplicate of the same content generated by build.js (keys match exactly, 58 of them). `"sideEffects": false`, `"files": ["dist"]`.

1. `.`
2. `./plugins/required`
3. `./plugins/optional`
4. `./plugins/nullable`
5. `./plugins/stringMin`
6. `./plugins/stringMax`
7. `./plugins/stringEmail`
8. `./plugins/stringPattern`
9. `./plugins/stringUrl`
10. `./plugins/stringDate`
11. `./plugins/stringDatetime`
12. `./plugins/stringTime`
13. `./plugins/stringIpv4`
14. `./plugins/stringIpv6`
15. `./plugins/stringHostname`
16. `./plugins/stringDuration`
17. `./plugins/stringBase64`
18. `./plugins/stringJsonPointer`
19. `./plugins/stringRelativeJsonPointer`
20. `./plugins/stringIri`
21. `./plugins/stringIriReference`
22. `./plugins/stringUriTemplate`
23. `./plugins/stringContentEncoding`
24. `./plugins/stringContentMediaType`
25. `./plugins/uuid`
26. `./plugins/numberMin`
27. `./plugins/numberMax`
28. `./plugins/numberPositive`
29. `./plugins/numberNegative`
30. `./plugins/numberInteger`
31. `./plugins/numberMultipleOf`
32. `./plugins/booleanTruthy`
33. `./plugins/booleanFalsy`
34. `./plugins/arrayMinLength`
35. `./plugins/arrayMaxLength`
36. `./plugins/arrayUnique`
37. `./plugins/arrayIncludes`
38. `./plugins/arrayContains`
39. `./plugins/object`
40. `./plugins/objectMinProperties`
41. `./plugins/objectMaxProperties`
42. `./plugins/objectAdditionalProperties`
43. `./plugins/objectPropertyNames`
44. `./plugins/objectPatternProperties`
45. `./plugins/objectDependentRequired`
46. `./plugins/objectDependentSchemas`
47. `./plugins/oneOf`
48. `./plugins/literal`
49. `./plugins/compareField`
50. `./plugins/requiredIf`
51. `./plugins/validateIf`
52. `./plugins/skip`
53. `./plugins/transform`
54. `./plugins/tupleBuilder`
55. `./plugins/readOnlyWriteOnly`
56. `./plugins/custom`
57. `./plugins/jsonSchema`
58. `./plugins/jsonSchemaFullFeature`

**Paths that do not exist but the README uses**: `@maroonedog/luq/plugins` (a barrel) and `@maroonedog/luq/core/builder/plugins/plugin-creator`. The README's Quick Start does not resolve as written.
**Paths that do not exist but conceptually do**: `./core`. The root `.` is built from `core-entry.ts` (zero plugins), so in practice `.` is also the core entry.

**An important mismatch**: `src/index.ts` (which re-exports every plugin) **is not shipped**. build.js builds the root from `entryPoints: ["core-entry.ts"]`. So the public root API is exactly the contents of core-entry.ts: Builder + types + the plugin factories + Result + GlobalConfig, and nothing else.

## 5. Catalog of all 57 public plugins (export symbol / plugin.name / methodName / category / allowedTypes)

allowedTypes shorthand: `ALL7` = `["string","number","boolean","array","object","date","union"]`

| # | export symbol | name | methodName | category | allowedTypes |
|---|---|---|---|---|---|
|1|`requiredPlugin`|required|`required`|standard|`["array","boolean","number","object","string","date","union","tuple"]`|
|2|`optionalPlugin`|optional|`optional`|standard|ALL7|
|3|`nullablePlugin`|nullable|`nullable`|standard|ALL7|
|4|`stringMinPlugin`|stringMin|`min`|standard|`["string"]`|
|5|`stringMaxPlugin`|stringMax|`max`|standard|`["string"]`|
|6|`stringEmailPlugin`|stringEmail|`email`|standard|`["string"]`|
|7|`stringPatternPlugin`|stringPattern|`pattern`|standard|`["string"]`|
|8|`stringUrlPlugin`|stringUrl|`url`|standard|`["string"]`|
|9|`stringDatePlugin`|stringDate|`date`|standard|`["string"]`|
|10|`stringDatetimePlugin`|stringDatetime|`datetime`|standard|`["string"]`|
|11|`stringTimePlugin`|stringTime|`time`|standard|`["string"]`|
|12|`stringIpv4Plugin`|stringIpv4|`ipv4`|standard|`["string"]`|
|13|`stringIpv6Plugin`|stringIpv6|`ipv6`|standard|`["string"]`|
|14|`stringHostnamePlugin`|stringHostname|`hostname`|standard|`["string"]`|
|15|`stringDurationPlugin`|stringDuration|`duration`|standard|`["string"]`|
|16|`stringBase64Plugin`|stringBase64|`base64`|standard|`["string"]`|
|17|`stringJsonPointerPlugin`|stringJsonPointer|`jsonPointer`|standard|`["string"]`|
|18|`stringRelativeJsonPointerPlugin`|stringRelativeJsonPointer|`relativeJsonPointer`|standard|`["string"]`|
|19|`stringIriPlugin`|stringIri|`iri`|standard|`["string"]`|
|20|`stringIriReferencePlugin`|stringIriReference|`iriReference`|standard|`["string"]`|
|21|`stringUriTemplatePlugin`|stringUriTemplate|`uriTemplate`|standard|`["string"]`|
|22|`stringContentEncodingPlugin`|stringContentEncoding|`contentEncoding`|standard|`["string"]`|
|23|`stringContentMediaTypePlugin`|stringContentMediaType|`contentMediaType`|standard|`["string"]`|
|24|`uuidPlugin`|**stringUuid**|`uuid`|standard|`["string"]`|
|25|`numberMinPlugin`|numberMin|`min`|standard|`["number"]`|
|26|`numberMaxPlugin`|numberMax|`max`|standard|`["number"]`|
|27|`numberPositivePlugin`|numberPositive|`positive`|standard|`["number"]`|
|28|`numberNegativePlugin`|numberNegative|`negative`|standard|`["number"]`|
|29|`numberIntegerPlugin`|numberInteger|`integer`|standard|`["number"]`|
|30|`numberMultipleOfPlugin`|numberMultipleOf|`multipleOf`|standard|`["number"]`|
|31|`booleanTruthyPlugin`|booleanTruthy|`truthy`|standard|`["boolean"]`|
|32|`booleanFalsyPlugin`|booleanFalsy|`falsy`|standard|`["boolean"]`|
|33|`arrayMinLengthPlugin`|arrayMinLength|`minLength`|standard|`["array"]`|
|34|`arrayMaxLengthPlugin`|arrayMaxLength|`maxLength`|standard|`["array"]`|
|35|`arrayUniquePlugin`|arrayUnique|`unique`|standard|`["array"]`|
|36|`arrayIncludesPlugin`|arrayIncludes|`includes`|**arrayElement**|`["array"]`|
|37|`arrayContainsPlugin`|arrayContains|`contains`|standard|`["array"]`|
|38|`objectPlugin`|object|`object`|standard|`["object"]`|
|39|`objectMinPropertiesPlugin`|objectMinProperties|`minProperties`|standard|`["object"]`|
|40|`objectMaxPropertiesPlugin`|objectMaxProperties|`maxProperties`|standard|`["object"]`|
|41|`objectAdditionalPropertiesPlugin`|objectAdditionalProperties|`additionalProperties`|standard|`["object"]`|
|42|`objectPropertyNamesPlugin`|objectPropertyNames|`propertyNames`|standard|`["object"]`|
|43|`objectPatternPropertiesPlugin`|objectPatternProperties|`patternProperties`|standard|`["object"]`|
|44|`objectDependentRequiredPlugin`|objectDependentRequired|`dependentRequired`|standard|`["object"]`|
|45|`objectDependentSchemasPlugin`|objectDependentSchemas|`dependentSchemas`|standard|`["object"]`|
|46|`oneOfPlugin`|oneOf|`oneOf`|standard|`["string","number","boolean"]`|
|47|`literalPlugin`|literal|`literal`|standard|`["string","number","boolean","null"]`|
|48|`compareFieldPlugin`|compareField|`compareField`|**fieldReference**|`["string","number","boolean","date","object","array","tuple","union"]`|
|49|`requiredIfPlugin`|requiredIf|`requiredIf`|**conditional**|ALL7|
|50|`validateIfPlugin`|validateIf|`validateIf`|**conditional**|ALL7|
|51|`skipPlugin`|skip|`skip`|**conditional**|ALL7|
|52|`transformPlugin`|transform|`transform`|**transform**|ALL7|
|53|`tupleBuilderPlugin`|tupleBuilder|`builder`|**composable-directly**|`["tuple"]`|
|54|`readOnlyWriteOnlyPlugin`|readOnlyWriteOnly|`readOnly`|**context**|`["string","number","boolean","date","array","object"]`|
|55|`customPlugin`|custom|`custom`|standard|`["string","number","boolean","date","array","object","tuple","union"]`|
|56|`jsonSchemaPlugin`|jsonSchema|`fromJsonSchema`|**builder-extension**|—|
|57|`jsonSchemaFullFeaturePlugin`|jsonSchemaFullFeature|`fromJsonSchema`|**builder-extension**|—|

Notes: `readOnlyWriteOnly.ts` also defines `writeOnlyPlugin` (name `writeOnly` / methodName `writeOnly` / context), but it is **not exported publicly** — only `readOnly` reaches users. `uuidPlugin` has the name `stringUuid` while its export name and path are `uuid`, so they disagree.

**Plugins present in the internal barrel `src/core/plugin/index.ts` but not published (13)**: `optionalIfPlugin`, `orFailPlugin`, `stitchPlugin`, `stringExactLengthPlugin`, `stringAlphanumericPlugin`, `stringStartsWithPlugin`, `stringEndsWithPlugin`, `numberFinitePlugin`, `numberRangePlugin`, `objectRecursivelyPlugin` (also `recursivelyPlugin`), `unionGuardPlugin`, `fromContextPlugin`, `conditionalSchemaPlugin` (file only). The tests use `finite()` and friends. `unionGuardPlugin` (name `unionGuard` / methodName `guard` / composable-conditional / `["union"]`) **is special-cased by the type system (the hardcoded `guard` branch and the union exhaustiveness check) yet is not published**.

---

## 6. The intent behind `fromJsonSchema`

```ts
export const jsonSchemaFullFeaturePlugin: BuilderExtensionPlugin<
  "jsonSchemaFullFeature", "fromJsonSchema",
  <TBuilder extends FieldBuilder<any, any, any, any>>(
    schema: JSONSchema7 | unknown, options?: JsonSchemaOptions) => TBuilder
>
```
- `extendBuilder(builder)` **calls `builder.use()` internally for the 43 plugins it needs** and then uses `jsonSchemaPlugin` — one import covers all of Draft-07.
- The `impl` itself calls `this.for()` to make a FieldBuilder and simply feeds the DSL array from `convertJsonSchemaToLuqDSL(schema)` into `fieldBuilder.v(dslField.path, definition)`. **The correct form is `Builder().use(...).fromJsonSchema(schema).build()`, with no `.for<T>()` in between.**
- In the type, `TBuilder extends FieldBuilder<any,any,any,any>` is all `any` — there is **no** mechanism for deriving TS types from a schema.
- How CSP safety is achieved: no `eval`/`new Function`; the schema is converted into builder method calls and assembled at runtime. This policy must be carried forward.

---

## 7. The public surface of the type utilities (every symbol core-entry.ts actually ships)

Values: `Builder`, `createPluginRegistry`, `ValidationResult` (a type only, but treated as a value export), `plugin`, `pluginPredefinedTransform`, `pluginConfigurableTransform`, `pluginBuilderExtension`, `Result`, `GlobalConfig`, `globalConfig`, `setGlobalConfig`, `getGlobalConfig`, `resetGlobalConfig`
Types: `PluginRegistry`, `FieldRule`, `ExtractFieldRuleType`, `FieldRuleDefinition`, `FieldBuilder`, `TransformAwareValidator`, `ApplyFieldTransforms`, `ExtractFieldType`, `TypedPlugin`, `PluginType`, `PluginCategory`, `TypeName`, `BuilderExtensionPlugin`, `BuilderExtensionMethod`, `ValidationOptions`, `MessageContext`, `SEVERITY`, `BasicValidationResult` (= `PluginValidationResult`), `StandardPluginImplementation`, `ConditionalPluginImplementation`, `TransformPluginImplementation`, `FieldReferencePluginImplementation`, `ArrayElementPluginImplementation`, `PluginImplementation`

(`src/index.ts` re-exports every plugin on top of this, but as noted above it is not shipped.)

## Contracts to preserve (24)

### must-preserve (15)

#### Builder
- Source: `C:\projects\luq\src\core\builder\core\builder.ts:111-115`
- Shape: function Builder<TInput = unknown>(): ChainableBuilder<TInput, {}, {}>
- Meaning: a factory taking no arguments. Returns a Builder with zero plugins and zero extensions. No `new`. Every call yields an independent instance (the implementation is an object closing over an internal pluginMethods record).

#### .use(plugin)
- Source: `C:\projects\luq\src\core\builder\types\types.ts:481-675 / core\builder.ts:41-101`
- Shape: use<P extends AnyPlugin>(plugin: P): Builder<TInput, TPlugins & { [K in P['name']]: P }, TExtensions & ExtensionsOf<P>>
- Meaning: accumulates the plugin type into the TPlugins map by intersection, keyed by the name literal, and returns. A second use of the same name is ignored (first one wins). Variadic calls are accepted. At runtime it checks that the plugin is an object with a name, throws `Invalid plugin at index N: plugin must be an object with a 'name' property` when it is not, and skips null/undefined.

#### .for<T>()
- Source: `C:\projects\luq\src\core\builder\types\types.ts:352-359 / core\builder.ts:27-39`
- Shape: for<TInputType extends object>(): FieldBuilder<TInputType, {}, TPlugins, never>
- Meaning: the type being validated is given purely as a type argument — no schema value is passed. TPlugins carries over to the FieldBuilder unchanged. TMap starts empty and TDeclaredFields starts at never.

#### .v(path, definition, options?)
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:1284-1305 / core\field-builder.ts:67-124`
- Shape: v<Key extends NestedKeyOf<TObject> & string, TFieldBuilder>(path: Key, definition: (b: FieldBuilderContext<TObject, TPlugins, TypeOfPath<TObject, Key>>) => TFieldBuilder, options?: FieldConfig<TypeOfPath<TObject, Key>>): FieldBuilder<TObject, AddFieldTransform<TMap, Key, TypeOfPath<TObject,Key>, ExtractFieldType<TFieldBuilder>>, TPlugins, TDeclaredFields | Key>
- Meaning: one declaration per field. Immutable — each call returns a new FieldBuilder. The definition is deferred until build(). The path is retained as a literal type, and that literal becomes the key in TDeclaredFields and TMap.

#### .build()
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:1133-1148, 1357-1360 / builder\validator-factory.ts:562,713,830`
- Shape: build(): TransformAwareValidator<TObject, ApplyFieldTransforms<TObject, TMap>>
- Meaning: returns an object, not a function: { validate(value, options?): Result<T>; parse(value, options?): Result<TTransformed>; pick(key): FieldValidator<T, TypeOfPath<T,key>>; validateRaw?; parseRaw? }. validate returns the original type; parse returns the post-transform type.

#### FieldBuilderContext (the type of the callback argument b)
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:1090-1128 / builder\context\field-context.ts:514-522`
- Shape: the nine keys { string; number; boolean; date; array; tuple; union; object; any }, each a chaining builder carrying the plugin methods allowed for that type
- Meaning: `b.<typeName>` is the act of declaring "validate this as this type", and from there only the validation methods permitted for that type can be chained. `union` becomes the builder with the guard exhaustiveness check only when TFieldType really is a union. The runtime has the same nine keys, and attachPluginMethods decides which methods to attach with allowedTypes.includes(type).

#### TypedPlugin
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:63-76`
- Shape: { name: TName; methodName: TMethodName; create(): TMethod; allowedTypes?: readonly TypeName[]; category: PluginCategory }
- Meaning: a plugin's self-describing metadata. Type-level narrowing (FilterPluginsByType) and runtime method attachment (attachPluginMethods) read the same allowedTypes. name is the plugin's identifier and methodName is the method name in the chain; the two are different things (stringMin → .min()).

#### TypeName
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:105-115`
- Shape: "string" | "number" | "date" | "array" | "union" | "tuple" | "object" | "boolean" | "null" | "any"
- Meaning: the vocabulary of allowedTypes. It is also the set of entry names on b (only null has no entry).

#### NestedKeyOf<T> / TypeOfPath<T, Path>
- Source: `C:\projects\luq\src\types\util.ts:44-131`
- Shape: generation of the path-string union, and path-to-type resolution. Supported shapes: "a", "a.b.c", "a[*]", "a[*].b", "a[*][*]", "a[*][*].b", "a.b[*].c", "a[*].b.c" (depth limit 5)
- Meaning: the heart of typed field paths. Array method names (length/map/…) are excluded from the path candidates. Optional arrays produce the same shapes via NonNullable. TypeOfPath also accepts the ".*" notation.

#### the plugin() factory
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-creator.ts:77-101`
- Shape: plugin({ name, methodName, allowedTypes, category, impl }): TypedPlugin<name, methodName, impl, allowedTypes, "validator", category>
- Meaning: the one and only entry point for user-defined plugins. impl is a function returning a ValidatorFormat ({ check, code, getErrorMessage, params }). pluginName is injected into the return value automatically.

#### ValidatorFormat (what a plugin impl returns)
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-interfaces.ts:26-68, 80-98`
- Shape: { check(value, allValues?, arrayContext?): boolean; code: string; getErrorMessage(value, path, allValues?, arrayContext?): string; params: any[] }
- Meaning: the smallest unit of a single validation. A false check is an error. The old form ((value, ctx) => { valid: boolean }) is also accepted — a dual support path — but a new implementation should settle on ValidatorFormat alone.

#### pluginBuilderExtension() / BuilderExtensionPlugin
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-creator.ts:155-181 / plugin-types.ts:90-100`
- Shape: pluginBuilderExtension({ name, methodName, impl: () => Method, extendBuilder: (builder) => void }): BuilderExtensionPlugin<TName, TMethodName, TMethodSignature>
- Meaning: the mechanism for grafting a method onto the Builder itself. use() calls extendBuilder(builder), which sets builder[methodName] = impl. extendBuilder may itself call builder.use(otherPlugin), which is how plugin bundles work. fromJsonSchema exists only because of this mechanism.

#### jsonSchemaFullFeaturePlugin / .fromJsonSchema()
- Source: `C:\projects\luq\src\core\plugin\jsonSchemaFullFeature.ts:165-186 / jsonSchema\plugin.ts:42-112`
- Shape: fromJsonSchema(schema: JSONSchema7 | unknown, options?: JsonSchemaOptions): FieldBuilder<any, any, any, any>
- Meaning: the correct form is Builder().use(jsonSchemaFullFeaturePlugin).fromJsonSchema(schema).build(), with no .for<T>() in between — the impl calls this.for() internally. extendBuilder automatically uses the 43 plugins Draft-07 requires. CSP-safe: no eval / new Function, only DSL conversion into builder method calls.

#### the type state machine (required/optional/nullable/transform)
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:484-546, 906-923`
- Shape: TypeStateFlags = { excludeUndefined?: boolean; excludeNull?: boolean }; ApplyTypeState<T,S>
- Meaning: after .required(), undefined is removed from TCurrentType; .nullable() adds null and sets excludeNull. The fn argument of .transform(fn) is typed after ApplyTypeState, its return type becomes the new TCurrentType, and that flows through TMap into the return type of parse(). This experience of "the chain changing the type as it goes" is the most important idea in the library.

#### the shape of package.json exports
- Source: `C:\projects\luq\package.json:8-... / exports-config.json / build.js:9-86,232-250`
- Shape: "." is core only (Builder + types + the plugin factories). Every plugin gets its own path, "./plugins/<pluginFileName>". Every entry has the three conditions types/import/require. sideEffects: false.
- Meaning: this is how per-plugin tree-shaking is achieved. The path name equals the source file name equals the export symbol without the Plugin suffix (uuid is the sole exception).

### should-preserve (6)

#### PluginCategory
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:47-58`
- Shape: "standard" | "conditional" | "transform" | "fieldReference" | "multiFieldReference" | "arrayElement" | "composable" | "composable-conditional" | "composable-directly" | "context" | "builder-extension"
- Meaning: the category is the single switch that decides a method's parameter and return types at the type level. Eleven values may well be too many, but five of them — standard/conditional/fieldReference/transform/builder-extension — are semantically necessary.

#### Result<T>
- Source: `C:\projects\luq\src\types\result.ts:82-233`
- Shape: { isValid(): boolean; isError(): boolean; readonly valid: boolean; unwrap(): T; unwrapOr(d): T; unwrapOrElse(fn): T; map(fn); flatMap(fn); tap(fn); tapError(fn); data(): T|undefined; readonly errors: ValidationError[]; toPlainObject(): { valid; data?; errors } } plus Result.ok / Result.error
- Meaning: validation results come back as a Result rather than as exceptions. Both a valid property and an isValid() method exist (the same thing expressed twice). unwrap() throws LuqValidationException when the result is invalid.

#### ValidationError
- Source: `C:\projects\luq\src\types\index.ts:26-31`
- Shape: { path: string; message: string; code: string; paths(): string[] }
- Meaning: the shape of one error. path is resolved to a real index for array elements ("items[2]"). code is the plugin name ("required", "arrayMinLength", …). The paths() method mixed into the type needs to be redesigned.

#### ValidationOptions / ParseOptions
- Source: `C:\projects\luq\src\types\index.ts:41-72 and C:\projects\luq\src\core\plugin\types.ts:41-47`
- Shape: ValidationOptions = { abortEarly?; abortEarlyOnEachField?; messageFactory?; translate?; context? }; ParseOptions = ValidationOptions & { transforms?: Record<string,(v)=>any> }
- Meaning: the second argument of validate/parse. Careful: a different type with the same name lives in src/core/plugin/types.ts ({ code?; fieldName?; severity?; messageFactory? }) and is the second argument of a plugin method (the settings of one validator). The two ValidationOptions collide by name and should be renamed apart in a new implementation.

#### FieldOptions / FieldConfig (the third argument of .v)
- Source: `C:\projects\luq\src\core\builder\types\field-options.ts:5-100`
- Shape: FieldOptions<T> = { default?: T | (() => T); applyDefaultToNull?: boolean; description?: string; deprecated?: boolean | string; metadata?: Record<string, unknown> }; FieldConfig<T> = T | (() => T) | FieldOptions<T>
- Meaning: field settings that are not validation rules. normalizeFieldConfig distinguishes the shorthand form (the value itself is the default) from the full options form. The default applies to undefined, and also to null when applyDefaultToNull !== false.

#### the union guard exhaustiveness check
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:790-802, 1474-1482`
- Shape: UnionFieldBuilder.build(): Exclude<TUnionType, TDeclaredTypes> extends never ? FieldValidator<...> : { _error: `Missing guard declarations for union types: ...`; _missingTypes }
- Meaning: every .guard(v => v is X, b => ...) pushes X onto TDeclaredTypes, and build() returns an error-object type until every union member is covered. When the union contains Array<object>, the UnionArrayObjectError type is returned so that b.union cannot be used at all.

### optional (3)

#### .useField(path, fieldRule) / createPluginRegistry()
- Source: `C:\projects\luq\src\core\registry\plugin-registry.ts:29-186`
- Shape: createPluginRegistry(): PluginRegistry<{}>; accumulate with registry.use(plugin); registry.for<T>() gives a TypedPluginRegistry; registry.createFieldRule(def, options) gives a FieldRule<T>; builder.useField(path, rule)
- Meaning: the reuse idea of "assemble a validation rule for one field up front, then splice it into several Builders later". A FieldRule<T> can validate/parse on its own. registry.toBuilder() can also convert it into a Builder.

#### refineXxx()
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:231-260, 722-785`
- Shape: refineString/refineNumber/refineBoolean/refineArray/refineObject/refineTuple/refineUnion/refineDate: () => ChainableFieldBuilder<..., new TType, ...>
- Meaning: switches the type category handled mid-chain. Present on every builder. There is also a CanRefineToType implementation that makes "refining to the same type" never, but there are two parallel definitions (ChainableFieldBuilderTransformAware is unused dead code).

#### GlobalConfig
- Source: `C:\projects\luq\src\core\global-config.ts:1-96`
- Shape: { messageKeyPrefix?; toBooleanTruthyValues?: string[]; numberFormat?: { decimalSeparator?; thousandSeparator? }; dateFormat?; trimStrings?; caseSensitive?; customTransforms?: Record<string,(v)=>any> } plus globalConfig / setGlobalConfig / getGlobalConfig / resetGlobalConfig
- Meaning: mutable global settings shared across the whole process. It contradicts the tree-shaking and no-side-effects principles (mutable state at module level), so a new implementation has to decide whether to carry it forward or drop it.

## Behavioural rules

- Builder() takes no arguments. No `new`. Each call returns an independent instance, and the internal plugin record is not shared.
- The chain order is fixed: Builder() → .use()* → .for<T>() → .v()* → .build(). .use() only before .for(); .v() only after .for().
- The type information of the plugins already passed to use() — name / methodName / allowedTypes / category — fully determines whether `b.<type>.<method>()` exists and what its parameter and return types are. The runtime's attachPluginMethods reads the same allowedTypes, so the set of available methods must agree between the types and the runtime.
- A plugin's name (its identifier and error code) and its methodName (the method name in the chain) are different things: stringMin → .min(), arrayMinLength → .minLength(), stringUuid → .uuid(). Plugins in different type categories may share a methodName (stringMin and numberMin are both .min(); their allowedTypes are disjoint, so they never collide).
- Passing the same plugin to use() twice ignores the second one (keyed by name, first one wins).
- Passing a non-object, or a value without a name, to use() throws. null / undefined are ignored (current implementation).
- The T in .for<T>() is constrained only by extends object. Users pass their existing TypeScript type directly; no re-declaration of the schema is required.
- Field paths are type-checked by NestedKeyOf<T> and retained as literals. Supported shapes: "a" / "a.b.c" / "a[*]" / "a[*].b" / "a[*][*]" / "a[*][*].b" / "a.b[*].c" / "a[*].b.c" (current nesting depth limit is 5). Built-in array method names (length, map, filter, …) are excluded from the path candidates.
- `[*]` means "apply to every element of the array". At runtime, error paths are resolved to real indices rather than `[*]` ("items[2]").
- The .v() callback is deferred until build() — it is not called at .v() time. FieldBuilder is immutable, and .v() returns a new instance every time.
- Entering b is the act of declaring a type category. The moment you enter b.string, only the methods of plugins whose allowedTypes contains "string" are visible.
- required / optional / nullable / transform are recognized by the type system as special method names that change the type state. required/optional take undefined out of scope, nullable takes null out of scope, and the return type of transform becomes the target type for the rest of the chain.
- A field that used transform is recorded in TMap and shows up in the return type of the parse() that build() produces. validate() always returns the original type.
- build() returns an object. { validate, parse, pick } are required; validateRaw / parseRaw exist only when there is an optimized path (optional in the type).
- validate() / parse() do not throw; they return Result<T>. Data is extracted with unwrap() (which throws when invalid), unwrapOr(), or data().
- Errors are an array of { path, message, code }. code is the plugin's name.
- Plugins must be side-effect-free, self-contained modules — one plugin, one file, one export — and statically reachable. That is the precondition for tree-shaking.
- eval / new Function are never used. Loading a JSON Schema at runtime is done purely by the conversion schema → intermediate DSL → builder method calls.
- jsonSchemaFullFeaturePlugin behaves as a bundle: one use() brings in every plugin Draft-07 needs. You can call .fromJsonSchema(schema) right after use(), and .for<T>() is unnecessary.
- Public export path names match the source file names, one entry per plugin (./plugins/<name>). The root "." contains no plugins.

## Not carried forward

- **The 11 overloads of IChainableBuilder.use() (one each for TypedPlugin / ComposablePlugin / ComposableConditionalPlugin / ComposableDirectlyPlugin / BuilderExtensionPlugin, four fixed-arity ones for 2/3/4/5, and one variadic)** — the overloads explode because the plugin type is split into five kinds. Unify the plugin representation into a single discriminated union (discriminated by category) and use needs only two overloads: a single-plugin one and a variadic one. The four fixed-arity 2/3/4/5 overloads are brute force for TS inference and add no semantics.
- **The `& TPlugins` in IChainableBuilder's return type (mixing the plugin map itself into the Builder's structure)** — at types.ts:512 and elsewhere the return type is `IChainableBuilder<...> & TAccumulatedExtensions & TPlugins & { [K in TMethodName]: TMethod }`, so the Builder instance grows properties like 'stringMin' and 'min' at the type level. A Builder should never grow validation methods (they belong on b only). This is an unintended leak.
- **The TInput type argument of IChainableBuilder** — a leftover from a design where the type was supplied up front as Builder<T>(), but .for<T>() decides the target type, so it is redundant. It is only referenced inside CreateMethodWithBuilder, and even there it checks whether TInput extends object and falls back to any. Drop it and rely on .for<T>() alone.
- **The implementation body of builder.ts (const builder: any = {...}, pluginMethods: Record<string, any>, args: any[], a stream of as any, console.error / console.warn)** — over ten uses of any within 115 lines. The type definitions (types.ts:475-676) and the implementation are not connected at all. A library writing to the console is also inappropriate. Rebuild the implementation from the type definitions.
- **The field() method and strictOnEditor()** — field() is identical to v() (const v = field) and already @deprecated. strictOnEditor() is an alias of strict() (const strictOnEditor = strict). With zero users there is no reason to keep the aliases. Keep only v() and strict().
- **The "return an error type" implementation of strict() / strictOnEditor() ({ _error: `...`; _missingFields: ... })** — clever as a way of reporting a type error, but because the return type turns into an error object, .build() disappears in the IDE and the reason is buried inside a type name. Both methods declare themselves @deprecated WIP. If the semantics of strict (forcing every field to be declared) are worth keeping, redesign the expression — returning never plus a dedicated branded type, or runtime additionalProperties.
- **The chainableBuilder argument of createFieldBuilderImpl (taken as any and never used)** — field-builder.ts:39 passes the builder in, but createFieldBuilderImpl only holds it and passes it down recursively, never reading it. A purely dead dependency.
- **ChainableFieldBuilderTransformAware and CanRefineToType (plugin-types.ts:192-260)** — there are two parallel definitions of the refine methods. The one actually used is on ChainableFieldBuilderBase (722-785); the refined version using CanRefineToType to make same-type refines never is referenced by nobody — dead code.
- **AsyncContext / AsyncAwareValidator / AsyncEnhancedBuilder / AsyncContextAwareValidation / AsyncPluginMethods / ExampleAsyncContext (types.ts:690-797)** — they occupy the last 100 lines of types.ts and are referenced from neither Builder nor FieldBuilder. There is no implementation of buildWithAsyncSupport(). AsyncPluginMethods goes as far as putting concrete domain names — checkDuplication / validateMx / checkQuota — into the types (leftovers from sample code). If async validation is wanted, design it from a blank page.
- **src/index.ts (163 lines, the root barrel re-exporting every plugin)** — build.js builds the root from entryPoints: ["core-entry.ts"], so src/index.ts is not shipped. It is an unshipped entry being maintained. In line with the (correct) policy that the root is core only, make the root barrel a single one that contains no plugins.
- **src/core/index.ts (89 lines, re-exporting "only the plugins used in benchmarks")** — as its own comment says, 'Export only plugins used in benchmarks (for optimal tree-shaking)': a barrel created for the benefit of the benchmarks, not of the public API. Together with core-entry.ts and src/index.ts, that makes three entries doing the same job.
- **core-entry.ts sitting at the repository root** — the real build entry is a single file at the top level, duplicating the role of the index.ts files inside src/ while both stay alive. Put one entry inside src/ and point the build configuration at it.
- **The .d.ts string replacement in build.js (14 regexes rewriting import paths, build.js:189-224)** — the relative paths tsc emitted into .d.ts are patched up by regex. Design tsconfig's paths / rootDir correctly, or bundle the types with api-extractor / rollup-plugin-dts, and this disappears. The existence of the replacement is itself evidence that the directory layout and the output layout do not line up.
- **exports-config.json (a generated file with content identical to package.json's exports, committed to the repository)** — build.js generates it and a human copies it into package.json by hand. Two things to keep in sync. Either have the generating script update package.json directly, or write the entries statically in the first place.
- **The coexistence of Validator<T> in src/types/index.ts and Validator<T1,T2> in src/types/valitator.ts (a typo in the file name)** — two different interfaces share a name, and util.ts imports from the misspelled file. InferType<T extends Validator<any,any>> is used by nobody.
- **Two types named ValidationOptions (the { abortEarly, messageFactory, translate, context } in src/types/index.ts and the { code, fieldName, severity, messageFactory } in src/core/plugin/types.ts)** — the second argument of validate() and the second argument of a plugin method are entirely different concepts wearing the same name, and index.ts re-exports both. Split them in a new implementation, e.g. ValidateOptions / RuleOptions.
- **Result offering both a valid property and an isValid() method, plus four ways to get the data (data() / unwrap() / unwrapOr() / unwrapOrElse())** — properties self-declared as 'Backward compatibility' remain (valid, and errors being both a property and a method). With zero users there is no compatibility debt to service. Collapsing to a discriminated union ({ ok: true; value: T } | { ok: false; errors: readonly ValidationError[] }) also fits the coding standards (no as any, prefer discriminated unions).
- **Giving the error data type a ValidationError.paths(): string[] method** — an error should be pure data; a method on it breaks serialization, structured logging and equality comparison all at once. In practice validator-factory writes a dummy paths: () => [""] every time.
- **The implementation of Result (the Object.create(successProto) + (this as any)._data prototype optimization, the ResultUtils namespace, LuqValidationException = createLuqValidationException as any as { new(...) })** — most of result.ts's 403 lines are performance optimizations that come with as any. A namespace is bad for tree-shaking. Dressing a factory function as an exception class by casting a new signature over it with as any goes directly against the no-as-any standard.
- **The 'Plugin error - ignore silently' try-catch in createValidatorFactory / attachPluginMethods (field-context.ts:365-367, validator-factory.ts:111-116)** — an exception thrown while running a plugin is swallowed and the validation silently passes. It makes bugs invisible.
- **TransformAwareValidator's validateRaw? / parseRaw? (an optional fast path)** — a separate performance API commented as 'Ultra-fast raw methods (1M+ ops/sec) - bypasses Result wrapper'. Being optional, callers have to check it exists before calling it, which makes it effectively unusable. Rather than splitting the API in two, make the normal path fast, or separate it into an explicitly different builder.
- **Three of PluginCategory's 11 values: composable / composable-conditional / composable-directly** — for the sake of exactly two plugins, tupleBuilder (composable-directly) and unionGuard (composable-conditional), the plugin types, the use overloads, FilterPluginsByType, ExtractComposablePluginMethods and attachPluginMethods all branch three ways. And unionGuard is not even published. They should be unified into the single concept "a validation that takes a child builder as an argument".
- **The hardcoded method-name branching in MapPluginMethodsToChainable (branching the types on the strings 'required' / 'optional' / 'nullable' / 'guard')** — type-state transitions are decided by string matching on the method name, so a user who writes their own plugin with methodName: 'required' silently changes the type state. Transitions should be declared through the category (or through declarative metadata on the plugin). Note also that required and optional both set the same { excludeUndefined: true } — excluding undefined for optional is a plain type bug.
- **InferMethodParameters (plugin-types.ts:336-349)** — it takes TMethod but then looks the method up again via GetPluginMethodByName<TPlugins, TMethodName>, so the first type argument TMethod, along with TObject and TCurrentType, is effectively ignored. When several plugins share a methodName, {…}[keyof TPlugins] becomes a union and inference breaks.
- **.for() passing unknown for FieldBuilder<TInputType, unknown, TPlugins, never>'s TMap** — TMap should be a Record but gets unknown as its initial value. It only happens to work because of the intersection in AddFieldTransform. The initial value must be {}.
- **The code examples in README.md** — they call build()'s return value as a function (validateUser({...})), reference result.issues, import from the nonexistent '@maroonedog/luq/plugins' and '@maroonedog/luq/core/builder/plugins/plugin-creator', and use a nonexistent category: 'custom'. Almost nothing in them matches the implementation. It must never be trusted as a source for the specification (this document is based on the source, not on the README).
- **uuidPlugin having the name 'stringUuid' while its file name, export name and public path are 'uuid'** — the sole exception to the naming convention, and the error code becomes 'stringUuid' too. A new implementation should settle on either stringUuidPlugin / ./plugins/string-uuid or uuid throughout.
- **readOnlyWriteOnly.ts defining two plugins in one file — readOnlyWriteOnlyPlugin (methodName: readOnly) and writeOnlyPlugin (methodName: writeOnly) — and publishing only the former** — this breaks one responsibility per file, and using readOnly does not give you writeOnly. readOnly and writeOnly are equal concepts in JSON Schema, so split them into two files and publish both.
- **The internal barrel src/core/plugin/index.ts and the 13 plugins that exist only there (optionalIf, orFail, stitch, stringExactLength, stringAlphanumeric, stringStartsWith, stringEndsWith, numberFinite, numberRange, objectRecursively/recursively, unionGuard, fromContext, conditionalSchema)** — they are absent from package.json's exports, so they never reach users. And yet the tests use finite() and friends, and the type system special-cases guard. The "publish or don't" decision has never been made. stitch goes as far as having three implementations — stitch.ts / stitchSimple.ts / stitch-typed.ts — coexisting under the same name: 'stitch'.

## Published symbols (216)

`Builder`, `use`, `for`, `v`, `field`, `useField`, `strict`, `strictOnEditor`, `build`, `validate`, `parse`, `pick`, `validateRaw`, `parseRaw`, `fromJsonSchema`, `string`, `number`, `boolean`, `date`, `array`, `tuple`, `union`, `object`, `any`, `refineString`, `refineNumber`, `refineBoolean`, `refineArray`, `refineObject`, `refineTuple`, `refineUnion`, `refineDate`, `guard`, `createPluginRegistry`, `createFieldRule`, `toBuilder`, `getPlugins`, `plugin`, `pluginPredefinedTransform`, `pluginConfigurableTransform`, `pluginBuilderExtension`, `Result`, `Result.ok`, `Result.error`, `ResultUtils`, `LuqValidationException`, `GlobalConfig`, `globalConfig`, `setGlobalConfig`, `getGlobalConfig`, `resetGlobalConfig`, `SEVERITY`, `FieldBuilder`, `TransformAwareValidator`, `ApplyFieldTransforms`, `ExtractFieldType`, `TypedPlugin`, `PluginType`, `PluginCategory`, `TypeName`, `TypeMapping`, `BuilderExtensionPlugin`, `BuilderExtensionMethod`, `ValidationOptions`, `ParseOptions`, `MessageContext`, `MessageFactory`, `ValidationResult`, `ValidationError`, `FieldValidator`, `FieldValidationResult`, `FieldRule`, `PluginRegistry`, `TypedPluginRegistry`, `ExtractFieldRuleType`, `FieldRuleDefinition`, `PluginImplementation`, `PluginDefinition`, `BasicValidationResult`, `PluginValidationResult`, `StandardPluginImplementation`, `ConditionalPluginImplementation`, `TransformPluginImplementation`, `FieldReferencePluginImplementation`, `MultiFieldReferencePluginImplementation`, `ArrayElementPluginImplementation`, `ContextPluginImplementation`, `PreprocessorPluginImplementation`, `ValidatorFormat`, `FieldOptions`, `FieldConfig`, `DefaultValue`, `NestedKeyOf`, `TypeOfPath`, `ElementType`, `ChainableFieldBuilder`, `FieldBuilderContext`, `FieldDefinition`, `TypeStateFlags`, `ApplyTypeState`, `AddFieldTransform`, `MissingFields`, `IChainableBuilder`, `ChainableBuilder`, `AnyPlugin`, `PluginMapFromArray`, `BuilderExtensions`, `JsonSchemaOptions`, `requiredPlugin`, `optionalPlugin`, `nullablePlugin`, `stringMinPlugin`, `stringMaxPlugin`, `stringEmailPlugin`, `stringPatternPlugin`, `stringUrlPlugin`, `stringDatePlugin`, `stringDatetimePlugin`, `stringTimePlugin`, `stringIpv4Plugin`, `stringIpv6Plugin`, `stringHostnamePlugin`, `stringDurationPlugin`, `stringBase64Plugin`, `stringJsonPointerPlugin`, `stringRelativeJsonPointerPlugin`, `stringIriPlugin`, `stringIriReferencePlugin`, `stringUriTemplatePlugin`, `stringContentEncodingPlugin`, `stringContentMediaTypePlugin`, `uuidPlugin`, `numberMinPlugin`, `numberMaxPlugin`, `numberPositivePlugin`, `numberNegativePlugin`, `numberIntegerPlugin`, `numberMultipleOfPlugin`, `booleanTruthyPlugin`, `booleanFalsyPlugin`, `arrayMinLengthPlugin`, `arrayMaxLengthPlugin`, `arrayUniquePlugin`, `arrayIncludesPlugin`, `arrayContainsPlugin`, `objectPlugin`, `objectMinPropertiesPlugin`, `objectMaxPropertiesPlugin`, `objectAdditionalPropertiesPlugin`, `objectPropertyNamesPlugin`, `objectPatternPropertiesPlugin`, `objectDependentRequiredPlugin`, `objectDependentSchemasPlugin`, `oneOfPlugin`, `literalPlugin`, `compareFieldPlugin`, `requiredIfPlugin`, `validateIfPlugin`, `skipPlugin`, `transformPlugin`, `tupleBuilderPlugin`, `readOnlyWriteOnlyPlugin`, `customPlugin`, `jsonSchemaPlugin`, `jsonSchemaFullFeaturePlugin`, `required`, `optional`, `nullable`, `min`, `max`, `email`, `pattern`, `url`, `datetime`, `time`, `ipv4`, `ipv6`, `hostname`, `duration`, `base64`, `jsonPointer`, `relativeJsonPointer`, `iri`, `iriReference`, `uriTemplate`, `contentEncoding`, `contentMediaType`, `uuid`, `positive`, `negative`, `integer`, `multipleOf`, `truthy`, `falsy`, `minLength`, `maxLength`, `unique`, `includes`, `contains`, `minProperties`, `maxProperties`, `additionalProperties`, `propertyNames`, `patternProperties`, `dependentRequired`, `dependentSchemas`, `oneOf`, `literal`, `compareField`, `requiredIf`, `validateIf`, `skip`, `transform`, `builder`, `readOnly`, `custom`
