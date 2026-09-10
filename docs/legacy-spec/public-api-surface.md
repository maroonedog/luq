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
- C:\projects\luq\src\core\plugin\types.ts, global-config.ts, index.ts, 全プラグインファイル
- C:\projects\luq\src\core\plugin\jsonSchema\{index.ts,plugin.ts}, jsonSchemaFullFeature.ts
- C:\projects\luq\package.json, exports-config.json, build.js, README.md

---

## 1. 連鎖の正確なシグネチャと型引数の流れ

### 1.1 `Builder()`
実体は `builder.ts:111` の `createBuilder`:
```ts
function createBuilder<TInput = any>(): IChainableBuilder<TInput, {}, {}>
export const Builder = createBuilder;
```
型引数は 3 本立て（`types.ts:475`）:
```ts
interface IChainableBuilder<TInput, TPlugins = {}, TAccumulatedExtensions extends object = {}>
  extends ChainableBuilder<TPlugins>
```
- `TInput` … `Builder<T>()` で先に対象型を渡す用の枠。**実際には使われていない**（`for<TInputType>()` が対象型を上書きするため、`TInput` は BuilderExtension のメソッド型生成 `CreateMethodWithBuilder` からしか参照されない）。
- `TPlugins` … プラグイン名 → プラグイン型 の **マップ型**。`use()` ごとに交差型で蓄積。
- `TAccumulatedExtensions` … builder-extension プラグインが Builder 自身に生やすメソッドの蓄積。

### 1.2 `.use(plugin)` — 型引数の流れ
`IChainableBuilder.use` は **11 個のオーバーロード**（types.ts:481-675）。分類:
1. `TypedPlugin<TName, TMethodName, TMethod, TAllowedTypes, TPluginType, TCategory>` 1個
2. `ComposablePlugin<TName, TMethodName, TAllowedTypes>` 1個
3. `ComposableConditionalPlugin<...>` 1個
4. `ComposableDirectlyPlugin<...>` 1個
5. `BuilderExtensionPlugin<TName, TMethodName, TMethodSignature>` 1個
6. 可変長 2/3/4/5 個の固定アリティ版
7. `...plugins: T` (`T extends readonly AnyPlugin[]`) の全称版

単数 TypedPlugin 版の返り型（これが正典）:
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
**型引数の流れの本質**: `use()` は「プラグインの `name` リテラルをキー、プラグイン型そのものを値」とする 1 エントリのレコードを作り、`TPlugins` に交差させて返す。これだけ。`TPlugins` は次段の `.for<T>()` に素通しされ、フィールド側で分解される。

`AnyPlugin`（types.ts:396）:
```ts
type AnyPlugin =
  | TypedPlugin<any, any, any, any, any, any>
  | ComposablePlugin<any, any, any>
  | ComposableConditionalPlugin<any, any, any>
  | ComposableDirectlyPlugin<any, any, any>
  | BuilderExtensionPlugin<any, any>;
```
複数指定版は `PluginsToMap<T> = { [K in T[number] as ExtractPluginName<K>]: K }` で一括マップ化。

`BuilderExtensionPlugin` 版だけは別扱いで、`TAccumulatedExtensions` に
`{ [K in TMethodName]: CreateMethodWithBuilder<TMethodSignature, <その時点のBuilder型>> }`
を交差させ、返り型にもそのメソッドを直接載せる。これにより `Builder().use(jsonSchemaFullFeaturePlugin).fromJsonSchema(...)` が **`.for<T>()` を経由せずに Builder 上で** 型的に生える。

### 1.3 `.for<T>()`
```ts
interface ChainableBuilder<TPlugins = {}> {
  for<TInputType extends object>(): FieldBuilder<TInputType, unknown, TPlugins, never>;
}
```
`FieldBuilder` の 4 型引数（plugin-types.ts:1240）:
```ts
interface FieldBuilder<TObject extends object, TMap = {}, TPlugins = {}, TDeclaredFields extends string = never>
```
- `TObject` … 検証対象の既存 TS 型（**制約は `extends object` のみ**）
- `TMap` … 「パス文字列 → transform 後の型」の平坦マップ。`.for()` は `unknown` で開始（`{}` ではない点に注意 — 実質バグだが `AddFieldTransform` の交差で救われている）
- `TPlugins` … Builder から素通し
- `TDeclaredFields` … 宣言済みフィールドパスの文字列ユニオン。`never` から開始し `.v()` ごとに `| Key`。`strict()` の網羅チェック専用。

### 1.4 `.v(path, definition, options?)`
`field()` の別名（`field-builder.ts:124` の `const v = field;`）。`field` は `@deprecated`、`v` が正。
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
補助型:
```ts
type FieldDefinition<TObject, TPlugins, TFieldType, TFieldBuilder> =
  (context: FieldBuilderContext<TObject, TPlugins, TFieldType>) => TFieldBuilder;

type AddFieldTransform<TMap, K extends string, TOriginal, TResult> =
  TResult extends TOriginal ? TMap : TMap & Record<K, TResult>;   // 型が変わった時だけ記録

type ExtractFieldType<T> =
  T extends ChainableFieldBuilder<any, any, any, infer TOutput> ? TOutput
  : T extends { build(): FieldValidator<any, infer TValue> } ? TValue
  : T extends FieldValidator<any, infer TValue> ? TValue : never;
```
**流れ**: `path` のリテラル → `TypeOfPath<TObject, Key>` でフィールド型を算出 → その型で `FieldBuilderContext` を作り `b` として渡す → コールバックの戻り値（連鎖の終端ビルダー型）から `ExtractFieldType` で「最終出力型」を逆算 → 元型と違えば `TMap` に `{ [path]: 新型 }` を追記 → `TDeclaredFields` に `Key` を追加。

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
**`build()` は関数を返さない。オブジェクトを返す。** validator-factory.ts:562/713/830 のいずれの経路も `{ validate, parse, pick, (validateRaw, parseRaw) }` のオブジェクトリテラル。README の `const validateUser = Builder()...build(); validateUser({...})` および `result.issues` は**実装に存在しない**（誤り）。

`ApplyFieldTransforms<TObject, TMap>` = `ApplyNestedTransforms` = `DeepMerge<T, FlatMapToNested<TMap>>`。`"a.b.c"` を `{a:{b:{c:V}}}` に展開し（`PathToNested`/`Split`）、配列先頭キーは `BuildArrayTransform` で `{ key: Array<...> }` に。**`[*]` 記法はこの変換側では扱われていない**（`Split` は `.` のみ）。つまり transform 型の反映は配列要素パスに対して不完全。

### 1.6 その他の FieldBuilder メソッド
- `useField<Key>(path, fieldRule: FieldRule<TypeOfPath<TObject,Key>>): FieldBuilder<TObject, TMap, TPlugins, TDeclaredFields | Key>` — `createPluginRegistry()` 由来の再利用ルールを差し込む
- `strict()` / `strictOnEditor()`（`strictOnEditor` は `strict` の別名、両方 `@deprecated` WIP）:
```ts
strict(): MissingFields<TObject, TDeclaredFields> extends never
  ? FieldBuilder<TObject, TMap, TPlugins, TDeclaredFields>
  : { _error: `Missing field declarations in strict mode: ${...}`; _missingFields: ... };
type MissingFields<TObject, TDeclared extends string> = Exclude<NestedKeyOf<TObject>, TDeclared>;
```
未宣言フィールドがあると**返り型がエラーオブジェクト型に化けて `.build()` が消える**という「型でエラーを出す」手法。

---

## 2. `use()` → `b.string.xxx()` が生える型レベルの仕組み（意図された設計）

これが本ライブラリの核心。5 段のパイプライン。

**段0: プラグインの型が自己記述である**
```ts
interface TypedPlugin<TName extends string, TMethodName extends string, TMethod extends Function,
                      TAllowedTypes extends readonly TypeName[] | undefined = undefined,
                      TPluginType extends PluginType = "validator",
                      TCategory extends PluginCategory = "standard"> {
  name: TName; methodName: TMethodName; create(): TMethod;
  allowedTypes?: TAllowedTypes; category: TCategory;
}
```
プラグインは値であると同時に「メソッド名・受け付ける型・カテゴリ・メソッドシグネチャ」を**リテラル型で**運ぶ。`plugin({...})` ファクトリが `as const` 由来のリテラルを保存する。

**段1: 蓄積** — `use()` が `TPlugins & { [K in TName]: TypedPlugin<...> }`。

**段2: 型による絞り込み（`FilterPluginsByType`）**
```ts
type FilterPluginsByType<TPlugins, TType extends TypeName> = {
  [K in keyof TPlugins as TPlugins[K] extends TypedPlugin<any,any,any, infer TAllowedTypes, any,any>
    ? TAllowedTypes extends readonly TypeName[]
      ? TType extends TAllowedTypes[number] ? K : never
      : K                                  // allowedTypes 未指定 = 全型許可
    : (composable系の allowedTypes 判定)
    ]: TPlugins[K];
};
```
`b.string` に入った時点で `TType = "string"` が確定し、`allowedTypes` に `"string"` を含むプラグインだけが残る。**`b.number.email()` が型エラーになるのはここ。**

**段3: メソッド抽出（`ExtractPluginMethods` → `FlattenPluginMethods`）**
```ts
type ExtractPluginMethods<TPlugins,...> = { [K in keyof TPlugins]:
  TPlugins[K] extends TypedPlugin<any, infer TMethodName, infer TMethod, any,any,any>
    ? { [P in TMethodName]: TMethod } : ... }[keyof TPlugins];
type FlattenPluginMethods<...> = UnionToIntersection<ExtractPluginMethods<...>>;
```
プラグイン名キーのマップを **methodName キーのメソッド表**に張り替え、ユニオン→交差で 1 個のオブジェクト型に潰す。`stringMinPlugin`(name:`stringMin`) が `min` として生えるのはここ。

**段4: 連鎖化（`MapPluginMethodsToChainable`）** — カテゴリで返り型と引数型を書き換える:
| category | 生成されるメソッド型 |
|---|---|
| `standard` | `(...args: Params) => ChainableFieldBuilder<同型状態>` |
| `conditional` | `(condition: (allValues: TObject) => boolean, options?: ValidationOptions) => Chainable<同>` |
| `fieldReference` | `(fieldPath: NestedKeyOf<TObject> & string, options?: ValidationOptions) => Chainable<同>` |
| `multiFieldReference` | `<const TFields extends readonly (NestedKeyOf<TObject>&string)[]>(fields, validate(fieldValues: FieldsToObject<TObject,TFields>, currentValue, allValues), options?) => Chainable<同>` |
| `transform` | `<TOutput>(fn: (value: ApplyTypeState<TCurrent,TState>) => TOutput) => ChainableFieldBuilder<..., TOutput, ...>` **←ここで TCurrentType が差し替わる** |
| `composable-conditional` + methodName `guard` + TType `"union"` | `<TGuardType extends TCurrent>(condition: (v:unknown)=>v is TGuardType, builderFn) => ChainableFieldBuilderWithUnionTracking<..., TGuardType 追加>` |
| methodName `required` / `optional` | 引数はプラグイン由来のまま、`TTypeState` に `excludeUndefined: true` |
| methodName `nullable` | `TCurrentType \| null` にし `TTypeState.excludeNull: true` |

**メソッド名によるハードコード分岐が型に埋め込まれている**（`required`/`optional`/`nullable`/`guard`）。設計意図は「型状態機械」。

**段5: 型状態（TypeStateFlags）**
```ts
interface TypeStateFlags { excludeUndefined?: boolean; excludeNull?: boolean; }
type ApplyTypeState<T, S> = S["excludeUndefined"] extends true
  ? S["excludeNull"] extends true ? NonNullable<T> : Exclude<T, undefined>
  : S["excludeNull"] extends true ? Exclude<T, null> : T;
```
`.required()` 後に `.transform(v => ...)` すると `v` が `string`（`string|undefined` ではなく）になる、というのが狙い。

**エントリポイント `FieldBuilderContext`**（`b` の型、plugin-types.ts:1090）:
```ts
type FieldBuilderContext<TObject extends object, TPlugins = {}, TFieldType = any> = {
  string:  ChainableFieldBuilder<TObject, TPlugins, "string",  string>;
  number:  ChainableFieldBuilder<TObject, TPlugins, "number",  number>;
  boolean: ChainableFieldBuilder<TObject, TPlugins, "boolean", boolean>;
  date:    ChainableFieldBuilder<TObject, TPlugins, "date",    Date>;
  array:   ChainableFieldBuilder<TObject, TPlugins, "array",   any[]>;
  tuple:   ChainableFieldBuilder<TObject, TPlugins, "tuple",   readonly any[]>;
  union:   <TFieldType がユニオンなら UnionFieldBuilderWithPlugins（guard 網羅チェック付き）、
            Array<object> を含むユニオンなら UnionArrayObjectError というエラー型>;
  object:  ChainableFieldBuilder<TObject, TPlugins, "object",  object>;
  any:     ChainableFieldBuilder<TObject, TPlugins, "any",     any>;
};
```
9 個の型入口（`TypeName` = `"string"|"number"|"date"|"array"|"union"|"tuple"|"object"|"boolean"|"null"|"any"` の 10 種のうち `null` を除く 9）。ランタイム（field-context.ts:514-522）も同じ 9 キーを持ち、`attachPluginMethods` が `plugin.allowedTypes.includes(type)` で実際に生やすメソッドを決める。**型と実行時が同じ 1 つのルール（allowedTypes）で駆動される**のが設計思想。

**`refineXxx()`**: `refineString/refineNumber/refineBoolean/refineArray/refineObject/refineTuple/refineUnion/refineDate` の 8 個が全ビルダーに常在し、`TType` を差し替えて別型のメソッド群に乗り換える。

**union 網羅チェック**:
```ts
interface UnionFieldBuilder<...> {
  build(): Exclude<TUnionType, TDeclaredTypes> extends never
    ? FieldValidator<TObject, TUnionType>
    : { _error: `Missing guard declarations for union types: ...`; _missingTypes: ... };
}
```
`.guard()` を呼ぶたび `TDeclaredTypes` にガード型が積まれ、全メンバーを網羅するまで `build()` の返り型がエラー型。

---

## 3. フィールドパス文字列の型付け

`.v()` の第1引数は `Key extends NestedKeyOf<TObject> & string`。`NestedKeyOf`（src\types\util.ts:44-68、深さ上限 5、`Depth` カウンタ方式）が生成するパス形:

| 形 | 生成条件 |
|---|---|
| `"name"` | 直下キー |
| `"user.address.street"` | `IsPlainObject<NonNullable<T[K]>> extends true` の再帰（`Function`/`Array`/`Date` は plain object でないので降りない） |
| `"tags[*]"` | `T[K] extends Array<U>` の要素そのもの |
| `"items[*].name"` | `U extends object` の再帰 |
| `"matrix[*][*]"` | 2次元配列の要素 |
| `"matrix[*][*].x"` | 2次元配列の要素オブジェクト |
| `"shipping.addresses[*].street"` | 上記の組み合わせ（テストで実在） |
| `"items[*].attributes.color"` | 配列要素内のネスト（テストで実在） |
- オプショナル配列（`NonNullable<T[K]> extends Array<U>`）も同じ扱い。
- `ExcludeArrayMethods` で `length`/`map`/`filter` 等の配列メソッド名をパス候補から除去。

対応する型解決は `TypeOfPath<T, Path>`（util.ts:70-131）。**テンプレートリテラル型のパターンマッチ**で、以下の順に判定:
`${K}[*][*][*]` → `${K}[*][*]` → `${K}[*]` → `${K}.*` → `${K}[*][*][*].${Rest}` → `${K}[*][*].${Rest}` → `${K}[*].${Rest}` → `${K}.*.${Rest}` → `${K}.${Rest}`（このケースは `T[K]` が配列なら暗黙に要素へ降りる）→ `Path extends keyof T`。
`.*` 記法（`"items.*"`, `"items.*.name"`）も型上は受理される。

`useField` と `TransformAwareValidator.pick` も同じ `NestedKeyOf`/`TypeOfPath` を使う。ただし `pick("employees[*].name" as any)` とテストで `as any` が要る＝ `pick` の `K extends NestedKeyOf<T>` は配列要素パスで壊れている。

**エラーの path 表現**: 実行時は `[*]` ではなく**実インデックスに解決**される（テスト: `result.errors[0].path === "items[2]"`）。

---

## 4. 公開エクスポート — package.json `exports` 全 58 エントリ（全件）

各エントリは `{ types: ./dist/<X>.d.ts, import: ./dist/<X>.mjs, require: ./dist/<X>.js }` の 3 条件。`exports-config.json` は build.js が生成する同一内容の複製（キー完全一致・58）。`"sideEffects": false`、`"files": ["dist"]`。

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

**存在しない（がREADMEが使っている）パス**: `@maroonedog/luq/plugins`（バレル）、`@maroonedog/luq/core/builder/plugins/plugin-creator`。README の Quick Start はそのままでは解決しない。
**存在しない（が概念上ある）パス**: `./core`。ルート `.` が `core-entry.ts`（プラグインゼロ）からビルドされるため、実質 `.` が core エントリを兼ねている。

**重要なズレ**: `src/index.ts`（全プラグイン re-export）は**出荷されていない**。build.js は `entryPoints: ["core-entry.ts"]` でルートを作る。したがって公開ルート API は core-entry.ts の内容＝ Builder + 型 + plugin ファクトリ + Result + GlobalConfig のみ。

---

## 5. 公開プラグイン全 57 件のカタログ（エクスポートシンボル / plugin.name / methodName / category / allowedTypes）

allowedTypes 表記: `ALL7` = `["string","number","boolean","array","object","date","union"]`

| # | export シンボル | name | methodName | category | allowedTypes |
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

注: `readOnlyWriteOnly.ts` は `writeOnlyPlugin`（name `writeOnly` / methodName `writeOnly` / context）も定義するが **公開エクスポートされていない**（`readOnly` しか届かない）。`uuidPlugin` は name が `stringUuid` なのに export 名・パスが `uuid` で不一致。

**内部バレル `src/core/plugin/index.ts` にはあるが公開されていないプラグイン（13）**: `optionalIfPlugin`, `orFailPlugin`, `stitchPlugin`, `stringExactLengthPlugin`, `stringAlphanumericPlugin`, `stringStartsWithPlugin`, `stringEndsWithPlugin`, `numberFinitePlugin`, `numberRangePlugin`, `objectRecursivelyPlugin`(別名 `recursivelyPlugin`), `unionGuardPlugin`, `fromContextPlugin`, `conditionalSchemaPlugin`(ファイルのみ)。テストでは `finite()` 等が使われている。`unionGuardPlugin`（name `unionGuard` / methodName `guard` / composable-conditional / `["union"]`）は**型システムが特別扱いしている（`guard` ハードコード分岐、union 網羅チェック）のに公開されていない**。

---

## 6. `fromJsonSchema` の意図

```ts
export const jsonSchemaFullFeaturePlugin: BuilderExtensionPlugin<
  "jsonSchemaFullFeature", "fromJsonSchema",
  <TBuilder extends FieldBuilder<any, any, any, any>>(
    schema: JSONSchema7 | unknown, options?: JsonSchemaOptions) => TBuilder
>
```
- `extendBuilder(builder)` が **必要な 43 プラグインを内部で `builder.use()` して**から `jsonSchemaPlugin` を use する（= ワンインポートで Draft-07 全対応）。
- `impl` 本体は `this.for()` を呼んで FieldBuilder を作り、`convertJsonSchemaToLuqDSL(schema)` の DSL 配列を `fieldBuilder.v(dslField.path, definition)` に流すだけ。**`Builder().use(...).fromJsonSchema(schema).build()`（`.for<T>()` を挟まない）が正しい形**。
- 型の `TBuilder extends FieldBuilder<any,any,any,any>` は全部 `any` — スキーマから TS 型を導く仕組みは**存在しない**。
- CSP-safe の実現手段: `eval`/`new Function` を使わず、DSL→ビルダーメソッド呼び出しに変換して実行時に組み立てる。この方針は必ず引き継ぐ。

---

## 7. 型ユーティリティの公開面（core-entry.ts が実際に出荷する全シンボル）

値: `Builder`, `createPluginRegistry`, `ValidationResult`(型のみだが value export 扱い), `plugin`, `pluginPredefinedTransform`, `pluginConfigurableTransform`, `pluginBuilderExtension`, `Result`, `GlobalConfig`, `globalConfig`, `setGlobalConfig`, `getGlobalConfig`, `resetGlobalConfig`
型: `PluginRegistry`, `FieldRule`, `ExtractFieldRuleType`, `FieldRuleDefinition`, `FieldBuilder`, `TransformAwareValidator`, `ApplyFieldTransforms`, `ExtractFieldType`, `TypedPlugin`, `PluginType`, `PluginCategory`, `TypeName`, `BuilderExtensionPlugin`, `BuilderExtensionMethod`, `ValidationOptions`, `MessageContext`, `SEVERITY`, `BasicValidationResult`(=`PluginValidationResult`), `StandardPluginImplementation`, `ConditionalPluginImplementation`, `TransformPluginImplementation`, `FieldReferencePluginImplementation`, `ArrayElementPluginImplementation`, `PluginImplementation`

（`src/index.ts` はこれに加えて全プラグインを re-export するが、前述の通り出荷対象外。）

## Contracts to preserve (24)

### must-preserve (15)

#### Builder
- Source: `C:\projects\luq\src\core\builder\core\builder.ts:111-115`
- Shape: function Builder<TInput = unknown>(): ChainableBuilder<TInput, {}, {}>
- Meaning: 引数なしのファクトリ。プラグインゼロ・拡張ゼロの Builder を返す。new 不要。呼ぶたび独立インスタンス（実装は内部 pluginMethods レコードを閉じ込めたオブジェクト）。

#### .use(plugin)
- Source: `C:\projects\luq\src\core\builder\types\types.ts:481-675 / core\builder.ts:41-101`
- Shape: use<P extends AnyPlugin>(plugin: P): Builder<TInput, TPlugins & { [K in P['name']]: P }, TExtensions & ExtensionsOf<P>>
- Meaning: プラグイン型を name リテラルをキーにして TPlugins マップに交差蓄積して返す。同名プラグインの2回目は無視（先勝ち）。可変長も受ける。実行時は plugin が object かつ name を持つことを検証し、違反時に `Invalid plugin at index N: plugin must be an object with a 'name' property` を throw、null/undefined はスキップ。

#### .for<T>()
- Source: `C:\projects\luq\src\core\builder\types\types.ts:352-359 / core\builder.ts:27-39`
- Shape: for<TInputType extends object>(): FieldBuilder<TInputType, {}, TPlugins, never>
- Meaning: 検証対象の既存 TypeScript 型を型引数だけで指定する（値としてのスキーマは渡さない）。TPlugins をそのまま FieldBuilder に引き継ぐ。TMap は空、TDeclaredFields は never で開始。

#### .v(path, definition, options?)
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:1284-1305 / core\field-builder.ts:67-124`
- Shape: v<Key extends NestedKeyOf<TObject> & string, TFieldBuilder>(path: Key, definition: (b: FieldBuilderContext<TObject, TPlugins, TypeOfPath<TObject, Key>>) => TFieldBuilder, options?: FieldConfig<TypeOfPath<TObject, Key>>): FieldBuilder<TObject, AddFieldTransform<TMap, Key, TypeOfPath<TObject,Key>, ExtractFieldType<TFieldBuilder>>, TPlugins, TDeclaredFields | Key>
- Meaning: 1フィールド1宣言。イミュータブル（毎回新しい FieldBuilder を返す）。definition は build() 時まで遅延実行される。path はリテラル型として保持され、それが TDeclaredFields と TMap のキーになる。

#### .build()
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:1133-1148, 1357-1360 / builder\validator-factory.ts:562,713,830`
- Shape: build(): TransformAwareValidator<TObject, ApplyFieldTransforms<TObject, TMap>>
- Meaning: オブジェクトを返す（関数ではない）。{ validate(value, options?): Result<T>; parse(value, options?): Result<TTransformed>; pick(key): FieldValidator<T, TypeOfPath<T,key>>; validateRaw?; parseRaw? }。validate は元型、parse は transform 適用後の型を返す。

#### FieldBuilderContext（コールバック引数 b の型）
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:1090-1128 / builder\context\field-context.ts:514-522`
- Shape: { string; number; boolean; date; array; tuple; union; object; any } の9キー。各値がその型に許可されたプラグインメソッドを持つ連鎖ビルダー
- Meaning: b.<型名> で「この型として検証する」宣言を行い、そこから型に許された検証メソッドだけが連鎖する。union は TFieldType が実際にユニオンのときだけガード網羅チェック付きビルダーになる。実行時も同じ9キーで、attachPluginMethods が allowedTypes.includes(type) で生やすメソッドを決める。

#### TypedPlugin
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:63-76`
- Shape: { name: TName; methodName: TMethodName; create(): TMethod; allowedTypes?: readonly TypeName[]; category: PluginCategory }
- Meaning: プラグインの自己記述メタデータ。型レベルの絞り込み（FilterPluginsByType）と実行時のメソッド付与（attachPluginMethods）が同じ allowedTypes を読む。name はプラグインの識別子、methodName は連鎖上のメソッド名で、両者は別物（stringMin → .min()）。

#### TypeName
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:105-115`
- Shape: "string" | "number" | "date" | "array" | "union" | "tuple" | "object" | "boolean" | "null" | "any"
- Meaning: allowedTypes の語彙。b の入口名でもある（null だけ入口がない）。

#### NestedKeyOf<T> / TypeOfPath<T, Path>
- Source: `C:\projects\luq\src\types\util.ts:44-131`
- Shape: パス文字列ユニオンの生成と、パス→型の解決。対応形: "a", "a.b.c", "a[*]", "a[*].b", "a[*][*]", "a[*][*].b", "a.b[*].c", "a[*].b.c"（深さ上限5）
- Meaning: 型付きフィールドパスの心臓部。配列メソッド名（length/map 等）はパス候補から除外。オプショナル配列も NonNullable 経由で同じ形を生む。TypeOfPath は ".*" 記法も受理する。

#### plugin() ファクトリ
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-creator.ts:77-101`
- Shape: plugin({ name, methodName, allowedTypes, category, impl }): TypedPlugin<name, methodName, impl, allowedTypes, "validator", category>
- Meaning: ユーザー定義プラグインの唯一の入口。impl は ValidatorFormat（{ check, code, getErrorMessage, params }）を返す関数。返り値に pluginName が自動注入される。

#### ValidatorFormat（プラグイン impl の戻り値）
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-interfaces.ts:26-68, 80-98`
- Shape: { check(value, allValues?, arrayContext?): boolean; code: string; getErrorMessage(value, path, allValues?, arrayContext?): string; params: any[] }
- Meaning: 検証1個の最小単位。check が false ならエラー。旧形式（(value, ctx) => { valid: boolean }）も受理される二重サポートがあるが、新実装では ValidatorFormat 一本に絞るべき。

#### pluginBuilderExtension() / BuilderExtensionPlugin
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-creator.ts:155-181 / plugin-types.ts:90-100`
- Shape: pluginBuilderExtension({ name, methodName, impl: () => Method, extendBuilder: (builder) => void }): BuilderExtensionPlugin<TName, TMethodName, TMethodSignature>
- Meaning: Builder 自身にメソッドを生やす仕組み。use() 時に extendBuilder(builder) が呼ばれ、builder[methodName] = impl が設定される。extendBuilder の中でさらに builder.use(otherPlugin) を呼べる（= プラグインバンドル）。fromJsonSchema はこの機構でのみ成立する。

#### jsonSchemaFullFeaturePlugin / .fromJsonSchema()
- Source: `C:\projects\luq\src\core\plugin\jsonSchemaFullFeature.ts:165-186 / jsonSchema\plugin.ts:42-112`
- Shape: fromJsonSchema(schema: JSONSchema7 | unknown, options?: JsonSchemaOptions): FieldBuilder<any, any, any, any>
- Meaning: Builder().use(jsonSchemaFullFeaturePlugin).fromJsonSchema(schema).build() が正しい形（.for<T>() を挟まない — impl が内部で this.for() を呼ぶ）。extendBuilder が Draft-07 に必要な43プラグインを自動 use する。CSP-safe（eval / new Function 不使用、DSL 変換 → ビルダーメソッド呼び出し）。

#### 型状態機械（required/optional/nullable/transform）
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:484-546, 906-923`
- Shape: TypeStateFlags = { excludeUndefined?: boolean; excludeNull?: boolean }; ApplyTypeState<T,S>
- Meaning: .required() 後の TCurrentType から undefined が除かれ、.nullable() で null が加わり excludeNull が立つ。.transform(fn) の fn 引数は ApplyTypeState 適用後の型、戻り値型が新しい TCurrentType になり TMap 経由で parse() の返り型に反映される。この「連鎖が型を変えていく」体験は最重要の思想。

#### package.json exports の形
- Source: `C:\projects\luq\package.json:8-... / exports-config.json / build.js:9-86,232-250`
- Shape: "." は core のみ（Builder + 型 + plugin ファクトリ）。プラグインは1つ1パス "./plugins/<pluginFileName>"。全エントリ types/import/require の3条件。sideEffects: false。
- Meaning: プラグイン単位 tree-shaking の実現手段。パス名 = ソースのファイル名 = エクスポートシンボルの Plugin 抜き（uuid だけ例外）。

### should-preserve (6)

#### PluginCategory
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:47-58`
- Shape: "standard" | "conditional" | "transform" | "fieldReference" | "multiFieldReference" | "arrayElement" | "composable" | "composable-conditional" | "composable-directly" | "context" | "builder-extension"
- Meaning: カテゴリが型レベルでメソッドの引数型と返り型を決める唯一のスイッチ。11種は多すぎる可能性があるが、standard/conditional/fieldReference/transform/builder-extension の5つは意味論として必須。

#### Result<T>
- Source: `C:\projects\luq\src\types\result.ts:82-233`
- Shape: { isValid(): boolean; isError(): boolean; readonly valid: boolean; unwrap(): T; unwrapOr(d): T; unwrapOrElse(fn): T; map(fn); flatMap(fn); tap(fn); tapError(fn); data(): T|undefined; readonly errors: ValidationError[]; toPlainObject(): { valid; data?; errors } } + Result.ok / Result.error
- Meaning: 検証結果は例外でなく Result で返す。valid プロパティと isValid() メソッドの両方を持つ（二重表現）。unwrap() は不正時に LuqValidationException を throw。

#### ValidationError
- Source: `C:\projects\luq\src\types\index.ts:26-31`
- Shape: { path: string; message: string; code: string; paths(): string[] }
- Meaning: エラー1の形。path は配列要素で実インデックスに解決される（"items[2]"）。code はプラグイン名（"required", "arrayMinLength" 等）。paths() というメソッドが型に混ざっている点は要再設計。

#### ValidationOptions / ParseOptions
- Source: `C:\projects\luq\src\types\index.ts:41-72 と C:\projects\luq\src\core\plugin\types.ts:41-47`
- Shape: ValidationOptions = { abortEarly?; abortEarlyOnEachField?; messageFactory?; translate?; context? }; ParseOptions = ValidationOptions & { transforms?: Record<string,(v)=>any> }
- Meaning: validate/parse の第2引数。注意: 同名の別物が src/core/plugin/types.ts にもあり（{ code?; fieldName?; severity?; messageFactory? }）、そちらはプラグインメソッドの第2引数（1のバリデータ設定）。2つの ValidationOptions は名前衝突しており、新実装では別名にすべき。

#### FieldOptions / FieldConfig（.v の第3引数）
- Source: `C:\projects\luq\src\core\builder\types\field-options.ts:5-100`
- Shape: FieldOptions<T> = { default?: T | (() => T); applyDefaultToNull?: boolean; description?: string; deprecated?: boolean | string; metadata?: Record<string, unknown> }; FieldConfig<T> = T | (() => T) | FieldOptions<T>
- Meaning: 検証ルールではないフィールド設定。ショートハンド（値そのもの＝default）とフルオプション形の2形態を normalizeFieldConfig が判別。default は undefined、および applyDefaultToNull !== false のとき null に適用される。

#### union guard 網羅チェック
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:790-802, 1474-1482`
- Shape: UnionFieldBuilder.build(): Exclude<TUnionType, TDeclaredTypes> extends never ? FieldValidator<...> : { _error: `Missing guard declarations for union types: ...`; _missingTypes }
- Meaning: .guard(v => v is X, b => ...) を呼ぶたび TDeclaredTypes に X が積まれ、ユニオン全メンバーを網羅するまで build() の返り型がエラーオブジェクト型になる。ユニオンに Array<object> が含まれる場合は UnionArrayObjectError 型を返して b.union 自体を使わせない。

### optional (3)

#### .useField(path, fieldRule) / createPluginRegistry()
- Source: `C:\projects\luq\src\core\registry\plugin-registry.ts:29-186`
- Shape: createPluginRegistry(): PluginRegistry<{}>; registry.use(plugin) で蓄積; registry.for<T>() で TypedPluginRegistry; registry.createFieldRule(def, options) で FieldRule<T>; builder.useField(path, rule)
- Meaning: 「フィールド単体で先に検証ルールを組み、後で複数の Builder に差し込む」再利用の思想。FieldRule<T> は単体で validate/parse できる。registry.toBuilder() で Builder に変換も可能。

#### refineXxx()
- Source: `C:\projects\luq\src\core\builder\plugins\plugin-types.ts:231-260, 722-785`
- Shape: refineString/refineNumber/refineBoolean/refineArray/refineObject/refineTuple/refineUnion/refineDate: () => ChainableFieldBuilder<..., 新TType, ...>
- Meaning: 連鎖の途中で扱う型カテゴリを切り替える。全ビルダーに常在。CanRefineToType による「同じ型への refine は never にする」実装も存在するが2系統ある（ChainableFieldBuilderTransformAware は使われていない死コード）。

#### GlobalConfig
- Source: `C:\projects\luq\src\core\global-config.ts:1-96`
- Shape: { messageKeyPrefix?; toBooleanTruthyValues?: string[]; numberFormat?: { decimalSeparator?; thousandSeparator? }; dateFormat?; trimStrings?; caseSensitive?; customTransforms?: Record<string,(v)=>any> } + globalConfig / setGlobalConfig / getGlobalConfig / resetGlobalConfig
- Meaning: プロセス全体で共有されるミュータブルなグローバル設定。tree-shaking と副作用なしの原則に反する（モジュールレベルの可変状態）ので、新実装では引き継ぐか捨てるか判断が要る。

## Behavioural rules

- Builder() は引数なし。new を使わない。呼び出しごとに独立したインスタンスを返し、内部のプラグインレコードは共有されない。
- 連鎖の順序は Builder() → .use()* → .for<T>() → .v()* → .build() で固定。.use() は .for() の前だけ、.v() は .for() の後だけ。
- use() 済みのプラグインの型情報（name / methodName / allowedTypes / category）だけで、b.<型>.<メソッド>() の存在可否・引数型・返り型がすべて決まる。実行時の attachPluginMethods も同じ allowedTypes を読むので、型と実行時の可用メソッド集合は一致しなければならない。
- プラグインの name（識別子・エラー code）と methodName（連鎖上のメソッド名）は別物。stringMin → .min()、arrayMinLength → .minLength()、stringUuid → .uuid()。異なる型カテゴリのプラグインが同じ methodName を持ってよい（stringMin と numberMin は両方 .min()、allowedTypes が排他なので衝突しない）。
- 同じプラグインを2回 use() しても2回目は無視される（name をキーにした先勝ち）。
- use() に object でない値や name を持たない値を渡すと throw する。null / undefined は無視される（現行実装）。
- .for<T>() の T は制約 extends object のみ。ユーザーの既存 TypeScript 型をそのまま渡す。スキーマの再定義は要求しない。
- フィールドパスは NestedKeyOf<T> で型チェックされ、リテラルとして保持される。対応形は "a" / "a.b.c" / "a[*]" / "a[*].b" / "a[*][*]" / "a[*][*].b" / "a.b[*].c" / "a[*].b.c"（ネスト深さ上限は現行 5）。配列の組み込みメソッド名（length, map, filter …）はパス候補から除外される。
- [*] は「配列の全要素に適用」を意味する。実行時のエラー path は [*] ではなく実インデックスに解決される（"items[2]"）。
- .v() のコールバックは build() まで遅延実行される（.v() 時点では呼ばれない）。FieldBuilder はイミュータブルで、.v() は毎回新しいインスタンスを返す。
- b の入口は型カテゴリを宣言する行為。b.string に入った瞬間、allowedTypes に "string" を含むプラグインのメソッドだけが見える。
- required / optional / nullable / transform は型状態を変える特別なメソッド名として型システムが認識する。required/optional で undefined が、nullable で null が扱いから外れ、transform の戻り値型が以降の連鎖の対象型になる。
- transform を使ったフィールドは TMap に記録され、build() が返す parse() の戻り型に反映される。validate() は常に元の型を返す。
- build() はオブジェクトを返す。{ validate, parse, pick } は必須、validateRaw / parseRaw は最適化経路がある場合のみ存在（型上は optional）。
- validate() / parse() は例外を投げず Result<T> を返す。データ取り出しは unwrap()（不正時は throw）、unwrapOr()、data() のいずれか。
- エラーは { path, message, code } の配列。code はプラグインの name。
- プラグインは副作用のない独立モジュールで、1プラグイン1ファイル1エクスポート、静的に到達可能でなければならない（tree-shaking の前提）。
- eval / new Function を一切使わない。JSON Schema の実行時読み込みも、スキーマ → 中間 DSL → ビルダーメソッド呼び出し という変換だけで行う。
- jsonSchemaFullFeaturePlugin は「1つ use() すれば Draft-07 に必要なプラグインが全部入る」バンドルとして振る舞う。use() 直後に .fromJsonSchema(schema) を呼べ、.for<T>() は不要。
- 公開エクスポートのパス名はソースのファイル名と一致させ、プラグイン1個につき1エントリ（./plugins/<name>）。ルート "." にはプラグインを含めない。

## Not carried forward

- **IChainableBuilder.use() の 11 オーバーロード（TypedPlugin / ComposablePlugin / ComposableConditionalPlugin / ComposableDirectlyPlugin / BuilderExtensionPlugin の各1本 + 2/3/4/5個の固定アリティ4本 + 可変長1本）** — プラグイン型が5種に分裂しているせいでオーバーロードが爆発している。プラグイン表現を単一の判別可能ユニオン（category による discriminated union）に統一すれば、use は「単数版1本 + 可変長版1本」の2本で済む。固定アリティ 2/3/4/5 の4本は単なる TS 推論の力技で、意味論を何も足していない。
- **IChainableBuilder の返り型に含まれる & TPlugins（プラグインマップそのものを Builder の構造に混ぜている）** — types.ts:512 等で返り型が `IChainableBuilder<...> & TAccumulatedExtensions & TPlugins & { [K in TMethodName]: TMethod }` になっており、Builder インスタンスに 'stringMin' や 'min' というプロパティが型上生えることになる。Builder に検証メソッドは生えるべきではない（生えるのは b の上だけ）。意図されていない漏れ。
- **IChainableBuilder の TInput 型引数** — Builder<T>() で型を先に渡す設計の名残だが、実際には .for<T>() が対象型を決めるので二重。CreateMethodWithBuilder の中でしか参照されず、そこでも TInput extends object かどうかを見て any にフォールバックしている。捨てて .for<T>() 一本にすべき。
- **builder.ts の実装本体（const builder: any = {...}, pluginMethods: Record<string, any>, args: any[], as any の連発、console.error / console.warn）** — 115行の中に any が10箇所以上。型定義（types.ts:475-676）と実装がまったく接続していない。ライブラリが console に出力するのも不適切。実装は型定義から作り直す。
- **field() メソッドと strictOnEditor()** — field() は v() と完全に同一（const v = field）で @deprecated 済み。strictOnEditor() は strict() の別名（const strictOnEditor = strict）。利用者ゼロなので別名を残す理由がない。v() と strict() のみにする。
- **strict() / strictOnEditor() の「エラー型を返す」実装（{ _error: `...`; _missingFields: ... }）** — 型エラーの出し方としては巧妙だが、返り型がエラーオブジェクトに化けるため IDE 上で .build() が消え、原因メッセージが型名の中に埋もれる。両メソッドとも @deprecated WIP と自己申告されている。strict の意味論（全フィールド宣言の強制）を残すなら、別の表現（never 返し＋専用のブランド型、あるいは実行時の additionalProperties）で設計し直す。
- **createFieldBuilderImpl の chainableBuilder 引数（any 型で受け取り、一切使われない）** — field-builder.ts:39 で builder を渡しているが、createFieldBuilderImpl 内では保持して再帰的に渡すだけで参照されない。純粋な死んだ依存。
- **ChainableFieldBuilderTransformAware と CanRefineToType（plugin-types.ts:192-260）** — refine メソッド群の定義が2系統ある。実際に使われるのは ChainableFieldBuilderBase 側（722-785）で、CanRefineToType による「同型への refine を never にする」精緻版は誰からも参照されない死コード。
- **AsyncContext / AsyncAwareValidator / AsyncEnhancedBuilder / AsyncContextAwareValidation / AsyncPluginMethods / ExampleAsyncContext（types.ts:690-797）** — types.ts の末尾100行を占めるが、Builder / FieldBuilder のどこからも参照されていない。buildWithAsyncSupport() の実装も存在しない。AsyncPluginMethods に至っては checkDuplication / validateMx / checkQuota という具体的なドメイン名が型として置いてある（サンプルコードの残骸）。非同期検証をやるなら白紙から設計する。
- **src/index.ts（163行、全プラグインを re-export するルートバレル）** — build.js が entryPoints: ["core-entry.ts"] でルートを作るため、src/index.ts は出荷されていない。存在しないエントリを保守している状態。ルートは core のみという方針（これは正しい）に合わせ、ルートバレルはプラグインを含めない1本にする。
- **src/core/index.ts（89行、「ベンチマークで使うプラグインだけ」を選んで re-export）** — コメントに 'Export only plugins used in benchmarks (for optimal tree-shaking)' とあるとおり、公開APIの都合ではなくベンチマークの都合で作られたバレル。core-entry.ts / src/index.ts と合わせて同じことをする入口が3つある。
- **core-entry.ts がリポジトリルートに置かれていること** — ビルドの実エントリがルート直下の1ファイルにあり、src/ の中の index.ts 群と役割が重複したまま両方生きている。エントリは src/ の中に1つ置き、build 設定がそれを指す形にする。
- **build.js の .d.ts 文字列置換（14個の正規表現で import パスを書き換える処理、build.js:189-224）** — tsc が出した .d.ts の相対パスを正規表現で手当てしている。tsconfig の paths / rootDir を正しく設計するか、api-extractor / rollup-plugin-dts で型をバンドルすれば不要。この置換の存在自体が、ディレクトリ構成と出力構成が噛み合っていない証拠。
- **exports-config.json（package.json の exports と完全同一の内容を持つ生成物がリポジトリにコミットされている）** — build.js が生成し、人間が package.json に手でコピーする運用。二重管理。生成スクリプトが package.json を直接更新するか、そもそもエントリを静的に書く。
- **src/types/index.ts の Validator<T> と src/types/valitator.ts（ファイル名タイポ）の Validator<T1,T2> の並存** — 同名の別インターフェースが2つあり、util.ts は タイポしたファイル名の方から import している。InferType<T extends Validator<any,any>> も誰も使っていない。
- **ValidationOptions という名前の型が2つ（src/types/index.ts の { abortEarly, messageFactory, translate, context } と src/core/plugin/types.ts の { code, fieldName, severity, messageFactory }）** — validate() の第2引数とプラグインメソッドの第2引数という完全に別の概念に同じ名前がついていて、index.ts では両方を re-export している。新実装では ValidateOptions / RuleOptions のように分ける。
- **Result の valid プロパティと isValid() メソッドの二重提供、および data() / unwrap() / unwrapOr() / unwrapOrElse() の4系統** — 'Backward compatibility' と自己申告されたプロパティ（valid、errors がプロパティでもメソッドでもある混在）が残っている。利用者ゼロなので互換性の債務は不要。判別可能ユニオン（{ ok: true; value: T } | { ok: false; errors: readonly ValidationError[] }）に一本化するのが規約（as any 禁止 / 判別可能ユニオン推奨）にも合う。
- **ValidationError.paths(): string[] というメソッドをエラーデータ型に持たせていること** — エラーは純粋なデータであるべきで、メソッドを持つとシリアライズ・構造化ログ・等価比較がすべて壊れる。実際 validator-factory は paths: () => [""] というダミーを毎回書いている。
- **Result の実装（Object.create(successProto) + (this as any)._data のプロトタイプ最適化、ResultUtils namespace、LuqValidationException = createLuqValidationException as any as { new(...) }）** — result.ts 403行のうち大半が as any を伴う性能最適化。namespace は tree-shaking に不利。例外クラスをファクトリ関数に as any で new シグネチャを被せる手口は規約の as any 禁止に真正面から反する。
- **createValidatorFactory / attachPluginMethods の 'Plugin error - ignore silently' な try-catch（field-context.ts:365-367、validator-factory.ts:111-116）** — プラグイン実行時の例外を握り潰し、検証が黙って通る。バグを不可視化する。
- **TransformAwareValidator の validateRaw? / parseRaw?（optional な高速パス）** — 'Ultra-fast raw methods (1M+ ops/sec) - bypasses Result wrapper' とコメントされた性能用の別API。optional なので利用者は存在を確認してから呼ぶ必要があり、実質使えない。API を2本に割るのではなく、通常経路を速くするか、明示的に別ビルダーに分ける。
- **PluginCategory の 11 値のうち composable / composable-conditional / composable-directly の3つ** — tupleBuilder（composable-directly）と unionGuard（composable-conditional）の2プラグインのためだけに、プラグイン型・use のオーバーロード・FilterPluginsByType・ExtractComposablePluginMethods・attachPluginMethods のすべてが3分岐している。しかも unionGuard は公開エクスポートされていない。'子ビルダーを引数に取る検証' という1つの概念に統合すべき。
- **MapPluginMethodsToChainable のメソッド名ハードコード分岐（'required' / 'optional' / 'nullable' / 'guard' という文字列で型を分岐）** — 型状態の遷移をメソッド名の文字列一致で決めているため、利用者が methodName: 'required' のプラグインを自作すると勝手に型状態が変わる。遷移はカテゴリ（あるいはプラグイン側の宣言的なメタデータ）で表明させるべき。なお required と optional が同じ { excludeUndefined: true } を立てている（optional なのに undefined を除く）のは明確な型バグ。
- **InferMethodParameters（plugin-types.ts:336-349）** — TMethod を受け取りながら実際には GetPluginMethodByName<TPlugins, TMethodName> で引き直しており、第1型引数 TMethod・TObject・TCurrentType が事実上無視されている。同じ methodName を複数プラグインが持つと {…}[keyof TPlugins] がユニオンになって推論が崩れる。
- **.for() が FieldBuilder<TInputType, unknown, TPlugins, never> と TMap に unknown を渡していること** — TMap は Record であるべきところに unknown が初期値として入っている。AddFieldTransform の交差型でたまたま動いているだけ。初期値は {} でなければならない。
- **README.md のコード例** — build() の戻り値を関数として呼び（validateUser({...})）、result.issues を参照し、存在しない '@maroonedog/luq/plugins' と '@maroonedog/luq/core/builder/plugins/plugin-creator' から import し、存在しない category: 'custom' を使っている。実装と一致する箇所がほぼない。仕様の出典として一切信用してはならない（本仕様書は README ではなくソースを根拠にしている）。
- **uuidPlugin の name が 'stringUuid' なのにファイル名・エクスポート名・公開パスが 'uuid' であること** — 命名規約の唯一の例外で、エラー code も 'stringUuid' になる。新実装では stringUuidPlugin / ./plugins/string-uuid に揃えるか uuid に揃えるか、どちらかに統一する。
- **readOnlyWriteOnly.ts が readOnlyWriteOnlyPlugin（methodName: readOnly）と writeOnlyPlugin（methodName: writeOnly）の2プラグインを1ファイルで定義し、後者を公開していないこと** — 1ファイル1責務に反し、readOnly を use しても writeOnly が使えない。JSON Schema の readOnly / writeOnly は対等な概念なので2ファイルに分けて両方公開する。
- **内部バレル src/core/plugin/index.ts と、そこにしかない13プラグイン（optionalIf, orFail, stitch, stringExactLength, stringAlphanumeric, stringStartsWith, stringEndsWith, numberFinite, numberRange, objectRecursively/recursively, unionGuard, fromContext, conditionalSchema）** — package.json の exports に無いので利用者には届かない。にもかかわらずテストは finite() 等を使い、型システムは guard を特別扱いしている。'公開する / しない' の判断が一度もされていない状態。stitch に至っては stitch.ts / stitchSimple.ts / stitch-typed.ts の3実装が同じ name: 'stitch' で並存している。

## Published symbols (216)

`Builder`, `use`, `for`, `v`, `field`, `useField`, `strict`, `strictOnEditor`, `build`, `validate`, `parse`, `pick`, `validateRaw`, `parseRaw`, `fromJsonSchema`, `string`, `number`, `boolean`, `date`, `array`, `tuple`, `union`, `object`, `any`, `refineString`, `refineNumber`, `refineBoolean`, `refineArray`, `refineObject`, `refineTuple`, `refineUnion`, `refineDate`, `guard`, `createPluginRegistry`, `createFieldRule`, `toBuilder`, `getPlugins`, `plugin`, `pluginPredefinedTransform`, `pluginConfigurableTransform`, `pluginBuilderExtension`, `Result`, `Result.ok`, `Result.error`, `ResultUtils`, `LuqValidationException`, `GlobalConfig`, `globalConfig`, `setGlobalConfig`, `getGlobalConfig`, `resetGlobalConfig`, `SEVERITY`, `FieldBuilder`, `TransformAwareValidator`, `ApplyFieldTransforms`, `ExtractFieldType`, `TypedPlugin`, `PluginType`, `PluginCategory`, `TypeName`, `TypeMapping`, `BuilderExtensionPlugin`, `BuilderExtensionMethod`, `ValidationOptions`, `ParseOptions`, `MessageContext`, `MessageFactory`, `ValidationResult`, `ValidationError`, `FieldValidator`, `FieldValidationResult`, `FieldRule`, `PluginRegistry`, `TypedPluginRegistry`, `ExtractFieldRuleType`, `FieldRuleDefinition`, `PluginImplementation`, `PluginDefinition`, `BasicValidationResult`, `PluginValidationResult`, `StandardPluginImplementation`, `ConditionalPluginImplementation`, `TransformPluginImplementation`, `FieldReferencePluginImplementation`, `MultiFieldReferencePluginImplementation`, `ArrayElementPluginImplementation`, `ContextPluginImplementation`, `PreprocessorPluginImplementation`, `ValidatorFormat`, `FieldOptions`, `FieldConfig`, `DefaultValue`, `NestedKeyOf`, `TypeOfPath`, `ElementType`, `ChainableFieldBuilder`, `FieldBuilderContext`, `FieldDefinition`, `TypeStateFlags`, `ApplyTypeState`, `AddFieldTransform`, `MissingFields`, `IChainableBuilder`, `ChainableBuilder`, `AnyPlugin`, `PluginMapFromArray`, `BuilderExtensions`, `JsonSchemaOptions`, `requiredPlugin`, `optionalPlugin`, `nullablePlugin`, `stringMinPlugin`, `stringMaxPlugin`, `stringEmailPlugin`, `stringPatternPlugin`, `stringUrlPlugin`, `stringDatePlugin`, `stringDatetimePlugin`, `stringTimePlugin`, `stringIpv4Plugin`, `stringIpv6Plugin`, `stringHostnamePlugin`, `stringDurationPlugin`, `stringBase64Plugin`, `stringJsonPointerPlugin`, `stringRelativeJsonPointerPlugin`, `stringIriPlugin`, `stringIriReferencePlugin`, `stringUriTemplatePlugin`, `stringContentEncodingPlugin`, `stringContentMediaTypePlugin`, `uuidPlugin`, `numberMinPlugin`, `numberMaxPlugin`, `numberPositivePlugin`, `numberNegativePlugin`, `numberIntegerPlugin`, `numberMultipleOfPlugin`, `booleanTruthyPlugin`, `booleanFalsyPlugin`, `arrayMinLengthPlugin`, `arrayMaxLengthPlugin`, `arrayUniquePlugin`, `arrayIncludesPlugin`, `arrayContainsPlugin`, `objectPlugin`, `objectMinPropertiesPlugin`, `objectMaxPropertiesPlugin`, `objectAdditionalPropertiesPlugin`, `objectPropertyNamesPlugin`, `objectPatternPropertiesPlugin`, `objectDependentRequiredPlugin`, `objectDependentSchemasPlugin`, `oneOfPlugin`, `literalPlugin`, `compareFieldPlugin`, `requiredIfPlugin`, `validateIfPlugin`, `skipPlugin`, `transformPlugin`, `tupleBuilderPlugin`, `readOnlyWriteOnlyPlugin`, `customPlugin`, `jsonSchemaPlugin`, `jsonSchemaFullFeaturePlugin`, `required`, `optional`, `nullable`, `min`, `max`, `email`, `pattern`, `url`, `datetime`, `time`, `ipv4`, `ipv6`, `hostname`, `duration`, `base64`, `jsonPointer`, `relativeJsonPointer`, `iri`, `iriReference`, `uriTemplate`, `contentEncoding`, `contentMediaType`, `uuid`, `positive`, `negative`, `integer`, `multipleOf`, `truthy`, `falsy`, `minLength`, `maxLength`, `unique`, `includes`, `contains`, `minProperties`, `maxProperties`, `additionalProperties`, `propertyNames`, `patternProperties`, `dependentRequired`, `dependentSchemas`, `oneOf`, `literal`, `compareField`, `requiredIf`, `validateIf`, `skip`, `transform`, `builder`, `readOnly`, `custom`

