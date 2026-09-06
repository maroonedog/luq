# test-intent-unit

測定実績 (jest 実行結果 JSON を解析): test/unit は 129 suites / 1888 tests。suite 単位で 45 green(うち 1 件 `plugins/transform/transform-simple.test.ts` は `describe.skip` で 0 テスト)、32 件が **TypeScript コンパイル失敗**（テストファイルが実在しないモジュール `src/core/plugin/stringEquals` / `switch` / `any` / `dynamic` / `recursivelyWithContext`、`src/luq/parser`、`src/ftv/parser`、`src/ftv/optimized-generator`、`src/luq/optimized-generator` を import、あるいは `emptyresult`/`validresult`/`nanresult` のような小文字typo、`MessageContext` に存在しないプロパティ参照）、52 件が partial。テスト単位では 1610 passed / 265 failed / 13 pending。

`src/core/plugin/__tests__/` には**テストは一切存在しない**。中身は `test-utils.ts` 1ファイルのみで、内容は `export { createMockReporter, createMockContext } from '../testUtils';` という re-export 1行。src 配下にユニットテストは無い。

合格 1610 件の内訳を読んだ結論:
(A) **本物の意味論を記録している**のは、Builder 連鎖 API の形・Result の形・エラーの形・フィールドパス構文(`a.b`, `items[*].name`, `matrix[*][*]`)・validate と parse の役割分担・プラグイン記述子(name/methodName/category/allowedTypes/create)・プラグイン登録レジストリ・globalConfig・JSON Schema Draft-07 の各キーワード検証と `fromJsonSchema`・各バリデータプラグインの合否判定と `code` 値。これらは新実装が満たすべき互換仕様として抽出価値がある。
(B) **無価値**なのは、ソース行番号を describe 名に埋め込んだカバレッジ稼ぎ(`coverage-100-percent`/`final-100-percent`/`coverage-final`/`validator-factory-coverage-boost`/`validator-factory-advanced`/`jsonSchema-full-coverage`/`jsonSchema-internals`/`jsonSchema-helper-functions`)、`(plugin as any).impl` で private 内部を叩く `*-simple.test.ts` 群、内部最適化クラス(`ultra-fast-validator`/`raw-validator`/`array-batch-optimizer`/`strategy-factory`/`execution-strategy-selector`/`field-accessor`/`field-accessor-optimized`/`validation-engine`)の白箱テスト、そしてユニットテスト内の性能アサーション(`timePerValidation < 1ms` 等)。

さらに重大な発見が3つある。
1. **`error.context` は「意図された契約」だが実装されていない。** `stringStartsWith`/`numberMax` 等の失敗理由は `toMatchObject({code, context:{prefix:"PROD-"}})` に対し `context` が返らないこと。`arrayMaxLength`/`stringExactLength` の「エラーコンテキスト」テストは **アサーションをコメントアウトして通している**（`// Context property is not available in current API`）。つまり構造化エラー情報という設計意図は残っているが実装が追いついていない。
2. **`abortEarly` のデフォルトが実装内で矛盾している。** `src/core/builder/validator-factory.ts` は 4 箇所で `options?.abortEarly !== false // Default to true`、`src/core/optimization/core/strategy-factory.ts` は `abortEarly = false`、`validation-engine.ts` は同一ファイル内で `true` と `false` が混在。観測される挙動は「3 フィールド全滅でもエラー 1 件」。`validator-factory.test.ts` の「should collect all errors by default」は `toBeGreaterThanOrEqual(1)` に**弱められて**通っており、契約を規定していない。
3. **JSON Schema 関連のテストが全体の 17%(129 中 22 ファイル)を占め、`test/unit/plugins/common/jsonSchema*.test.ts`(10ファイル) と `test/unit/plugins/jsonSchema/*.test.ts`(11ファイル) が同じ対象を二重にテストしている。** 加えて `test/unit/transform/string/` と `test/unit/core/transform/string/` が重複、`plugins/advanced/stitch.test.ts` と `plugins/multiFieldReference/stitch.test.ts` が重複。

## 引き継ぐ契約 (46件)

### must-preserve (29)

#### Builder() ビルダー連鎖
- 出典: `C:\projects\luq\test\unit\plugins\common\required.test.ts`
- 形: Builder().use(plugin).use(plugin2).for<T>().v(path, b => chain).build() → Validator<T>
- 意味: `Builder()` は引数なし関数。`.use()` はプラグインを 1 個ずつ登録し新しいビルダーを返す（連鎖可能、型レベルでメソッドが生える）。`.for<T>()` で対象 TypeScript 型を確定し FieldBuilder を返す。`.v()` を任意回呼び、最後に `.build()`。既存の TS 型をそのまま渡すだけで済み、スキーマ再定義を強要しない。

#### .v(path, builderFn) / .field(path, builderFn)
- 出典: `C:\projects\luq\test\unit\core\builder\field-builder.test.ts`
- 形: v(path: FieldPath<T>, fn: (b: TypeSlots) => Chain): FieldBuilder<T>
- 意味: `v` は `field` の**厳密な同一参照エイリアス**（`expect(fieldBuilder.v).toBe(fieldBuilder.field)` が通る）。呼び出しは**イミュータブル**で、必ず新しいビルダーインスタンスを返す（`expect(newBuilder).not.toBe(fieldBuilder)`）。path は自オブジェクト型から導出された文字列リテラル型で、存在しないキーは型エラーになる（`nullable.test.ts` のコンパイル失敗がその証拠）。

#### フィールドパス構文
- 出典: `C:\projects\luq\test\unit\core\builder\nested-array-comprehensive.test.ts`
- 形: "name" | "user.name" | "company.department.team.leader" | "items[*].name" | "matrix[*]" | "matrix[*][*]" | "matrix[*][*].value"
- 意味: ドット区切りで任意深さのネスト。`[*]` は配列の全要素を意味し、配列そのもの(`matrix`)・その要素(`matrix[*]`)・要素のプロパティ(`items[*].name`)を別々のルールとして登録できる。2次元 `[*][*]` は合格テストで担保済み。空配列に対する `items[*].name` の required は**エラーにならない**（検証対象が 0 件のため valid）。

#### エラーパスのインデックス表記
- 出典: `C:\projects\luq\test\unit\core\builder\nested-array-comprehensive.test.ts`
- 形: error.path === "matrix[0][1].value" / "items[0].id" / "user.email"
- 意味: 検証エラーの `path` は `[*]` を実際の数値インデックスに解決した具体パスになる。2次元まで `matrix[0][1]` 形式が合格テストで担保。

#### validator.validate(data, options?)
- 出典: `C:\projects\luq\test\unit\core\builder\pick-parse.test.ts`
- 形: validate(data: T, options?: { abortEarly?: boolean }): Result<T>
- 意味: 検証のみ行い **transform は適用しない**（`validate({name:"john"}).data().name === "john"`）。第2引数でオプションを取る。

#### validator.parse(data, options?)
- 出典: `C:\projects\luq\test\unit\core\builder\pick-parse.test.ts`
- 形: parse(data: T, options?): Result<TransformedT>
- 意味: 検証に加えて transform とデフォルト値適用を行い、変換後データを返す（`parse({name:"john"}).data().name === "JOHN"`）。ネストフィールド・配列要素(`products[*].name`)・配列全体への transform も parse 時のみ適用される。検証失敗時は errors を返す。

#### Result<T>
- 出典: `C:\projects\luq\src\types\result.ts`
- 形: { isValid(): boolean; isError(): boolean; readonly valid: boolean; readonly value: T; data(): T|undefined; unwrap(): T; unwrapOr(d): T; unwrapOrElse(fn): T; map(fn): Result<U>; flatMap(fn): Result<U>; tap(fn): Result<T>; tapError(fn): Result<T>; readonly errors: ValidationError[]; toPlainObject(): {valid,data?,errors} }  ／ ファクトリ `Result.ok(data)` / `Result.error(errors)`
- 意味: `data` は**メソッド**、`errors` は**プロパティ**、`valid` は**プロパティ**、`isValid` は**メソッド**（併存する）。成功時 `errors` は空配列。失敗時 `unwrap()` は投げる。`Result.ok` は `null`/`undefined`/`""`/`0`/`false`/`NaN`/循環参照をすべて有効データとして受ける。data は参照をそのまま返す（防御的コピーはしない）。

#### ValidationError
- 出典: `C:\projects\luq\src\types\index.ts`
- 形: { path: string; message: string; code: string; paths(): string[] }
- 意味: 4 フィールド固定。`code` は原則プラグイン名と一致（`required`,`optional`,`stringMin`,`numberMin`,`numberMax`,`stringStartsWith`,`booleanTruthy`,`booleanFalsy`,`requiredIf`,`arrayMaxLength` 等）。例外は `orFail` で、既定 code は `validation_error`。`paths()` は関数。

#### ValidationOptions / messageFactory
- 出典: `C:\projects\luq\src\core\plugin\types.ts`
- 形: { code?: string; fieldName?: string; severity?: Severity; messageFactory?: (ctx) => string }  — 各プラグインメソッドの最終引数
- 意味: 全プラグインメソッドが末尾でオプションを受け、`messageFactory` でエラーメッセージを差し替えられる。`code` を渡すとエラーコードを上書きできる（`orFail(..., {code:"ACCESS_DENIED"})` で `errors[0].code === "ACCESS_DENIED"`）。ctx には最低限 `{path, value, code}` が入り、実行時にはプラグイン固有情報も渡る（`objectAdditionalProperties` は `extraProperties` を渡し、テストが実際にその値でメッセージを組み立てて合格している）。

#### 型スロット (b.<type>)
- 出典: `C:\projects\luq\test\unit\core\builder\context\field-type-detector.test.ts`
- 形: b.string | b.number | b.boolean | b.date | b.array | b.object | b.tuple | b.union
- 意味: ビルダー関数の引数はこの 8 スロットを持ち、スロットごとに使えるメソッドが `allowedTypes` により型制限される。スロット選択がフィールドの型を確定させる（`detectFieldType` が最後にアクセスされたスロット名を返す）。

#### TypedPlugin 記述子
- 出典: `C:\projects\luq\test\unit\core\builder\plugins\plugin-creator.test.ts`
- 形: { name: string; methodName: string; category: PluginCategory; allowedTypes: readonly TypeName[]; create(): (...args) => Implementation }
- 意味: プラグインは副作用のない静的オブジェクト。`name` が既定エラーコード、`methodName` が連鎖に生えるメソッド名、`allowedTypes` が適用可能な型スロット、`create()` が実装ファクトリを返す。`create` の存在が必須（`plugin-registry.test.ts` が `create` 欠落で型エラーになる）。

#### PluginCategory（全件）
- 出典: `C:\projects\luq\test\unit\core\builder\plugins\plugin-creator.test.ts`
- 形: "standard" | "conditional" | "fieldReference" | "transform" | "arrayElement" | "context" | "preprocessor" | "builder-extension"
- 意味: standard=値のみ検証 / conditional=`check(value, allValues)` で他フィールド参照して条件分岐 / fieldReference=他フィールドとの比較 / transform=`transform(value)` を持ち parse 時に適用 / arrayElement=配列要素単位 / context=`check(value, allValues, context)` の3引数 / preprocessor=`preprocess(value)` を持つ / builder-extension=`extendBuilder(builder)` でビルダー自体にメソッドを生やす（jsonSchemaPlugin がこれ）。

#### plugin() / pluginPredefinedTransform() / pluginConfigurableTransform() / pluginBuilderExtension()
- 出典: `C:\projects\luq\test\unit\core\builder\plugins\plugin-creator.test.ts`
- 形: plugin({name, methodName, allowedTypes, category, impl}) → TypedPlugin
- 意味: プラグイン作成の公開ファクトリ。`pluginPredefinedTransform({name, allowedTypes, impl})` は methodName=name・category="transform" を自動設定し引数なしの変換を作る。`pluginConfigurableTransform` は引数付き変換。変換結果は `{valid, isValid(), __isTransform: true, __transformFn}` 形状。

#### requiredPlugin
- 出典: `C:\projects\luq\test\unit\plugins\common\required.test.ts`
- 形: .required(options?) — allowedTypes: string,number,boolean,date,array,object,tuple,union / code: "required"
- 意味: undefined・null・**空文字列 ""** を拒否する。`0` / `false` / `[]` / `{}` は有効値として受け入れる。ネスト(`user.name`, 4階層)・配列要素(`items[*].name`)でも動作し、対象要素が存在しない場合（空配列）は valid。

#### optionalPlugin
- 出典: `C:\projects\luq\test\unit\plugins\common\optional.test.ts`
- 形: .optional(options?) / category: "standard" / code: "optional"
- 意味: undefined とキー欠落を受け入れる。**null は拒否する**（code `optional` のエラー）。空文字列は受け入れる。値が存在する場合は後続の検証が通常どおり走る。

#### 「値が undefined ならスキップ」の共通規則
- 出典: `C:\projects\luq\test\unit\plugins\array\arrayMinLength.test.ts`
- 形: b.<type>.optional().<anyValidator>(...)
- 意味: optional と組んだ場合、値が undefined なら後続バリデータは一切実行されず valid。arrayMinLength / arrayMaxLength / arrayIncludes / numberMin / numberMax / numberMultipleOf / numberInteger / numberPositive / numberNegative / numberRange / stringMin / stringMax / stringPattern / stringUrl / stringAlphanumeric / stringStartsWith / stringExactLength / uuid / booleanTruthy のテストで一貫して担保されている。

#### requiredIfPlugin
- 出典: `C:\projects\luq\test\unit\plugins\conditional\requiredIf.test.ts`
- 形: .optional().requiredIf((allValues) => boolean, options?) / code: "requiredIf"
- 意味: 条件が真のとき required 相当、偽のとき optional 相当。条件関数はルート値オブジェクト全体を受け取り、boolean / number / array / ネストフィールド / 複数フィールド組合せを参照できる。1フィールドに複数の requiredIf を連鎖できる。

#### skipPlugin
- 出典: `C:\projects\luq\test\unit\plugins\conditional\skip.test.ts`
- 形: .skip((allValues) => boolean, options?) / category: "conditional" / allowedTypes: string,number,boolean,array,object
- 意味: 条件が真ならそのフィールドの**全バリデーションをスキップ**して valid にする（`shouldSkipAllValidation`）。連鎖上の位置（`.skip().required().min()` でも `.required().min().skip()` でも）に関わらず効く。条件が偽なら通常検証され、エラー code は元のバリデータのもの（例 `stringMin`）。複数の skip 条件を連鎖可能。

#### customPlugin
- 出典: `C:\projects\luq\test\unit\core\builder\pick-parse.test.ts`
- 形: .custom((value, rootData) => boolean, { code?, messageFactory? })
- 意味: 任意の述語を差し込む汎用エスケープハッチ。第2引数にルートデータが渡るのでクロスフィールド検証ができる。`code` でエラーコードを指定する。

#### transformPlugin
- 出典: `C:\projects\luq\test\unit\plugins\transform\transform-array-restrictions.test.ts`
- 形: .transform((value) => newValue) / category: "transform" / allowedTypes: string,number,boolean,array,object,date,union
- 意味: 検証は常に通し、値を変換する。**parse でのみ適用され validate では適用されない**。`Array<primitive>` の変換は許可、`Array<object>` への変換は型レベルで禁止する意図がある（`IsForbiddenTransformOutput` 型）。空配列・ネスト配列でも動く。

#### 文字列プラグイン群の意味論
- 出典: `C:\projects\luq\test\unit\plugins\string\stringMin.test.ts`
- 形: .min(n) .max(n) .exactLength(n) .pattern(regexp) .email() .url() .alphanumeric() .startsWith(s) .endsWith(s) .datetime() .contentMediaType(mime) .uuid()
- 意味: 長さは UTF-16 コードユニット単位（サロゲートペア=2、日本語1文字=1）。`min(0)` は空文字列を許可。`pattern` はフラグ付き正規表現(i, m)・日本語・バックスラッシュ・特殊文字を扱える。`datetime` は ISO 8601（ミリ秒・各種タイムゾーンオフセット可、前後空白は不可）。`uuid` は v1/v3/v4/v5 を受理しハイフン位置に厳密。`contentMediaType` は application/json（base64エンコード込み）・text/html・application/xml・text/plain（常に有効）・text/css・application/javascript を検証し、未知の MIME には寛容(true)。`url` は認証情報付き・IDN・IP・複雑なクエリ/フラグメントを受理。

#### 数値プラグイン群の意味論
- 出典: `C:\projects\luq\test\unit\plugins\number\numberRange.test.ts`
- 形: .min(n) .max(n) .integer() .positive() .negative() .finite() .multipleOf(n) .range(min, max)
- 意味: `positive()` は 0 と -0 を拒否、`negative()` は 0 を拒否し -0 を受理。`integer()` は Infinity と NaN を拒否。`min`/`max` は境界値を含む。`range(min, max)` は両端含む。プラグイン引数が不正な場合（min>max、NaN）は**構築時に投げるのではなく検証時にエラーメッセージ**（"Plugin configuration error" / "Cannot use NaN values"）を返す。`range(-Infinity, Infinity)` は全数値を受理。

#### 配列プラグイン群の意味論
- 出典: `C:\projects\luq\test\unit\plugins\array\arrayUnique.test.ts`
- 形: .minLength(n) .maxLength(n) .unique() .includes(value) .contains(valueOrSchema)
- 意味: `unique()` は `===`/SameValue ベース（オブジェクトは参照比較、NaN は互いに異なるので `[NaN, NaN]` は unique 扱い、大文字小文字は区別）。空配列・単一要素は unique。`includes` は厳密等価（型の違い・大文字小文字を区別）。`maxLength(0)` は空配列のみ許可。スパース配列・配列風オブジェクトも処理する。`contains` は素の値でも `{validator, message}` でも指定でき、JSON Schema の contains に対応。

#### booleanTruthyPlugin / booleanFalsyPlugin
- 出典: `C:\projects\luq\test\unit\plugins\boolean\booleanTruthy.test.ts`
- 形: .boolean.truthy(options?) / .boolean.falsy(options?) / code: "booleanTruthy" / "booleanFalsy"
- 意味: `truthy()` は true のみ、`falsy()` は false のみを受理。**真偽値変換は行わない**。undefined は optional と組めばスキップ。ネストフィールド・配列内オブジェクトでも使える。

#### jsonSchemaPlugin と .fromJsonSchema()
- 出典: `C:\projects\luq\test\unit\plugins\jsonSchema\plugin.test.ts`
- 形: jsonSchemaPlugin = { name: "jsonSchema", category: "builder-extension", extendBuilder(builder) }  →  builder.fromJsonSchema(schema: JSONSchema7, options?: { customFormats?: Record<string,(v)=>boolean>, strictRequired?: boolean }): builder
- 意味: ビルダー拡張プラグイン。`extendBuilder` がビルダーに `fromJsonSchema` を生やす。スキーマを走査して各プロパティを `builder.v(path, definition)` に変換し、**ビルダー自身を返す**ので連鎖が続けられる。`additionalProperties: false` を見たら `builder.strict()` を呼ぶ。`dependentRequired` を条件付き必須に落とす。ルートオブジェクト制約（path === ""）は `v()` に流さない。ネスト・配列 items・$ref/definitions を解決する。

#### JSON Schema Draft-07 対応キーワード（全件）
- 出典: `C:\projects\luq\test\unit\plugins\jsonSchema\validation-core.test.ts`
- 形: type / enum / const / multipleOf / maximum / exclusiveMaximum(number および draft-04 の boolean) / minimum / exclusiveMinimum(number および boolean) / maxLength / minLength / pattern / items(単一スキーマ・タプル) / additionalItems(false / true / schema) / maxItems / minItems / uniqueItems / contains / maxProperties / minProperties / required / properties / patternProperties / additionalProperties(false / true / schema) / propertyNames / dependentRequired(draft-2019 拡張) / dependentSchemas / if / then / else / allOf / anyOf / oneOf / not / format / contentEncoding / contentMediaType / definitions / $defs / $ref / title / description / default / readOnly / writeOnly / examples / deprecated / boolean schema(true=常に有効, false=常に無効)
- 意味: `validateValueAgainstSchema` と `getDetailedValidationErrors` の合格テスト(49件+41件)がこの全キーワードの検証と詳細エラー生成を担保している。型は null/boolean/string/number/integer/array/object と型配列（`["string","null"]` は nullable として扱う）。`$ref` は `#/definitions/...` と `#/$defs/...` の内部参照のみ対応し、外部参照は**例外を投げる**。循環参照は visited セットで検出して無限ループを避ける。空スキーマ `{}` は常に有効。

#### format バリデータ（全件）
- 出典: `C:\projects\luq\test\unit\plugins\jsonSchema\format-validators.test.ts`
- 形: email / url / uri / uri-reference / uuid / date / date-time / time / duration / ipv4 / ipv6 / hostname / json-pointer / relative-json-pointer / iri / iri-reference / uri-template / regex
- 意味: `validateFormat(value, formatName, customFormats?)` は customFormats を優先し、なければ組み込み、どちらにも無ければ **true を返す**（未知フォーマットは寛容）。customFormats の値が関数でない場合も true。`getSupportedFormats()` が名前一覧を、`isFormatSupported(name)` が真偽を返す。非文字列入力でクラッシュしない。

#### 型ガードユーティリティ
- 出典: `C:\projects\luq\test\unit\core\utils\type-guards.test.ts`
- 形: isObject / isPlainObject / isString / isNumber / isBoolean / isFunction / isArray / isNullish / isUndefined / isNull / isError / hasProperty / isValidDate / isFiniteNumber / isInteger / isOneOfTypes
- 意味: `isObject` は配列・null・関数を false。`isPlainObject` はさらに Date/RegExp/クラスインスタンスも false。`isValidDate` は Invalid Date を false。`hasProperty` は symbol/number キー・継承プロパティも true。`isOneOfTypes(value, guards[])` は空配列で false。**`as any` を使わず unknown+型ガードで書くという新規約と完全に整合するので、この関数群はそのまま再実装する価値がある。**

#### ネスト構造の検証パターン
- 出典: `C:\projects\luq\test\unit\core\builder\nested-array-comprehensive.test.ts`
- 形: v("matrix") + v("matrix[*]") + v("matrix[*][*]") ／ v("products") + v("products[*].name") ／ v("a.b.c.d")
- 意味: 配列 in 配列（2次元）、オブジェクト in 配列、オブジェクト in オブジェクト（深いネスト）、ジャグ配列、行列状オブジェクト配列、空のネスト配列、optional なネスト配列、ネスト配列内 null、自己参照構造、混在プリミティブ配列がすべて合格テストで担保されている。深いネストでもスタックオーバーフローしない。

### should-preserve (17)

#### validator.pick(path)
- 出典: `C:\projects\luq\test\unit\core\builder\pick-parse.test.ts`
- 形: pick(path): { validate(value, rootData?): {valid, value, errors}, parse?(value): {valid, value, errors} }
- 意味: 単一フィールドのバリデータを切り出す。返り値は Result ではなく `{valid, value, errors}` 形状。第2引数に root データを渡すと `custom` 等のクロスフィールド検証が機能する。ネストパス(`profile.name`)・配列パスも pick 可能。存在しないパスでも例外を投げない。

#### プラグイン実装オブジェクト
- 出典: `C:\projects\luq\test\unit\core\builder\plugins\plugin-creator.test.ts`
- 形: { check(value, allValues?, context?): boolean; code: string; getErrorMessage(value, path): string; params: unknown[]; transform?; preprocess?; shouldSkipAllValidation? }
- 意味: `plugin()` の `impl` が返す形。`check` は boolean を返す純関数。transform 系は `check` が常に true で `transform` が実体。`skip` 系は `shouldSkipAllValidation(allValues)` を持つ。

#### createPluginRegistry() / createFieldRule()
- 出典: `C:\projects\luq\test\unit\core\field-rule-defaults.test.ts`
- 形: createPluginRegistry().use(p1).use(p2).createFieldRule<T>(ctx => ctx.string.required().min(3), defaultOrOptions) → FieldRule<T>
- 意味: ビルダーと独立に「1フィールド分の再利用可能ルール」を作る仕組み。FieldRule は `.validate(value)` と `.parse(value)` を持ち、いずれも `{valid, data()}` を返す。第2引数は素のデフォルト値か `{name, description, fieldOptions:{default, applyDefaultToNull}}`。ビルダー側からは `.useField(path, rule)` で取り込む。

#### .v() 第3引数のデフォルト値／フィールドオプション
- 出典: `C:\projects\luq\test\unit\core\field-level-defaults.test.ts`
- 形: v(path, fn, defaultValue) | v(path, fn, { default, applyDefaultToNull?, description?, deprecated?, metadata? })
- 意味: デフォルト値は素の値でも `() => value` の関数でもよい。`parse()` 時に undefined のフィールドへ適用される（`parse({})` で全デフォルトが埋まる）。`applyDefaultToNull: true` の場合のみ null もデフォルトで置換され、false なら null が保持される。`description`/`deprecated`/`metadata` はメタ情報として受け入れられる。

#### .strict()
- 出典: `C:\projects\luq\test\unit\core\builder\field-builder.test.ts`
- 形: fieldBuilder.strict(): FieldBuilder
- 意味: 未定義プロパティを拒否する厳格モードを有効化し、ビルダーを返して連鎖を継続する。`fromJsonSchema` は `additionalProperties: false` を見たときに内部で `builder.strict()` を呼ぶ。

#### validate/parse の abortEarly オプション
- 出典: `C:\projects\luq\test\unit\core\builder\nested-array-comprehensive.test.ts`
- 形: validate(data, { abortEarly: boolean })
- 意味: `abortEarly: true` で最初のエラーで打ち切り、`false` で全フィールドのエラーを収集する（`matrix[0][1]` と `matrix[1][1]` の両方が返る）。**デフォルト値は既存実装で矛盾しており契約として確定していない**（openQuestions 参照）。

#### orFailPlugin
- 出典: `C:\projects\luq\test\unit\plugins\conditional\orFail-simple.test.ts`
- 形: .orFail((allValues) => boolean, options?) / 既定 code: "validation_error"
- 意味: 条件が真のとき**必ず失敗させる**（ガード/禁止条件）。偽なら通過。`{code: "..."}` でエラーコードを差し替え可能。

#### validateIfPlugin
- 出典: `C:\projects\luq\test\unit\plugins\conditional\validateIf.test.ts`
- 形: .validateIf((allValues) => boolean, options?)
- 意味: 条件が真のときだけ後続バリデーションを実行する。合格しているのは「条件が真のとき実行される」「他バリデータと組める」「エラー情報が出る」の3件のみで、「条件が偽ならスキップ」は失敗している（実装が不完全）。

#### compareFieldPlugin
- 出典: `C:\projects\luq\test\unit\plugins\common\compareField.test.ts`
- 形: .compareField(otherPath, comparator?, options?) / category: "fieldReference"
- 意味: 他フィールドと比較する。比較関数省略時は `===`。カスタム比較関数で日付前後・数値大小・配列長・文字列包含・オブジェクトプロパティ比較ができる。null/undefined / オブジェクト / 配列すべての型で使える。参照先フィールドが存在しない場合もクラッシュしない。

#### fromContextPlugin
- 出典: `C:\projects\luq\test\unit\plugins\context\fromContext.test.ts`
- 形: .fromContext({ key?, required?, fallbackToValid?, validate: (value, ctxData, allValues) => boolean | {valid, message}, ... })
- 意味: 非同期コンテキスト（外部から注入されたデータ）または `allValues` を参照して検証する。コンテキスト未提供時は `allValues` にフォールバック。`required: true` でコンテキスト欠落をエラーにできる。検証関数が例外を投げても握りつぶしてエラー結果に変換する。`passwordConfirmation` ヘルパーが用意されている。条件付き required 判定では `null`/`undefined` を空扱い、`0`/`false` は値扱い。

#### objectRecursivelyPlugin (別名 recursivelyPlugin)
- 出典: `C:\projects\luq\test\unit\plugins\advanced\objectRecursively.test.ts`
- 形: .object.required().recursively(fieldPathOrPaths, options?)  ※引数 1〜2 個必須
- 意味: 自己参照する同一型のフィールドへ同じルールを再帰適用する。`[*]` 記法で配列要素にも再帰できる。最大深度を制限できる。相互参照・複数の再帰パス・循環参照・null/undefined を安全に処理する。組織階層のようなツリー構造が用途。

#### literalPlugin
- 出典: `C:\projects\luq\test\unit\plugins\common\literal-simple.test.ts`
- 形: .literal(value, options?) / category: "standard" / allowedTypes に string,number,boolean,null を含む
- 意味: 指定リテラルとの厳密一致。文字列は大文字小文字を区別、`""`/null/undefined は非一致。カスタム `code` と `messageFactory` を受ける。

#### objectAdditionalPropertiesPlugin
- 出典: `C:\projects\luq\test\unit\plugins\common\objectAdditionalProperties.test.ts`
- 形: .object.additionalProperties(false | true | schema, { allowedProperties: string[], messageFactory? })
- 意味: `false`=許可リスト外のプロパティを拒否（strict）、`true`=何でも許可、スキーマ指定=追加プロパティを `{type, minLength, ...}` で検証。messageFactory には `extraProperties: string[]` が渡る。許可プロパティ 0 件のケースも扱える。

#### objectPropertyNamesPlugin / objectPatternPropertiesPlugin / objectDependentRequiredPlugin / arrayContainsPlugin
- 出典: `C:\projects\luq\test\unit\plugins\jsonschema-extensions.test.ts`
- 形: .object.propertyNames(RegExp | {validator,message}) / .object.patternProperties({ "^prefix_": (v)=>boolean }) / .object.dependentRequired({ key: string[] | {required: string[], message} }) / .array.contains(value | {validator,message})
- 意味: JSON Schema の propertyNames / patternProperties / dependentRequired / contains を Luq プラグインとして直接使えるようにしたもの。いずれもカスタムメッセージを受け、エラーメッセージにその文言が含まれる。dependentRequired はルート(`""` パス)に対しても適用できる。

#### jsonSchema モジュールの公開関数
- 出典: `C:\projects\luq\test\unit\plugins\jsonSchema\index.test.ts`
- 形: validateValueAgainstSchema(value, schema) / getDetailedValidationErrors(value, schema, path?, opts?) / getSpecificValidationErrors(value, schema, fieldPath) / convertJsonSchemaToLuqDSL(schema, parentPath?, requiredList?) / convertDSLToFieldDefinition(dsl) / resolveRef(ref, rootSchema) / resolveSchemaRef / resolveAllRefs / validateFormat / getSupportedFormats / isFormatSupported
- 意味: `src/core/plugin/jsonSchema/index.ts` から export される 7 シンボル（jsonSchemaPlugin, validateValueAgainstSchema, getDetailedValidationErrors, getSpecificValidationErrors, convertJsonSchemaToLuqDSL, convertDSLToFieldDefinition, resolveRef）。`jsonSchemaFullFeaturePlugin` は index からは export されない（`src/core/plugin/index.ts` からのみ）。`getSpecificValidationErrors` はパス完全一致と接頭辞一致の両方でエラーを絞り込む。

#### globalConfig
- 出典: `C:\projects\luq\test\unit\core\global-config.test.ts`
- 形: globalConfig.setConfig(partial) / getConfig() / reset() ＋ 関数版 setGlobalConfig / getGlobalConfig / resetGlobalConfig ＋ 型 GlobalConfig
- 意味: 既定値は `messageKeyPrefix: ""`, `toBooleanTruthyValues: ["true","1","yes","on"]`, `numberFormat: {decimalSeparator: ".", thousandSeparator: ","}`, `dateFormat: "YYYY-MM-DD"`, `trimStrings: false`, `caseSensitive: true`, `customTransforms: {}`。`setConfig` は部分更新で、`numberFormat` はマージ（置換ではない）。getter はコピーを返し外部から破壊できない。`reset()` で既定に戻り、リセット後もオブジェクトの独立性が保たれる。

#### 文字列 transform ヘルパー
- 出典: `C:\projects\luq\test\unit\core\transform\string\sanitize.test.ts`
- 形: createDefaultValue(defaultStr) / createReplace(search, replacement) / createReplaceAll(search, replacement) / sanitize(str)
- 意味: `createDefaultValue` は null/undefined のときだけ既定値を返し、`""` や空白のみの文字列は「実在する値」として保持する。`createReplace` は最初の1件のみ（正規表現・グループ・g/i/m フラグ対応）、`createReplaceAll` は全件（正規表現特殊文字・空検索文字列・重複パターンを安全に扱う）。`sanitize` は `& < > " ' /` を HTML エンティティへエスケープし、二重エスケープ済みの内容も一律に再エスケープする（順序非依存）。CSP-safe（正規表現とネイティブ文字列操作のみ、eval/new Function 不使用）。

## 振る舞い規則

- `Builder().use(p).for<T>().v(path, b => chain).build()` の連鎖形と、`.use` がプラグイン1個ずつ・`.for<T>` が型確定・`.v` が繰り返し可能・`.build` が終端、という役割分担を維持すること。
- .v と .field は同一関数への参照でなければならない（`v === field` が真）。ビルダーは呼び出しごとに新インスタンスを返すイミュータブル設計を維持すること。
- フィールドパスは `a.b.c` のドット記法と `[*]` の配列ワイルドカードのみ。`items[*].name`・`matrix[*][*]`・`matrix[*][*].value` の3形をすべてサポートすること。
- エラーの `path` は `[*]` を具体インデックスに解決した文字列（`matrix[0][1].value`）にすること。
- `validate()` は transform を適用してはならない。`parse()` のみが transform とデフォルト値を適用する。この分離は新実装でも絶対に維持すること。
- `Result` は `isValid()`/`isError()`/`unwrap()`/`unwrapOr()`/`unwrapOrElse()`/`map()`/`flatMap()`/`tap()`/`tapError()`/`data()`/`toPlainObject()` をメソッドとして、`errors` と `valid` をプロパティとして持つ。data がメソッドで errors がプロパティという非対称は既存利用者の記述と直結するので、変えるなら意図的に決断すること。
- `ValidationError` は `{path, message, code, paths()}`。`code` は既定でプラグイン名と一致させること（required / optional / stringMin / numberMax / booleanTruthy / requiredIf / arrayMaxLength …）。
- 全プラグインメソッドは末尾で `{code?, messageFactory?}` を含むオプションを受け取ること。`code` はエラーコードを上書きし、`messageFactory` はメッセージを差し替える。
- `messageFactory` に渡すコンテキストはプラグインごとに型付けすること（`{path, value, code}` に加え、stringMin なら `min`、arrayMaxLength なら `maxLength`、objectAdditionalProperties なら `extraProperties`、compareField なら `fieldValues`）。旧実装は共通 `MessageContext` 1種類しか型定義せず、その結果テスト6ファイルがコンパイル不能になっている。判別可能ユニオンかジェネリクスで解くこと。
- `required` は undefined / null / 空文字列 `""` を拒否し、`0` / `false` / `[]` / `{}` は通す。
- `optional` は undefined を通し **null を拒否する**。null を許すのは `nullable` の役割であり、両者を混同しないこと。
- optional 済みフィールドが undefined のとき、後続バリデータは1つも実行しないこと。
- プラグインは `{name, methodName, category, allowedTypes, create()}` を持つ副作用のない静的オブジェクトとし、`allowedTypes` で適用可能な型スロットを型レベルで制限すること。
- 型スロットは string / number / boolean / date / array / object / tuple / union の8種を維持すること。
- PluginCategory は standard / conditional / fieldReference / transform / arrayElement / context / preprocessor / builder-extension の8種を維持すること。
- `plugin()` / `pluginPredefinedTransform()` / `pluginConfigurableTransform()` / `pluginBuilderExtension()` の4ファクトリを公開 API として維持すること。
- `jsonSchemaPlugin` は category `builder-extension` で、`extendBuilder(builder)` によって `fromJsonSchema(schema, options?)` を生やし、**ビルダー自身を返して連鎖を継続できる**こと。
- `fromJsonSchema` は `additionalProperties: false` を `builder.strict()` に、`dependentRequired` を条件付き必須に落とし、ルートオブジェクト制約（path が空文字）を `v()` に渡さないこと。
- JSON Schema の未知 `format` は **valid として通す**（寛容）こと。`customFormats` が指定されればそれを優先し、値が関数でなければ無視して通すこと。
- `$ref` は `#/definitions/…` と `#/$defs/…` の内部参照のみ解決し、外部参照は例外を投げること。循環参照は visited セットで検出して無限ループを避けること。
- `eval` / `new Function` を使わずに全機能を実現すること（既存のフォーマット検証・変換はすべて正規表現とネイティブ操作のみで書かれている）。
- プラグイン引数が不正な場合（`range(100, 50)`、`range(NaN, 100)`）の扱いを1つに統一すること。旧実装は numberRange では検証時エラー、arrayMinLength では例外を投げる想定で不統一。
- 型ガード群（isObject / isPlainObject / … / isOneOfTypes）は新規約の `as any` 禁止・unknown+型ガード方針とそのまま合致するので、公開ユーティリティとして再実装すること。
- `globalConfig` の既定値（messageKeyPrefix="", toBooleanTruthyValues=["true","1","yes","on"], numberFormat={".",","} , dateFormat="YYYY-MM-DD", trimStrings=false, caseSensitive=true, customTransforms={}）と、部分更新・numberFormat のマージ・getter がコピーを返す性質を維持すること。
- 新テストは `validate()` の戻り値を `.valid` と `.isValid()` の両方で検証する冗長さをやめ、どちらか一方に統一すること（旧テストは同一ファイル内で混在している）。
- 新テストの describe/test 名にソースの行番号を書かないこと。行番号ベースの命名はカバレッジ稼ぎの証拠であり、リファクタで即座に嘘になる。
- 新テストはプラグインの private `impl` を `(plugin as any).impl` で叩かないこと。公開された `create()` 経由か、Builder 経由の振る舞いで検証すること。
- ユニットテストに実行時間のアサーション（`timePerValidation < 1ms` 等）を書かないこと。CI 環境で不安定であり、振る舞い仕様ではない。

## 引き継がないもの

- **ソース行番号を describe/test 名に埋め込んだカバレッジ稼ぎテスト群。test/unit/plugins/jsonSchema/coverage-100-percent.test.ts (842行/44合格)、同 final-100-percent.test.ts (385行/16合格)、同 coverage-final.test.ts (453行/コンパイル失敗)、test/unit/core/builder/validator-factory-coverage-boost.test.ts (486行/14合格)、test/unit/core/builder/validator-factory-advanced.test.ts (418行/10合格)、test/unit/plugins/common/jsonSchema-full-coverage.test.ts (876行/コンパイル失敗)、同 jsonSchema-internals.test.ts (546行/コンパイル失敗)、同 jsonSchema-helper-functions.test.ts (513行/14合格)。** — 「dsl-converter.ts - Lines 149-160」「Ultra-fast validator paths (lines 1602-1783)」のような名前は、仕様ではなく未到達行を埋める作業の記録。実装を作り直せば行番号は全部無意味になる。合計 4,500 行超で 98 テストが合格しているが、そのうち独立した意味論を1つも規定していない。
- **プラグインの private `impl` を直接叩く白箱テスト。test/unit/plugins/common/literal-simple.test.ts (1合格/12失敗)、同 optional-simple.test.ts (1/8)、test/unit/plugins/conditional/skip-simple.test.ts (1/9)、test/unit/plugins/transform/transform-simple.test.ts (describe.skip で全滅)、test/unit/plugins/transform/transform-comprehensive.test.ts (2/19)。** — すべて `(plugin as any).impl(...)` を呼んでおり、`impl` が公開 API でないため 48 テスト中 48 が失敗ないしスキップになっている。`as any` を使った時点で新規約違反であり、そもそもテスト対象が実装詳細。合格している唯一の価値ある部分はプラグインメタデータ（name/methodName/category/allowedTypes）の検証だけなので、それだけを新テストへ移すこと。
- **内部最適化レイヤの白箱テスト一式。test/unit/core/builder/ultra-fast-validator.test.ts (27合格)、同 raw-validator.test.ts (14/6)、同 array-batch-optimizer.test.ts (コンパイル失敗)、test/unit/core/optimization/strategy-factory.test.ts (12/4)、同 execution-strategy-selector.test.ts (12合格)、同 validation-engine.test.ts (コンパイル失敗)、test/unit/core/plugin/utils/field-accessor.test.ts (39合格)、同 field-accessor-optimized.test.ts (45/8)、test/unit/core/simple-nested-array.test.ts (2/2)、test/unit/core/nested-array-batching.test.ts (2/3)。** — `createUltraFastSingleFieldValidator` / `createUltraFastMultiFieldValidator` / `createRawValidator` / `createOptimalStrategy` / `prewarmCache` / `clearAllCaches` / アクセサキャッシュといった、公開されていない最適化実装の存在そのものを固定している。「should reuse result objects for performance」のようにミュータブル結果オブジェクトの再利用まで契約化しており、新実装の設計自由度を不当に縛る。外から観測できる振る舞い（正しい値が取れる・深いネストで落ちない）だけを結合テストとして残せばよい。
- **存在しないモジュールを import して丸ごとコンパイル失敗しているテスト。test/unit/luq/parser.test.ts (672行)、test/unit/luq/optimized-generator.test.ts (763行)、test/unit/ftv/parser.test.ts (549行)、test/unit/ftv/optimized-generator.test.ts (554行)、test/unit/plugins/advanced/switch.test.ts (`src/core/plugin/switch`)、同 recursivelyWithContext.test.ts (`src/core/plugin/recursivelyWithContext`)、test/unit/plugins/string/stringEquals.test.ts (`src/core/plugin/stringEquals`)、test/unit/plugins/common/jsonSchema-composition.test.ts (`src/core/plugin/any`)、同 jsonSchema-draft07-compliance.test.ts (`src/core/plugin/dynamic`)。** — 対象モジュールが src から削除済み。合計 2,500 行以上が完全な死コードで、`.luq` DSL パーサ／ジェネレータ (luq/ftv) に至っては機能そのものが Rust 側 compiler/ へ移っている。TypeScript ライブラリの仕様として引き継ぐものは何もない。
- **小文字typoで丸ごとコンパイル失敗しているテスト。test/unit/plugins/string/stringEmail.test.ts (`emptyresult`)、同 stringEndsWith.test.ts (`emptyresult`)、test/unit/plugins/number/numberFinite.test.ts (`positiveInfinityresult`)、test/unit/plugins/common/oneOf.test.ts (`nanresult`)、test/unit/core/multidimensional-array.test.ts (`validresult`)、test/unit/core/execution-order-integration.test.ts (`validresult`)。** — `const emptyResult = ...` を `emptyresult` で参照するという機械的な一括置換の失敗跡が6ファイルに散らばっている。テストが一度も実行されないまま放置されていた証拠であり、内容の正しさも保証されていない。ただし stringEmail / stringEndsWith / numberFinite / oneOf の**意図した検証内容**（メール形式・接尾辞・Infinity 拒否・列挙値一致）は新テストで書き直す価値がある。
- **アサーションをコメントアウトして通している空洞テスト。test/unit/plugins/array/arrayMaxLength.test.ts:349「エラーコンテキスト 最大長が含まれる」、test/unit/plugins/string/stringExactLength.test.ts:206「エラーコンテキスト 期待される長さが含まれる」、test/unit/core/builder/validator-factory.test.ts:249「should collect all errors by default」。** — 前2者は `// Context property is not available in current API` と書いて `expect(result.errors[0].context).toMatchObject(...)` を封印し、残るのは `isValid() === false` だけ。後者は `expect(result.errors.length).toBeGreaterThanOrEqual(1)` に弱められ、「デフォルトで全エラーを集める」というテスト名と正反対の内容を許している。テストを緑にするために契約を消した典型例で、そのまま引き継ぐと契約が無いことに気づけない。
- **重複したテストディレクトリ。test/unit/transform/string/{replace,sanitize}.test.ts (13+7テスト) と test/unit/core/transform/string/{replace,sanitize}.test.ts (46+34テスト)。test/unit/plugins/advanced/stitch.test.ts (761行) と test/unit/plugins/multiFieldReference/stitch.test.ts (460行)。test/unit/plugins/common/jsonSchema*.test.ts (10ファイル) と test/unit/plugins/jsonSchema/*.test.ts (11ファイル)。** — 同一対象を別ディレクトリで二重にテストしている。JSON Schema だけで 129 スイート中 22 スイート（17%）を占め、5,000 行以上が重複。stitch は両方ともコンパイル失敗している。新テストスイートは対象1つにつきファイル1つの原則で再編すること。
- **ユニットテスト内の性能アサーション。test/unit/plugins/common/required.test.ts「パフォーマンステスト 大量のフィールドでも高速に動作する」(`timePerValidation < 1`)、同種のものが numberMin / stringMin / stringDatetime / stringPattern / arrayMinLength / booleanFalsy / field-accessor / ultra-fast-validator にある。** — CI マシンの負荷で偽陽性・偽陰性になる。振る舞い仕様ではなく、しかも「10,000 回ループ」でテスト実行を遅くしている。性能は test/performance/ に隔離するか、ベンチマークとして別立てにすること。
- **src/core/plugin/__tests__/test-utils.ts。** — src 配下に置かれた唯一の「テスト」ディレクトリだが、中身は `export { createMockReporter, createMockContext } from '../testUtils';` の1行の re-export のみ。テストは1つも無く、src にテスト用ヘルパー(`src/core/plugin/testUtils.ts`)を出荷バンドルに混ぜている点でも tree-shaking と公開 API 衛生に反する。テストヘルパーは test/ 側に置くこと。
- **`async.experimental` レイヤの詳細 API。test/unit/core/async.experimental/{async-context, async-plugin-extensions, async-validator-integration, from-context-plugin}.test.ts (3,073行、138合格/15失敗)。`AsyncContextBuilder` クラス、`addAsyncSupport`、`enhanceValidatorWithAsync`、`extendFieldBuilderWithAsync`、`createOptimizedAsyncValidator`、`AsyncValidationHelpers.{createSimpleContext, withTimeout, mergeContexts}`、`AsyncDebugUtils.{measureAsyncContextBuild, compareValidationPerformance}`。** — ディレクトリ名が示すとおり実験機能で、`src/index.ts` から一切 export されていない＝公開 API ではない。`AsyncDebugUtils.compareValidationPerformance` のようなデバッグ用計測 API まで 138 テストで固定されている。引き継ぐ価値があるのは「非同期に取得した外部データを検証時コンテキストとして注入できる」という**思想**と、公開されている `fromContextPlugin` の意味論だけ。クラス構成・ヘルパー名は捨ててよい。

## 公開シンボル (170)

`Builder`, `createPluginRegistry`, `PluginRegistry`, `FieldRule`, `ExtractFieldRuleType`, `FieldRuleDefinition`, `FieldBuilder`, `TransformAwareValidator`, `ApplyFieldTransforms`, `ExtractFieldType`, `TypedPlugin`, `PluginType`, `PluginCategory`, `TypeName`, `BuilderExtensionPlugin`, `BuilderExtensionMethod`, `ValidationResult`, `ValidationOptions`, `MessageContext`, `MessageFactory`, `SEVERITY`, `Severity`, `ValidationError`, `Result`, `ValidResult`, `InvalidResult`, `ValidationState`, `LuqValidationException`, `createLuqValidationException`, `BasicValidationResult`, `StandardPluginImplementation`, `ConditionalPluginImplementation`, `TransformPluginImplementation`, `FieldReferencePluginImplementation`, `ArrayElementPluginImplementation`, `plugin`, `PluginImplementation`, `pluginPredefinedTransform`, `pluginConfigurableTransform`, `pluginBuilderExtension`, `GlobalConfig`, `globalConfig`, `setGlobalConfig`, `getGlobalConfig`, `resetGlobalConfig`, `requiredPlugin`, `optionalPlugin`, `nullablePlugin`, `requiredIfPlugin`, `optionalIfPlugin`, `skipPlugin`, `validateIfPlugin`, `orFailPlugin`, `oneOfPlugin`, `literalPlugin`, `compareFieldPlugin`, `customPlugin`, `stitchPlugin`, `stringMinPlugin`, `stringMaxPlugin`, `stringExactLengthPlugin`, `stringPatternPlugin`, `stringEmailPlugin`, `stringUrlPlugin`, `stringAlphanumericPlugin`, `stringStartsWithPlugin`, `stringEndsWithPlugin`, `stringDatetimePlugin`, `stringDatePlugin`, `stringTimePlugin`, `stringDurationPlugin`, `stringIpv4Plugin`, `stringIpv6Plugin`, `stringHostnamePlugin`, `stringJsonPointerPlugin`, `stringRelativeJsonPointerPlugin`, `stringBase64Plugin`, `stringIriPlugin`, `stringIriReferencePlugin`, `stringUriTemplatePlugin`, `stringContentEncodingPlugin`, `stringContentMediaTypePlugin`, `uuidPlugin`, `numberMinPlugin`, `numberMaxPlugin`, `numberPositivePlugin`, `numberNegativePlugin`, `numberIntegerPlugin`, `numberFinitePlugin`, `numberMultipleOfPlugin`, `numberRangePlugin`, `booleanTruthyPlugin`, `booleanFalsyPlugin`, `arrayMinLengthPlugin`, `arrayMaxLengthPlugin`, `arrayUniquePlugin`, `arrayIncludesPlugin`, `arrayContainsPlugin`, `objectPlugin`, `objectRecursivelyPlugin`, `recursivelyPlugin`, `objectMinPropertiesPlugin`, `objectMaxPropertiesPlugin`, `objectAdditionalPropertiesPlugin`, `objectPropertyNamesPlugin`, `objectPatternPropertiesPlugin`, `objectDependentRequiredPlugin`, `objectDependentSchemasPlugin`, `transformPlugin`, `unionGuardPlugin`, `tupleBuilderPlugin`, `fromContextPlugin`, `readOnlyWriteOnlyPlugin`, `jsonSchemaPlugin`, `jsonSchemaFullFeaturePlugin`, `validateValueAgainstSchema`, `getDetailedValidationErrors`, `getSpecificValidationErrors`, `convertJsonSchemaToLuqDSL`, `convertDSLToFieldDefinition`, `resolveRef`, `resolveSchemaRef`, `resolveAllRefs`, `validateFormat`, `getSupportedFormats`, `isFormatSupported`, `use`, `for`, `v`, `field`, `useField`, `strict`, `build`, `validate`, `parse`, `pick`, `fromJsonSchema`, `isValid`, `isError`, `unwrap`, `unwrapOr`, `unwrapOrElse`, `map`, `flatMap`, `tap`, `tapError`, `data`, `errors`, `valid`, `toPlainObject`, `isObject`, `isPlainObject`, `isString`, `isNumber`, `isBoolean`, `isFunction`, `isArray`, `isNullish`, `isUndefined`, `isNull`, `isError`, `hasProperty`, `isValidDate`, `isFiniteNumber`, `isInteger`, `isOneOfTypes`, `createDefaultValue`, `createReplace`, `createReplaceAll`, `sanitize`

