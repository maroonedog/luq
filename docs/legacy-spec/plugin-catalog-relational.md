# plugin-catalog-relational

## 全体像

この領域は「単一フィールドの値だけでは判定できない検証」と「値の書き換え」を扱う。既存実装は 5 つの独立した意味論クラスタに分かれる。

1. **フィールド参照 (fieldReference)** — `compareField`。自フィールド値と、ドット記法で指定した他フィールドの値を比較関数で突き合わせる。
2. **多フィールド参照 (multiFieldReference)** — `stitch`。フィールドパスのタプルを受け取り、それらを `{ [path]: 値 }` のオブジェクトに束ねてユーザー関数に渡す。型レベルで `FieldsToObject<TObject, TFields>` により各フィールドの実型が復元されるのが本質的価値。
3. **条件分岐 (conditional)** — `validateIf` / `requiredIf` / `optionalIf` / `skip` / `orFail`。全て `(allValues) => boolean` を取り、検証の実行有無・必須性・強制失敗を制御する。
4. **コンテキスト参照 (context)** — `fromContext`。非同期に解決した外部データ(DB 重複チェック等)を検証に持ち込むための入口。
5. **変換 (transform)** — `transform`。値を書き換え、**型レベルで出力型を伝播させる**。`.build()` の戻り型 `TransformAwareValidator<TObject, ApplyFieldTransforms<TObject, TMap>>` に反映され、`parse()` の戻り型が変わる。

加えて `custom`(任意述語)、`conditionalSchema`(JSON Schema if/then/else) がこの領域に属する。

## 実行順序 — 実測した「唯一の真実」

`Builder().…​.build()` の本流は `validator-factory.ts` → `createUnifiedValidator`(`src/core/optimization/unified-validator.ts`)。3 つの実行パス (`createUltraFastValidator` / `createOptimizedTransformValidator` / `executeFastSeparated` / `executeDefinitionOrder`) すべてで順序は同一:

1. **フィールドオプションの default 適用**(`.v(path, def, defaultValue)` の第3引数。`undefined`、および `applyDefaultToNull !== false` のとき `null` に適用)。`validate()` / `parse()` 両方で最初に行われる。
2. **`skipForNull` / `skipForUndefined` の短絡** — `nullable()` が付いた field に `null`、`optional()` が付いた field に `undefined` が来たら、**検証も変換も丸ごとスキップ**し、parse では元値をそのまま返す。
3. **全 validator を登録順に実行**。`shouldSkipAllValidation`(= `validateIf` / `skip`)が true を返した時点で `break` し、**それ以降の** validator を全てスキップする。→ `validateIf` / `skip` はチェーンの先頭に置かないと意味がない(位置依存)。
4. validator が 1 つでも失敗したら終了(`abortEarlyOnEachField` 既定 true なら最初の 1 件で即 return)。
5. **`mode === parse` のときだけ**、transform を登録順に合成適用。

したがって現行の確定意味論は **「検証が先、変換が後」**、かつ **「`validate()` は変換を一切行わず、元データをそのまま `Result.ok` する」**(`validator-factory.ts` の単一フィールド版 `validate` は `Result.ok(value as TObject)` を返す)。`.transform(f).min(3)` と書いても `min(3)` は変換前の値に対して走る。チェーン上の記述位置は実行順序に影響しない(validator 配列と transform 配列が別々に積まれるだけ)。

**注意:** `test/unit/plugins/common/transform.test.ts` は逆(「変換が先、`validate()` が変換済みデータを返す」)を assert しており、これは現行実装では通らない腐ったテスト。`src/core/registry/plugin-registry.ts` の `FieldRule.parse` フォールバックだけが「変換が先」で実装されており、本流と矛盾している(そこが参照する `_executionPlan` は `field-context.ts` のコメント「removed ExecutionPlan for bundle size」の通り生成されないため、常にこのフォールバックが走る)。**新実装では順序を 1 つに決めて全経路で守ること。**

## transform の型意味論

- チェーンメソッド型: `<TOutput>(fn: (value: ApplyTypeState<TCurrent, TTypeState>) => TOutput) => ChainableFieldBuilder<..., TOutput, ...>`。入力型は `required()`/`nullable()` による null/undefined 除去状態を反映した現在型、出力型 `TOutput` が以降のチェーンの現在型になる。連鎖 transform は型も合成される。
- `.v()` は `ExtractFieldType<TFieldBuilder>` で最終 `TOutput` を取り出し、`AddFieldTransform<TMap, Key, 元の型, TOutput>` で **型が実際に変わった場合のみ** `TMap` に `Record<path, TOutput>` を足す。
- `.build()` は `TransformAwareValidator<TObject, ApplyFieldTransforms<TObject, TMap>>` を返す。`ApplyFieldTransforms` = `DeepMerge<TObject, FlatMapToNested<TMap>>` で、ドット記法パス(`a.b.c`)と配列パスをネスト型に展開してから元型に深くマージする。→ `validate()` は `Result<TObject>`、`parse()` は `Result<変換後型>`。
- **禁止された出力型**: `Array<プレーンオブジェクト>` と `Array<プレーンオブジェクトを含むユニオン>`。`IsForbiddenTransformOutput<T>` が true になると引数型が関数ではなくエラー文字列リテラル型 `"🚫 FORBIDDEN: Cannot transform to Array<object>. …"` に置き換わり、代入不能によりコンパイルエラーになる。理由はネスト配列サポートの実装都合(コメントに明記)。`Array<string|number>`、`Date[]`、`RegExp[]`、関数の配列、配列の配列は許可。

## messageFactory の仕組み

- 型: `MessageFactory<TContext> = (ctx: MessageContext & TContext) => string`、`MessageContext = { path: string; value: any; code: string }`。プラグインごとに `TContext` を足して文脈を拡張する(compareField は `{ fieldPath, targetValue }`、stitch は `{ fields, fieldValues, allValues }`、requiredIf/optionalIf/validateIf は `{ condition: boolean }`)。
- 共通オプション `ValidationOptions = { code?: string; fieldName?: string; severity?: Severity; messageFactory?: MessageFactory }`。`Severity = "INFO" | "WARN" | "ERROR"`(定数 `SEVERITY`)。ただし `fieldName` / `severity` は実行時にどこからも読まれていない。
- 実行時の解決は `computeErrorMessage`(unified-validator): `validator.getErrorMessage(value, path, rootData)` を優先、無ければ `validator.messageFactory({path, value, code})`、どちらも例外を投げたら `` `Validation failed for ${path}` ``。
- code の解決: `validator.code || validator.pluginName || "VALIDATION_ERROR"`。
- `src/core/plugin/message-factories.ts` の `resolveMessage` は完全な死にコード(冒頭コメントが参照する `reporter.ts` は存在せず、import 元もゼロ)。

## プラグイン別 既定コード / 既定メッセージ(全件)

| メソッド | category | 既定 code | メッセージ決定規則 | messageFactory に渡る文脈 |
|---|---|---|---|---|
| `compareField(fieldPath, opts?)` | fieldReference | `"equals"` | `` `Value must be equal to ${fieldPath}` ``(fieldPath 未指定時のみ `"Values must be equal"`、実際には到達しない) | `{path, value, code, fieldPath, targetValue}` |
| `stitch(fields, validate, opts?)` | multiFieldReference | `"stitch_validation_failed"` | ① `validate()` の戻り `message` ② `messageFactory(...)` ③ `` `Cross-field validation failed for ${path}` ``。`allValues` が無い場合は `"Cross-field validation failed - no form data available"` | `{path, value, code, fields, fieldValues, allValues}` |
| `orFail(condition, opts?)` | conditional | `"validation_error"` | ① `opts.message`(生文字列) ② `messageFactory({path,value,code,message})` ③ 既定 `"Validation failed"` | `{path, value, code, message}` |
| `custom(validator, opts?)` | standard | `"CUSTOM_VALIDATION_FAILED"` | ① validator が `{valid,message}` を返した場合その `message` ② `messageFactory({path,value,code})` ③ `` `${path} custom validation failed` `` | `{path, value, code}` |
| `fromContext(options)` | context | `"context_validation"` | context 有: `validate().message` → `errorMessage` → `"Context validation failed"`。context 無 & `required`: `errorMessage` → `"Context data is required for validation"`。例外時: `errorMessage` → `` `Context validation error: ${error}` `` | messageFactory 非対応(`errorMessage` 文字列のみ) |
| `requiredIf(condition, opts?)` | conditional | `"requiredIf"` | 既定 `"Field is required when condition is met"` | `{path, value, code, condition}` |
| `optionalIf(condition, opts?)` | conditional | `"optionalIf"`(**`opts.code` を無視**) | 固定 `"Field is optional when condition is met"`(**messageFactory を無視**) | — |
| `validateIf(condition, opts?)` | conditional | `"validateIf"` | `getErrorMessage` が `throw new Error(...)`(エラーを生成しない前提) | — |
| `skip(condition, opts?)` | conditional | `"skip"` | 到達しない `"Skip condition not met"`(**opts 完全無視**) | — |
| `transform(fn)` | transform | `"transform"` | 到達しない `"Transform operation failed"`。transform 内の例外はキャッチされず**そのまま伝播**する | — |
| `conditionalSchema(options)` | standard(object 限定) | `"CONDITIONAL_SCHEMA"` | if 成立 & then あり → `` `Value at ${path} must match "then" schema` ``、if 不成立 & else あり → `` …"else" schema` ``、それ以外 `` `Conditional validation failed at ${path}` `` | `{path, value, code}` |

## 各プラグインの検証意味論(詳細)

**compareField(fieldPath, { compareFn?, code?, messageFactory? })**
`createFieldAccessor(fieldPath)` でドット記法パスをオプショナルチェーン合成関数に事前コンパイルし、`allValues` から対象値を取る。`compareFn(value, targetValue)` の既定は `===`(厳密等価)。`allValues` が渡らない場合は **false(失敗)**。用途は password/confirmPassword、開始日/終了日、min/max。allowedTypes = string, number, boolean, date, object, array, tuple, union(JSDoc の `["…","null","undefined"]` は嘘)。

**stitch(fields, validate, options?)**
`fields` は `readonly (NestedKeyOf<TObject> & string)[]` の const タプル。`createBatchAccessors` で各パスのアクセサを事前生成し、`{ [fieldPath]: 値 }` を組んで `validate(fieldValues, currentValue, allValues)` を呼ぶ。戻りは `{ valid: boolean; message?: string }`。`allValues` 無しなら **false**。解こうとしていた課題は「複数フィールドを参照する検証を、`allValues` を丸ごと any で受け取るのではなく、**参照するフィールドを宣言し、その型だけを型安全に受け取る**」こと。これが compareField(1 対 1)と custom(型なし全体アクセス)の中間として存在する理由。

**orFail(condition, options?)**
「条件が真なら値に関わらず無条件で失敗」。deprecated フィールド、本番環境で存在してはいけないデバッグフィールド、権限が無いユーザーが触れないフィールド、feature flag off の項目を表現するための **否定的ゲート**。`check` は `!condition(allValues)` を返す。`allValues` が無い場合は **true(通過)**(compareField/stitch と逆の既定)。

**custom(validator, options?)**
`validator: (value, rootData?) => boolean | { valid: boolean; message?: string }`。validator が throw したら **失敗として扱う**(例外は握り潰される)。`rootData` は検証中のルートオブジェクト全体。

**fromContext(options)**
意図は「非同期に取得した外部データ(メール重複、在庫、権限)を検証に持ち込む」。`ContextValidationOptions = { validate(value, context, allValues): {valid, message?}; errorMessage?; code?; required?(既定 false); fallbackToValid?(既定 true) }`。意図された使い方は `validator.withAsyncContext(ctx).validate(data)`。
**現行実装では非同期コンテキストは本流に接続されていない。** hoisted な `check` は `if (allValues && !required) contextData = allValues` としているだけで、`required: true` を指定すると `contextData` が常に未設定になり **必ず false を返す**。`performContextValidation`(`getAsyncContext(ctx)` を使う真の実装)はオブジェクト上に保持されるだけで、どの実行パスからも呼ばれない。`createAsyncContext` / `addAsyncSupport` / `withAsyncContext` は `src/index.ts` から export されておらず公開 API ですらない。

**validateIf / skip**
どちらも `shouldSkipAllValidation` を提供し、unified-validator の validator ループで true を返した時点で `break`。**それより前に登録された validator は既に実行済み**。両者の違いは意味論上のニュアンス(「条件が真のときだけ検証する」vs「条件が真なら検証しない」)だけで、実装上は条件の極性が逆なだけ。

**requiredIf**
条件が真なら `value !== undefined && value !== null && value !== ""` を要求。偽なら常に通過。`allValues` が無い場合は通過。

**optionalIf**
条件が真かつ値が空(`undefined`/`null`/`""`)→ 通過。条件が偽かつ値が空 → **失敗**(= 必須になる)。値があれば常に通過。`shouldSkipValidation` フックを持つが unified-validator は `shouldSkipAllValidation` しか呼ばないため、**「以降の検証をスキップする」意味論は実装されていない**。

**conditionalSchema({ ifSchema, thenSchema?, elseSchema?, validator? })**
JSON Schema Draft-07 の if/then/else。`null`/`undefined` は無条件通過。`validator` が渡されればそれで、無ければ内蔵 `evaluateSchema` で判定。内蔵版が見るのは `type`(`integer` を別型として判別)、`properties` 内の `const`/`enum` のみ、トップの `const`、トップの `enum` だけ。then/else が無い分岐は通過。**どの index.ts からも export されていない**。

## ArrayContext — 宣言されているが機能していない

`ArrayContext = { index: number; item: TItem; array: TItem[] }`。`requiredIf` / `optionalIf` / `validateIf` は条件関数の第2引数として受け取る設計で、JSDoc にも `items[].billingAddress` の例が載っている。しかし本流では `check(value, rootData)` / `getErrorMessage(value, path, rootData)` の 3 引数しか渡されず、**arrayContext は常に undefined**。配列要素の検証(`parseArrayElementField`)でも `validator.parse(elementValue, transformedData)` としてルートオブジェクトを渡すだけで、要素の index も item も渡していない。`validation-engine.ts` だけが arrayContext を伝播するが、本流はこのファイルを使っていない(`array-batch-validator.ts` が型だけ import している)。

## 公開表面の不整合(実測)

`src/index.ts`(パッケージのメインエントリ)は **`stitchPlugin` / `orFailPlugin` / `fromContextPlugin` / `optionalIfPlugin` を export していない**。`src/core/plugin/index.ts` は `stitchPlugin` / `orFailPlugin` / `fromContextPlugin` / `optionalIfPlugin` を export するが `conditionalSchemaPlugin` を export しない。`package.json` の `exports` サブパスには `./plugins/compareField` / `./plugins/transform` / `./plugins/custom` はあるが `./plugins/stitch` / `./plugins/orFail` / `./plugins/fromContext` は無い。つまり **stitch / orFail / fromContext は 3 つの公開経路のどこからも到達できない**。新実装ではこの 3 経路を単一の生成元から導出すること。

## 完全に死んでいるコード(この領域)

- `src/core/transform/`(`index.ts` / `string/index.ts` / `sanitize.ts` / `replace.ts` / `defaultValue.ts`)— `src/` 内のどこからも import されていない。テストだけが参照。
- `src/core/plugin/message-factories.ts` の `resolveMessage`。
- `src/core/plugin/stitchSimple.ts`(`stitchSimplePlugin`)と `src/core/plugin/stitch-typed.ts`(`stitchPluginTyped` / `createStitchValidator`)— `stitch.ts` と同じ `methodName: "stitch"` を持つ 3 重実装。
- `src/core/async.experimental/from-context-plugin.ts` の `fromContextPlugin` — `src/core/plugin/fromContext.ts` と同名で、`plugin()` を使わない旧形式(`createMethod`)。プラグインシステムと互換性がない。
- `fromContext.ts` の助手群 `emailDuplicationCheck` / `passwordConfirmation` / `inventoryCheck` / `conditionalRequired` / `createTypedContextValidator` / `ContextValidationTemplates` — どこからも使われず export もされていない、事実上のサンプルコード。
- `types.ts` のフラグ型と型ガード群(`SkipAllValidationFlag`, `SkipFurtherValidationFlag`, `TransformFlag`, `NullableFlag`, `RecursiveFlag`, `ValidationResultWithFlags`, `WithFlags`, `ValidationFlags`)— 実行時は `shouldSkipAllValidation` / `__isTransform` / `skipForNull` といった別機構で処理されており、これらの型ガードは呼ばれていない。
- `ValidatorFormat` の未使用マーカー `__isDefault` / `__isPreprocess` / `__isCoerce` / `__isStitch` / `__stitchOptions`。対応するプラグインが存在しない。

## 引き継ぐ契約 (23件)

### must-preserve (12)

#### compareField
- 出典: `src/core/plugin/compareField.ts`
- 形: b.<type>.compareField(fieldPath: NestedKeyOf<TObject> & string, options?: { compareFn?: (value, targetValue) => boolean; code?: string; messageFactory?: (ctx: { path; value; code; fieldPath; targetValue }) => string })
- 意味: ドット記法パスで指定した他フィールドの値を allValues から取り出し、compareFn(自値, 相手値) で判定する。compareFn の既定は厳密等価 (===)。allValues が得られない場合は失敗。既定 code は "equals"、既定メッセージは `Value must be equal to ${fieldPath}`。

#### compareFieldPlugin
- 出典: `src/core/plugin/compareField.ts`
- 形: export const compareFieldPlugin (name: "compareField", methodName: "compareField", category: "fieldReference", allowedTypes: string|number|boolean|date|object|array|tuple|union)
- 意味: Builder().use(compareFieldPlugin) で .compareField() を生やす公開シンボル。src/index.ts / src/core/plugin/index.ts / package.json exports "./plugins/compareField" の 3 経路すべてから到達可能。

#### stitch
- 出典: `src/core/plugin/stitch.ts`
- 形: b.<type>.stitch<const TFields extends readonly (NestedKeyOf<TObject> & string)[]>(fields: TFields, validate: (fieldValues: FieldsToObject<TObject, TFields>, currentValue, allValues: TObject) => { valid: boolean; message?: string }, options?: { code?: string; messageFactory?: (ctx: { path; value; code; fields; fieldValues; allValues }) => string })
- 意味: 位置引数 3 つ。宣言したフィールドパス群の値を { [path]: 値 } に束ねて validate に渡す。fieldValues は FieldsToObject により各パスの実型が復元される(型安全が本質価値)。エラーメッセージは validate() の message が最優先、次に messageFactory、最後に `Cross-field validation failed for ${path}`。allValues 無しなら失敗。既定 code "stitch_validation_failed"。

#### FieldsToObject<T, K>
- 出典: `src/types/stitch-types.ts`
- 形: type FieldsToObject<T, K extends readonly (NestedKeyOf<T> & string)[]> = { [P in K[number]]: TypeOfPath<T, P> }
- 意味: フィールドパスのタプルから、そのパス群の実型を持つオブジェクト型を構築する。stitch の型安全性の中核。

#### transform
- 出典: `src/core/plugin/transform.ts, src/core/builder/plugins/plugin-types.ts:470-483`
- 形: b.<type>.transform<TOutput>(fn: (value: 現在型) => TOutput): ChainableFieldBuilder<..., TOutput, ...>
- 意味: 値を書き換え、チェーンの現在型を TOutput に差し替える。実行時は validator とは別配列に積まれ、全 validator が成功した後にのみ、登録順に合成適用される。parse() でのみ実行され、validate() では実行されない。transform 内の例外はキャッチされずそのまま伝播する。連鎖可能。

#### TransformAwareValidator<T, TTransformed>
- 出典: `src/core/builder/plugins/plugin-types.ts:1133`
- 形: interface TransformAwareValidator<T extends object, TTransformed = T> { validate(value, options?): Result<T>; parse(value, options?): Result<TTransformed>; pick<K extends NestedKeyOf<T>>(key: K): FieldValidator<T, TypeOfPath<T, K>>; validateRaw?(value, options?): boolean; parseRaw?(value, options?): { valid; data?; error? } }
- 意味: .build() の戻り型。validate は元の型 T を返し(変換を適用しない)、parse は変換後の型を返す、という二本立てが公開契約。

#### ApplyFieldTransforms<TObject, TMap>
- 出典: `src/core/builder/plugins/plugin-types.ts:1164, src/core/builder/types/types.ts:60-166`
- 形: type ApplyFieldTransforms<TObject, TMap> = DeepMerge<TObject, FlatMapToNested<TMap>>
- 意味: .v() が AddFieldTransform で積み上げた「パス → 変換後型」のフラットマップを、ドット記法・配列パスを解いてネスト型に展開し、元の型に深くマージする。parse() の戻り型を決める。AddFieldTransform は変換後型が元型に代入可能なら TMap を変えない(型が実際に変わったときだけ記録)。

#### custom
- 出典: `src/core/plugin/custom.ts`
- 形: b.<type>.custom(validator: (value, rootData?) => boolean | { valid: boolean; message?: string }, options?: { code?: string; messageFactory?: (ctx: MessageContext) => string })
- 意味: 任意の述語による検証。rootData は検証中のルートオブジェクト全体。オブジェクト返しの場合その message がエラーメッセージになる。validator が例外を投げたら失敗扱い(握り潰す)。既定 code "CUSTOM_VALIDATION_FAILED"、既定メッセージ `${path} custom validation failed`。

#### requiredIf
- 出典: `src/core/plugin/requiredIf.ts`
- 形: b.<type>.requiredIf(condition: (allValues: TObject, arrayContext?: ArrayContext) => boolean, options?: ValidationOptions<{ condition?: boolean }>)
- 意味: 条件が真のときだけ必須。空判定は value === undefined || value === null || value === ""。条件が偽なら常に通過。allValues が無い場合は通過。既定 code "requiredIf"、既定メッセージ "Field is required when condition is met"。

#### validateIf
- 出典: `src/core/plugin/validateIf.ts`
- 形: b.<type>.validateIf(condition: (allValues: TObject, arrayContext?: ArrayContext) => boolean, options?: ValidationOptions).<以降のチェーン>
- 意味: 条件が偽なら、この呼び出し以降に登録された全ての validator をスキップする(位置依存: チェーン先頭に置く前提)。自身はエラーを生成しない。transform はスキップ対象外(validator ループの break のみ)。

#### MessageFactory / MessageContext / ValidationOptions
- 出典: `src/core/plugin/types.ts:28-47`
- 形: type MessageFactory<TContext = {}> = (ctx: MessageContext & TContext) => string; interface MessageContext { path: string; value: any; code: string }; interface ValidationOptions<TContext = {}> { code?: string; fieldName?: string; severity?: Severity; messageFactory?: MessageFactory<TContext> }
- 意味: 全プラグイン共通のエラーメッセージ生成契約。プラグインごとに TContext を足して文脈を拡張する。既定コードは options.code で上書き可能。fieldName と severity は実行時に一切読まれていない死にフィールド。

#### 実行順序契約
- 出典: `src/core/optimization/unified-validator.ts:218-330, 505-700; src/core/builder/context/field-context.ts:344-368`
- 形: default適用 → skipForNull/skipForUndefined短絡 → 全validatorを登録順(shouldSkipAllValidationでbreak) → 失敗なら終了 → parseモードのみ全transformを登録順に合成
- 意味: validate() は変換を行わず元データを返す。parse() のみが変換を行う。チェーン上での .transform() の記述位置は実行順序に影響しない。nullable() が付いた field の null / optional() が付いた field の undefined は検証も変換も丸ごとスキップされ、parse では元値がそのまま返る。

### should-preserve (8)

#### orFail
- 出典: `src/core/plugin/orFail.ts`
- 形: b.<type>.orFail(condition: (allValues: TObject) => boolean, options?: { code?: string; message?: string; messageFactory?: (ctx: MessageContext & { message?: string }) => string })
- 意味: 条件が真なら値に関係なく無条件で失敗させる否定的ゲート。deprecated フィールド、本番で存在してはいけないフィールド、権限・feature flag による禁止を表現する。allValues が無い場合は通過(compareField/stitch と逆の既定)。既定 code "validation_error"、既定メッセージ "Validation failed"。

#### optionalIf
- 出典: `src/core/plugin/optionalIf.ts`
- 形: b.<type>.optionalIf(condition: (allValues: TObject, arrayContext?: ArrayContext) => boolean, options?: ValidationOptions)
- 意味: 条件が真かつ値が空なら通過。条件が偽かつ値が空なら失敗(= 実質必須)。値があれば常に通過。requiredIf の論理的双対。code とメッセージがハードコードで options を無視するのは実装バグ。

#### skip
- 出典: `src/core/plugin/skip.ts`
- 形: b.<type>.skip(condition: (allValues: TObject) => boolean, options?: ValidationOptions).<以降のチェーン>
- 意味: validateIf の条件の極性を反転しただけ。条件が真なら以降の validator を全てスキップ。options は完全に無視される。

#### fromContext
- 出典: `src/core/plugin/fromContext.ts, src/core/builder/plugins/plugin-interfaces.ts:506`
- 形: b.<type>.fromContext<TContext>(options: ContextValidationOptions<TContext>) — ContextValidationOptions = { validate: (value, context: TContext, allValues) => { valid: boolean; message?: string }; errorMessage?: string; code?: string; required?: boolean (既定 false); fallbackToValid?: boolean (既定 true) }
- 意味: 外部から注入したコンテキスト(非同期に解決した重複チェック結果・在庫・権限など)を使う検証。required=true はコンテキスト必須、無ければ失敗。required=false でコンテキストが無ければ fallbackToValid を返す。validate 内の例外は失敗扱い。既定 code "context_validation"。意図は validator.withAsyncContext(ctx).validate(data) だが現行実装では非同期経路が接続されていない。

#### conditionalSchema
- 出典: `src/core/plugin/conditionalSchema.ts`
- 形: b.object.conditionalSchema(options: { ifSchema: JSONSchema7; thenSchema?: JSONSchema7; elseSchema?: JSONSchema7; validator?: (value, schema: JSONSchema7) => boolean; code?: string; messageFactory?: (ctx: MessageContext) => string })
- 意味: JSON Schema Draft-07 の if/then/else。null/undefined は無条件通過。ifSchema を評価し、真なら thenSchema、偽なら elseSchema で検証。該当スキーマが無ければ通過。validator を渡せば任意のスキーマ評価器を差し込める。既定 code "CONDITIONAL_SCHEMA"。

#### ArrayContext
- 出典: `src/core/plugin/types.ts:68-75`
- 形: interface ArrayContext<TItem = any> { index: number; item: TItem; array: TItem[] }
- 意味: 配列要素を検証中に、条件関数へ「今どの index の、どの item を見ているか」を渡すための文脈。requiredIf/optionalIf/validateIf の条件関数第2引数として宣言されているが、本流の実行パスは一度も渡していない(常に undefined)。意図された機能としては引き継ぐ価値がある。

#### フィールド既定値オプション
- 出典: `src/core/builder/types/field-options.ts`
- 形: .v(path, definition, config?: FieldConfig<T>) — FieldConfig<T> = T | (() => T) | { default?: T | (() => T); applyDefaultToNull?: boolean; description?: string; deprecated?: boolean | string; metadata?: Record<string, any> }
- 意味: .v() の第3引数。値が undefined のとき、および applyDefaultToNull !== false のとき null のときに既定値を適用する。関数なら呼び出す。validate() / parse() の両方で、検証より前に適用される。生値を渡すショートハンドと、オプションオブジェクトの両形式を受け付ける(normalizeFieldConfig が判別)。

#### プラグインカテゴリ
- 出典: `src/core/builder/plugins/plugin-types.ts:47-58, 355-483`
- 形: type PluginCategory = "standard" | "conditional" | "transform" | "fieldReference" | "multiFieldReference" | "arrayElement" | "composable" | "composable-conditional" | "composable-directly" | "context" | "builder-extension"
- 意味: カテゴリがチェーンメソッドの型シグネチャを決める(conditional → (condition, options?)、fieldReference → (fieldPath, options?)、multiFieldReference → (fields, validate, options?)、transform → <TOutput>(fn) で現在型を差し替え)。同時に実行時の振り分け(transform 配列 vs validator 配列)も決める。

### optional (3)

#### transform の禁止出力型ガード
- 出典: `src/core/plugin/transform-type-restrictions.ts`
- 形: IsForbiddenTransformOutput<T> / ForbiddenTransformError<T> / ValidateTransformOutput<T> / SafeTransformFunction<TInput,TOutput> / RestrictedTransformFunction<TInput,TOutput> / CheckTransformFunction<F>
- 意味: transform の出力が Array<プレーンオブジェクト> または Array<プレーンオブジェクトを含むユニオン> のとき、引数型を関数ではなくエラー文字列リテラル型に置き換えてコンパイルエラーにする。Date[] / RegExp[] / 関数の配列 / 配列の配列 / プリミティブ配列は許可。ネスト配列サポートの実装都合による制約。

#### Severity / SEVERITY
- 出典: `src/core/plugin/types.ts:15-21`
- 形: const SEVERITY = { INFO: "INFO", WARN: "WARN", ERROR: "ERROR" } as const; type Severity = "INFO" | "WARN" | "ERROR"
- 意味: 検証の重大度。型としては公開(src/index.ts が SEVERITY を型 export)されているが、実行時の分岐に一切使われていない。

#### sanitize / createReplace / createReplaceAll / createDefaultValue
- 出典: `src/core/transform/string/{sanitize,replace,defaultValue}.ts`
- 形: sanitize(value: string): string; createReplace(searchValue: string | RegExp, replaceValue: string): (value: string) => string; createReplaceAll(searchValue: string, replaceValue: string): (value: string) => string; createDefaultValue(defaultValue: string): (value: string | null | undefined) => string
- 意味: transform に渡す再利用可能な文字列変換関数の生成器。sanitize は & < > " ' / を HTML エンティティに置換。createReplaceAll は空文字検索時に各文字の境界へ挿入する特殊仕様を持つ。src/ のどこからも import されておらず、公開もされていない死にモジュール。

## 振る舞い規則

- 実行順序は 1 つだけ定義し、全実行パスで同一であること。現行の確定意味論は「default 適用 → null/undefined 短絡 → 全 validator を登録順 → parse モードのみ全 transform を登録順」。validate() は変換を行わず元の型を返し、parse() のみが変換後の型を返す。
- validate() の戻り型は TObject、parse() の戻り型は ApplyFieldTransforms<TObject, TMap>。この二本立ては公開契約なので維持する。
- transform は型レベルでチェーンの現在型を差し替える。以降のチェーンメソッドの入力型は変換後の型になる。連鎖 transform は型も合成される。
- transform 関数が例外を投げた場合の扱いを 1 つに決める(現行の本流は握り潰さずそのまま伝播、plugin-registry のフォールバックは TRANSFORM_ERROR に変換、と矛盾している)。
- allValues が取得できないときの既定は現行でプラグインごとにバラバラ(compareField/stitch は失敗、orFail/requiredIf/optionalIf/validateIf は通過)。新実装ではそもそも allValues が常に渡ることを型と実行の両方で保証し、この分岐を消すこと。
- 条件系プラグイン(validateIf / skip)の「以降の検証をスキップする」意味論はチェーン上の位置に依存する。位置依存を残すなら型で先頭強制するか、位置非依存にするかを明示的に決める。
- optionalIf の shouldSkipValidation のように、宣言はあるが実行エンジンが呼ばない拡張点を作らないこと。ValidatorFormat の __isDefault / __isPreprocess / __isCoerce / __isStitch / __stitchOptions も同種の未使用マーカー。
- ArrayContext(index / item / array)を条件関数に渡すなら、実行エンジンが実際に伝播すること。宣言だけして常に undefined にしない。
- エラーメッセージ生成は単一の関数で解決する。プラグインが返す message > messageFactory > プラグイン既定メッセージ、の優先順位は stitch / custom / orFail で共通なので、これを全プラグイン共通の規則に統一する。
- messageFactory に渡す文脈型はプラグインごとに拡張可能でありながら、MessageContext { path, value, code } を必ず含むこと。ジェネリクスで表現し any を使わない。
- options.code / options.messageFactory は全プラグインで一貫して尊重すること(optionalIf / skip / validateIf は現行で無視している)。
- エラーメッセージ生成のためにユーザーの検証関数を再実行しないこと(stitch と custom は現行で 2 回呼んでおり、副作用があるユーザー関数で破綻する)。
- プラグインインスタンスにミュータブルな状態を持たせないこと(custom は dynamicMessage をクロージャ変数に保持しており、同一 validator を複数の値に使うと前回のメッセージが漏れる)。
- 同一 methodName を持つ複数のプラグイン実装を並存させないこと(stitch が 3 実装、fromContext が 2 実装ある)。
- 公開エクスポートはメインエントリ・カテゴリ index・package.json の exports サブパスの 3 経路を単一の定義から導出し、手書きで重複させないこと。現行は 3 経路が食い違い、stitch / orFail / fromContext がどこからも到達できない。
- JSDoc の @allowedTypes と実装の allowedTypes 定数を単一の情報源から導くこと。現行の compareField は両者が食い違っている。
- stitch のフィールド指定は const タプルで受け、FieldsToObject でパスごとの実型を復元する型安全性を必ず維持すること。これが stitch の存在理由。
- non-null assertion / as any / any を使わずに、compareField・stitch のパス型(NestedKeyOf<TObject>)とパス先型(TypeOfPath<TObject, P>)を解決できること。現行は plugin() の impl に `as any` を当ててジェネリクスを通しており、その結果 compareField の compareFn オプションと orFail の message オプションがチェーン型から消えている。

## 引き継がないもの

- **stitchSimple.ts (stitchSimplePlugin) と stitch-typed.ts (stitchPluginTyped / createStitchValidator)** — stitch.ts と同じ methodName "stitch" を持つ 3 重実装。どちらも index.ts から export されておらず使われていない。API 形も違う(位置引数版とオプションオブジェクト版)。1 つに決めて他は捨てる。
- **src/core/async.experimental/from-context-plugin.ts の fromContextPlugin と conditionalRequiredCheck** — src/core/plugin/fromContext.ts と同名の重複実装。plugin() を使わない旧形式 (createMethod / validationFunction) でプラグインシステムと互換性がない。
- **fromContext.ts の助手群: emailDuplicationCheck / passwordConfirmation / inventoryCheck / conditionalRequired / createTypedContextValidator / ContextValidationTemplates (emailDuplication, passwordConfirmation, inventoryCheck, userPermission, accountLimits, geoRestriction)** — どこからも参照されず export もされていない、ドキュメント代わりのサンプルコード。ライブラリ本体が業務ドメイン(在庫・地域制限・アカウント上限)の語彙を持つべきではない。createTypedContextValidator に至っては引数をそのまま返すだけの恒等関数。
- **src/core/transform/ 一式 (index.ts, string/index.ts, sanitize.ts, replace.ts, defaultValue.ts)** — src/ 内のどこからも import されていない完全な死にモジュール。テストだけが存在を確認している。`export * as string from "./string"` という名前空間再エクスポートは tree-shaking も阻害する。必要なら個別のプリセット transform プラグインとして作り直す。
- **src/core/plugin/message-factories.ts の resolveMessage** — 冒頭コメントが参照する reporter.ts は存在せず、import 元もゼロ。中身も messageFactory が関数でなければ文字列として返すという型的に矛盾した分岐(MessageFactory は関数型なので string 分岐に到達しない)。
- **types.ts のフラグ型と型ガード: SkipAllValidationFlag / SkipFurtherValidationFlag / TransformFlag / NullableFlag / RecursiveFlag / ValidationResultWithFlags / WithFlags / ValidationFlags** — 実行時は shouldSkipAllValidation メソッド、__isTransform プロパティ、skipForNull/skipForUndefined ブールという別々の機構で処理されており、これらの型ガードは一度も呼ばれていない。仕様が 2 系統に分裂した残骸。
- **ValidatorFormat の未使用マーカー: __isDefault / __isPreprocess / __isCoerce / __isStitch / __stitchOptions** — field-context.ts の extractTransformFunction がこれらを分岐しているが、対応するプラグインが 1 つも存在しない。将来のための穴を開けたまま放置された痕跡。
- **conditionalSchema.ts の内蔵 evaluateSchema** — JSON Schema の評価器としてあまりに不完全(type / properties 内の const と enum / トップの const と enum しか見ない)。JSON Schema の評価は jsonSchema プラグイン側の単一の評価器に委ね、conditionalSchema は if/then/else の制御構造だけを担うべき。
- **custom.ts の dynamicMessage クロージャ変数** — プラグインインスタンス生成時に確保されるミュータブル変数に、check() の結果メッセージを書き込んで getErrorMessage() で読み出す設計。同じ validator を複数の値に使うと前回の値のメッセージが残る。check が boolean しか返せない ValidatorFormat の制約を回避するための場当たり。
- **stitch / custom / conditionalSchema の getErrorMessage が validate 関数を再実行する構造** — ユーザーの検証関数がエラーメッセージ生成のために 2 回呼ばれる。副作用やコストのある関数で破綻する。検証結果とメッセージを 1 回の呼び出しで返す形に統一すべき。
- **ValidationOptions の fieldName と severity** — 型としては全プラグインのオプションに露出しているが、実行時にどこからも読まれていない。severity は SEVERITY 定数と Severity 型まで用意されているのに分岐が 1 つもない。使うなら実装し、使わないなら消す。
- **validateIf の getErrorMessage が throw new Error(...) する実装** — 「呼ばれないはず」を例外で表明している。computeErrorMessage は try/catch で握り潰すので実害はないが、型で表現すべき不変条件を実行時例外に落としている。エラーを生成しないプラグインは getErrorMessage を持たない型にする。
- **skip プラグイン** — validateIf の条件の極性を反転しただけで、独立したプラグインとして持つ価値がない(options も完全に無視している)。validateIf 1 つに統合するか、条件を反転するだけの薄い別名にする。
- **stitch の validate 関数を `impl: stitchImpl as any` でプラグインに渡す構造** — ジェネリクスを通すために as any でキャストし、代わりに MapPluginMethodsToChainable 側でカテゴリ名から手書きの型シグネチャを再宣言している。その結果、実装の型と公開される型が二重管理になり、compareField の compareFn や orFail の message のように実装にあってチェーン型に無いオプションが生まれている。
- **src/core/registry/plugin-registry.ts の parse フォールバック(transform を先に適用してから validate する経路)** — 本流の unified-validator と実行順序が真逆。参照している _executionPlan は field-context.ts で「bundle size のため削除」されており永久に存在しないので、この矛盾した経路が常に走る。
- **unified-validator の 4 つの実行パス(createUltraFastValidator / createOptimizedTransformValidator / executeFastSeparated / executeDefinitionOrder)と、validator 数・transform 数による分岐** — 同じ意味論を 4 回書いており、しかも「definition_order」という名前に反して transform を定義順に差し込むわけではない(validator 全部 → transform 全部)。名前と実体が乖離した最適化の残骸。意味論を 1 実装にまとめること。
- **テスト test/unit/plugins/common/transform.test.ts、test/unit/plugins/context/fromContext.basic.test.ts** — 前者は「変換が先、validate() が変換済みデータを返す」という現行実装と真逆の仕様を assert している。後者は {valid: boolean} に対して .isValid() を呼んでおり型的に成立しない。どちらも仕様の証拠として採用してはいけない。

## 公開シンボル (111)

`compareFieldPlugin`, `stitchPlugin`, `stitchSimplePlugin`, `stitchPluginTyped`, `createStitchValidator`, `orFailPlugin`, `customPlugin`, `transformPlugin`, `fromContextPlugin`, `conditionalSchemaPlugin`, `requiredIfPlugin`, `optionalIfPlugin`, `validateIfPlugin`, `skipPlugin`, `compareField`, `stitch`, `orFail`, `custom`, `transform`, `fromContext`, `conditionalSchema`, `requiredIf`, `optionalIf`, `validateIf`, `skip`, `ConditionalSchemaOptions`, `ContextValidationOptions`, `TypeSafeStitchOptions`, `StitchValidationFn`, `FieldsToObject`, `TupleFieldsToObject`, `MessageFactory`, `MessageContext`, `ValidationOptions`, `SEVERITY`, `Severity`, `ValidationContext`, `RecursiveContext`, `ArrayContext`, `ValidationFunctionReturnType`, `ValidationResult`, `TransformFunctionReturnType`, `ValidationFunction`, `TransformFunction`, `ExtractTypes`, `SkipAllValidationFlag`, `SkipFurtherValidationFlag`, `TransformFlag`, `NullableFlag`, `RecursiveFlag`, `ValidationResultWithFlags`, `WithFlags`, `ValidationFlags`, `ConditionalMethod`, `WithConditionalMethods`, `ValidateIfMethods`, `IsForbiddenTransformOutput`, `ForbiddenTransformError`, `ValidateTransformOutput`, `SafeTransformFunction`, `RestrictedTransformFunction`, `CheckTransformFunction`, `resolveMessage`, `emailDuplicationCheck`, `passwordConfirmation`, `inventoryCheck`, `conditionalRequired`, `createTypedContextValidator`, `ContextValidationTemplates`, `conditionalRequiredCheck`, `sanitize`, `createReplace`, `createReplaceAll`, `createDefaultValue`, `TransformAwareValidator`, `ApplyFieldTransforms`, `ApplyNestedTransforms`, `AddFieldTransform`, `ExtractFieldType`, `TransformParseResult`, `PluginCategory`, `PluginType`, `ValidatorFormat`, `TransformPluginImplementation`, `PredefinedTransformImplementation`, `ConfigurableTransformImplementation`, `GenericTransformImplementation`, `TransformValidationMethod`, `TransformResult`, `ConditionalValidationMethod`, `FieldReferenceValidationMethod`, `MultiFieldReferenceValidationMethod`, `ContextPluginImplementation`, `FieldOptions`, `FieldConfig`, `DefaultValue`, `normalizeFieldConfig`, `applyDefault`, `createAccessor`, `createFieldAccessor`, `createBatchAccessors`, `getCachedAccessor`, `VALID_RESULT`, `INVALID_RESULT`, `ERROR_SEVERITY`, `ErrorCodes`, `ErrorCode`, `plugin`, `pluginPredefinedTransform`, `pluginConfigurableTransform`, `pluginBuilderExtension`

