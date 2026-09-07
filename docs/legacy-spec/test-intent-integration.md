# test-intent-integration

読んだ範囲: test/integration 38ファイル、test/edge-cases 3ファイル、test/type-restrictions 1ファイル、test/plugin-registry 6ファイル、test/demo 8ファイル (計 22,490行)。**test/type-safety/ は空ディレクトリ**であり、この領域に「型レベルの契約」を記録した自動テストは1件も存在しない (`@ts-expect-error` / `expectTypeOf` / `tsd` の使用箇所はゼロ)。negative な型テストは (a) コメントアウトされたコードブロック、(b) `const x: IsForbiddenTransformOutput<T> = true` という型レベル代入、(c) jest が拾わない `test/demo/*.ts` (jest.config.js の testMatch は `*.test.ts` のみ、demo は `.ts` なので**一度も実行されていない**) の3形態でしか存在しない。

抽出できた本物の意味論は主に4系統:
(1) ビルダー公開API とチェーン意味論 (validate/parse の差、abortEarly、エラーパス形式)
(2) null/undefined と required/optional/nullable の境界 — ただし**3つの edge-cases ファイルが互いに矛盾**している
(3) 配列要素バリデーション — ここも**同一ディレクトリ内で真っ向から矛盾**する2群のテストがある
(4) JSON Schema Draft-07 の実行時読み込み (fromJsonSchema) とキーワード網羅

捨てるべきものが極めて多い。jsonschema-* 16ファイル中 13ファイルは公開APIではなく内部関数 (`validateValueAgainstSchema`, `resolveRef`, `convertJsonSchemaToLuqDSL`, `convertDSLToFieldDefinition`) をモック混じりで叩くカバレッジ稼ぎ。array-* 6ファイルは `console.log` + `expect(true).toBe(true)` か、宣言していない制約のエラーを期待する実現不能な空想。plugin-registry-mock-tests.test.ts は被テスト対象自体を jest.mock で差し替えており、モックの振る舞いをテストしているだけで完全に無価値。

## 引き継ぐ契約 (26件)

### must-preserve (15)

#### Builder().use(plugin).for<T>().v(path, b => chain).build()
- 出典: `test/integration/plugin-system-integration.test.ts, test/integration/core-features-coverage.test.ts`
- 形: Builder(): BuilderChain; .use(plugin): BuilderChain (プラグイン型が累積); .for<T>(): TypedBuilder<T>; .v(fieldPath: keyof-path of T, def: (b: FieldContext<T>) => Chain): TypedBuilder<T>; .build(): Validator<T>
- 意味: 全 137 テストファイル中ほぼ全てがこの形。.use() は何度でも呼べ、同一プラグインの重複登録はエラーにならず無視される (plugin-system-integration.test.ts 'should handle duplicate plugin registrations gracefully')。プラグイン登録順は結果に影響しない ('should handle plugin order independence' が validator1/validator2 で同一結果を要求)。プラグイン0個の Builder() でも .for<T>().build() でき、ルール0個の validator は常に valid を返す。.v() の第2引数は必ず `b => ...` のコールバックで、b は型ごとの名前空間 (b.string / b.number / b.boolean / b.array / b.object / b.union) を持つ。

#### Validator.validate(value, options?) / Validator.parse(value, options?)
- 出典: `test/integration/error-handling-comprehensive.test.ts, test/integration/core-features-coverage.test.ts, test/integration/complex-validations.test.ts`
- 形: validate(value: unknown, options?: { abortEarly?: boolean; abortEarlyOnEachField?: boolean }): ValidationResult<T>
  parse(value: unknown, options?: { abortEarly?: boolean }): ValidationResult<TOut>
- 意味: **validate() は transform を実行しない。parse() のみ transform を適用する。** これはライブラリ全体で最も重要な意味論の分岐であり、error-handling-comprehensive.test.ts が明示的に記録している (「validate() doesn't run transforms, so validation passes」)。validate() は元の値に対して制約を評価するため、trim 前提の min() は validate では元の長さで判定される。parse() は変換後の値を data()/unwrap() で返す。

#### ValidationResult
- 出典: `test/integration/abort-early-real-world.test.ts, test/plugin-registry/individual-field-validation.test.ts, test/demo/onSuccessPostProcess-usage-examples.ts`
- 形: { valid: boolean; errors: ValidationError[]; isValid(): boolean; isError(): boolean; data(): T | undefined; unwrap(): T; tap(fn): this; tapError(fn): this; map(fn): ValidationResult<U>; onSuccessPostProcess(fn): this }
- 意味: `.valid` (プロパティ) と `.isValid()` (メソッド) が**両方**使われており (594 validate 呼び出しに対し .isValid() 374回、.valid 多数)、同じ意味。`.errors` はプロパティ (メソッドではない)。`.data()` はメソッドで、失敗時は undefined。`.unwrap()` は成功値を返す。`.tap`/`.tapError`/`.map`/`.onSuccessPostProcess` はチェーン可能なコンビネータ。

#### ValidationError
- 出典: `test/integration/array-implementation-status.test.ts, test/integration/error-handling-comprehensive.test.ts, test/plugin-registry/plugin-registry-comprehensive.test.ts`
- 形: { path: string; message: string; code: string }
- 意味: path はドット区切りのフィールドパス (ネストは 'a.b.c.d.e.f'、配列要素は 'items[0].name'、多次元は 'matrix[0][1]')。code は違反したプラグイン名の camelCase 文字列: 実測で 'required', 'stringMin', 'arrayMinLength', および FieldRule 経由の 'FIELD_RULE_ERROR' / 'FIELD_RULE_PARSE_ERROR'。message は文字列だが messageFactory が null を返した場合ライブラリはそれをそのまま保持する (error-handling-comprehensive.test.ts が `expect(result.errors[0].message).toBe(null)` を明示)。

#### abortEarly / abortEarlyOnEachField
- 出典: `test/integration/abort-early-real-world.test.ts, test/integration/array-element-validation-fix.test.ts`
- 形: validate(data, { abortEarly?: boolean /* default true */, abortEarlyOnEachField?: boolean })
- 意味: **abortEarly のデフォルトは true** — 無指定だと errors.length は必ず 1 (abort-early-real-world.test.ts が `expect(result.errors).toHaveLength(1) // Only first error` を明示)。abortEarly:false で全フィールドのエラーを収集。abortEarlyOnEachField:true は「フィールドごとに最初の1件だけ」、false は「1フィールドに複数エラーを許す」(password が min + 3つの pattern に違反したとき passwordErrors.length > 1 を要求)。2軸が直交している点が設計の肝。

#### ネストフィールドパス指定
- 出典: `test/integration/nested-objects.test.ts, test/integration/error-handling-comprehensive.test.ts, test/edge-cases/null-undefined.test.ts`
- 形: .v("a.b.c.d.e.f", b => ...)
- 意味: 任意深度のドット記法をサポート (5階層・6階層のテストあり)。親が存在しない/null の場合、子の required は失敗する。親を object.optional() で宣言すれば子は未定義でも通る。エラー path は宣言したパスがそのまま返る。

#### 配列要素フィールドパス
- 出典: `test/integration/complex-validations.test.ts, test/integration/array-batching-real-world.test.ts, test/integration/nested-array-object-validation.test.ts`
- 形: .v("items[*].name", ...) および .v("items.name", ...)
- 意味: **2種類の記法が併存している。** complex-validations.test.ts と nested-objects.test.ts は `items[*].productId` を使い、array-element-validation-*.test.ts / array-batching-real-world.test.ts / nested-array-object-validation.test.ts は `items.name` (角括弧なし) を使う。どちらも「配列の各要素に対して適用」の意図。エラー path はいずれの記法でも具体的インデックス付き `items[0].name` になる。多段ネスト配列は `departments[0].teams[0].teamName`、配列内オブジェクト内オブジェクトは `data[1].nested.inner`。

#### 条件付きバリデーション述語 (requiredIf / optionalIf / validateIf / skip)
- 出典: `test/integration/plugin-system-integration.test.ts, test/integration/complex-validations.test.ts, test/integration/core-features-coverage.test.ts, test/integration/edge-cases-coverage.test.ts`
- 形: b.<type>.requiredIf((rootData: T) => boolean)
  b.<type>.optionalIf((rootData: T) => boolean)
  b.<type>.validateIf((rootData: T) => boolean)
  b.<type>.skip((rootData: T) => boolean)
- 意味: 述語は**ルートオブジェクト全体**を受け取る (ネストフィールドの定義内でも `data.auth?.type === 'bearer'` のようにルートから辿る)。requiredIf: 真なら必須・偽なら省略可。validateIf: 真のときだけ後続の制約を評価。skip: 真なら以降のチェーン (required 含む) を全てスキップして valid とする。skip は同一チェーンに複数回書け、OR 条件として働く (core-features-coverage.test.ts 'should handle multiple skip conditions')。skip 述語は validate 1回につき必ず呼ばれる (呼び出し回数 > 0 を検証)。述語内で存在しないプロパティを触っても例外を出してはいけない。

#### fromJsonSchema
- 出典: `test/integration/jsonschema-full-feature.test.ts, test/integration/jsonschema-format.test.ts, test/integration/jsonschema-ultimate-final.test.ts`
- 形: Builder().use(jsonSchemaFullFeaturePlugin).fromJsonSchema(schema: JSONSchema7, options?: { strictRequired?: boolean; allowAdditionalProperties?: boolean; customFormats?: Record<string, (value: string) => boolean> }).build()
- 意味: 実行時に JSON Schema Draft-07 を読み込んで validator を生成する。`.for<T>()` を経由せずに直接 `.fromJsonSchema()` を呼ぶ (Builder の別の入口)。返り値はさらに `.build()` できるビルダー。jsonSchemaFullFeaturePlugin 1個の use だけで全機能が使える合成プラグインとして提供されている。customFormats でユーザ定義 format 名を登録できる。

#### JSON Schema サポートキーワード (テストが実際に使用している全件)
- 出典: `test/integration/jsonschema-full-coverage.test.ts, test/integration/jsonschema-100-percent.test.ts, test/integration/jsonschema-full-feature.test.ts, test/integration/jsonschema-final-assault.test.ts`
- 形: type, properties, required, additionalProperties, patternProperties, propertyNames, minProperties, maxProperties, dependentRequired, dependentSchemas, dependencies, items, additionalItems, contains, minItems, maxItems, uniqueItems, minLength, maxLength, pattern, format, contentEncoding, contentMediaType, minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, enum, const, allOf, anyOf, oneOf, not, if, then, else, $ref, $defs, definitions, readOnly, writeOnly, nullable, $schema
- 意味: 上記が test/integration/jsonschema-*.test.ts で実際にスキーマ中に出現する全キーワード (省略なし・出現数付きで実測)。type は単一値と配列 (`type: ["string","number"]` = multipleTypes) の両方をサポート。$ref は `#/definitions/x` と `#/$defs/x` の両方を解決する。items は単一スキーマ (全要素) と配列 (タプル) の両形式。プリミティブ型判定: type:'number' は NaN を拒否、type:'integer' は 3.14 を拒否、type:'null' は undefined と 0 を拒否、type:'array' は {} を拒否、type:'object' は [] と null を拒否。

#### JSON Schema format 値 (テストが実際に使用している全件)
- 出典: `test/integration/jsonschema-100-percent.test.ts, test/integration/jsonschema-format.test.ts, test/integration/jsonschema-full-feature.test.ts`
- 形: 標準: email, uuid, uri, uri-reference, uri-template, url, date, date-time, time, duration, ipv4, ipv6, hostname, json-pointer, relative-json-pointer, iri, iri-reference, regex
  非標準(カスタム扱い): ssn, phone, credit-card, postal-code, product-code, custom-id, custom-format, custom, unknown-format, undefined-format
- 意味: 上記が jsonschema-* 全ファイルに出現する format 値の全件。標準 format には対応するプラグインが 1:1 で存在する (stringEmailPlugin, uuidPlugin, stringUrlPlugin, stringIpv4Plugin, stringIpv6Plugin, stringHostnamePlugin, stringTimePlugin, stringDurationPlugin, stringJsonPointerPlugin, stringRelativeJsonPointerPlugin, stringIriPlugin, stringIriReferencePlugin, stringUriTemplatePlugin, stringBase64Plugin, stringContentEncodingPlugin)。未知の format 名は customFormats で登録されない限りエラーにせず素通しする方針 ('unknown-format' / 'undefined-format' のテストが存在)。具体的な合格例: email 'test@example.com', uuid '550e8400-e29b-41d4-a716-446655440000', ipv6 '2001:db8::8a2e:370:7334', duration 'P1Y2M3DT4H5M6S', json-pointer '/foo/bar/0', relative-json-pointer '1/foo/bar', iri 'https://例え.jp/パス', uri-template '/users/{id}/posts/{postId}', time '12:34:56'。不合格例: email 'not-an-email', date '2024-13-01', ipv4 '999.999.999.999', date-time 'not-a-datetime'。date-time は 'Z' サフィックスと '+09:00' オフセットの両方を受理しなければならない。

#### required / optional / nullable の基本意味論
- 出典: `test/edge-cases/null-undefined.test.ts, test/edge-cases/null-undefined-fixed.test.ts, test/integration/array-implementation-status.test.ts`
- 形: b.<type>.required() / .optional() / .nullable()
- 意味: required: undefined・null・欠損プロパティ・空文字列 '' をすべて拒否 (空文字が拒否される点は null-undefined-fixed.test.ts が明示)。optional: undefined と欠損を許して後続チェーンをスキップ、値があれば後続を実行。nullable: null を許して後続チェーンをスキップ、値があれば後続を実行。b.array.required() は空配列 [] を許す (存在すれば valid)。b.object.required() は null / undefined を拒否。

#### 数値・文字列・配列の境界値
- 出典: `test/integration/edge-cases-coverage.test.ts`
- 形: min/max/minLength/maxLength の境界包含
- 意味: すべて**閉区間 (境界値を含む)**。string.min(5).max(10): 5文字・10文字は valid、4文字・11文字は invalid。number.min(0).max(100): 0 と 100 は valid、-0.1 と 100.1 は invalid。number.min(0) は -0 を valid、Infinity を valid、-Infinity を invalid とする。NaN の扱いは未規定 (テストは「クラッシュしないこと」しか要求していない)。string.min(1) は '' を invalid、' ' / '\n' / '\t' を valid とする (トリムしない)。文字列長は JS の .length (UTF-16 コード単位) で計算する。array.minLength(0) は [] を valid とする。

#### 堅牢性 (クラッシュしない保証)
- 出典: `test/integration/edge-cases-coverage.test.ts, test/integration/error-handling-comprehensive.test.ts`
- 形: —
- 意味: 以下の入力で例外を投げてはならない: 循環参照オブジェクト (obj.self = obj)、1000段ネストの再帰的データ構造 (スタックオーバーフローしない)、`Object.create(null)` で作った prototype なしオブジェクト、__proto__ を差し替えた配列、疎配列 ['a', , 'c', , 'e'] (length 5 として扱う)、1000プロパティのオブジェクト、10000要素の配列、100KB の文字列、min > max のような矛盾した設定 (min(-1).max(-5))、required().optional() のような矛盾したチェーン。いずれも「boolean を返す」ことだけが保証される。

#### transform チェーン
- 出典: `test/integration/edge-cases-coverage.test.ts, test/integration/complex-validations.test.ts, test/edge-cases/null-undefined.test.ts`
- 形: b.<type>.<constraints>().transform(fn).transform(fn)...
- 意味: 同一チェーンに複数の transform を連ねられ、宣言順に適用される (trim → toLowerCase → replace)。制約と transform は任意の順で混在できる (min(5).transform(trim).max(10))。parse() の結果は変換後の値。transform は null/undefined に対しても呼ばれる可能性があるため利用側で防御する例が記録されている。

### should-preserve (9)

#### compareField
- 出典: `test/integration/plugin-system-integration.test.ts, test/integration/complex-validations.test.ts`
- 形: b.string.required().compareField(otherPath: string)
- 意味: 同一オブジェクト内の別フィールドとの一致を検証。トップレベル名 ('password') だけでなく**ドット区切りのネストパス ('account.password') も受け付ける**。

#### union + guard
- 出典: `test/integration/complex-validations.test.ts`
- 形: b.union.required().guard((v): v is X => ..., (b) => b.object.required()).guard(...)
- 意味: 判別可能ユニオンの各枝を型ガード関数 + サブビルダーのペアで宣言する。guard はチェーンで複数連ねられる。ユニオンの枝ごとのフィールド検証は別途 `.v("paymentMethod.cardNumber", b => b.string.validateIf(d => d.paymentMethod.type === 'credit').pattern(...))` として書く運用になっている。

#### object.recursively
- 出典: `test/integration/nested-objects.test.ts`
- 形: b.object.recursively({ maxDepth: number, validate: (ctx: { current: unknown; path: string }) => { valid: boolean; errors?: Array<{path,message,code}> } })
- 意味: 再帰的なツリー構造 (children を持つノード) を深さ制限付きで走査し、各ノードに対してユーザ定義の検証関数を呼ぶ。ctx.path はそのノードまでのパス、ctx.current はノード本体。返す errors の path はユーザが `ctx.path + '.id'` のように組み立てる。

#### messageFactory オプション
- 出典: `test/integration/error-handling-comprehensive.test.ts, test/integration/edge-cases-coverage.test.ts, test/edge-cases/null-undefined.test.ts`
- 形: b.string.required({ messageFactory: (ctx: { value: unknown, ... }) => string })
- 意味: バリデータ呼び出しの第1引数オブジェクトに `messageFactory` を渡してエラーメッセージを差し替える。ctx.value で実際の値 (null / undefined を区別可能) にアクセスできる。**messageFactory が例外を投げてもバリデーション全体はクラッシュせず、フォールバックメッセージでエラーを返す**。多バイト文字・絵文字・非常に長い文字列をそのまま保持する。

#### custom バリデータ
- 出典: `test/plugin-registry/individual-field-validation.test.ts, test/plugin-registry/field-rule-practical-examples.test.ts`
- 形: b.<type>.custom(fn, options?)  — fn: (value) => boolean | { valid: boolean; message?: string }; options: { message: string }
- 意味: **2つの返り値形式を両方サポートしている。** individual-field-validation.test.ts は `(value) => boolean` + `{ message }` オプション形式、field-rule-practical-examples.test.ts は `(value) => ({ valid: false, message: '...' })` 形式。新実装ではどちらか一方に統一すべき (openQuestions 参照)。

#### createPluginRegistry / FieldRule / useField
- 出典: `test/plugin-registry/individual-field-validation.test.ts, test/plugin-registry/simplified-test.test.ts, test/plugin-registry/plugin-registry-comprehensive.test.ts`
- 形: createPluginRegistry(): Registry
    .use(plugin): Registry
    .getPlugins(): Record<string, Plugin>
    .toBuilder(): BuilderChain
    .createFieldRule<T>(def: (b) => Chain, options?: { name?: string; description?: string }): FieldRule<T>
  FieldRule<T>: { name?: string; description?: string; validate(value: T | null | undefined, options?): ValidationResult<T>; parse(value, options?): ValidationResult<T>; getPluginRegistry(): Registry }
- 意味: 単一フィールドを型 T に対して独立に検証する再利用可能ルールを作る仕組み。Registry から複数の FieldRule を作れ、互いに独立に動く。`.getPlugins()` は登録済みプラグインを名前キーの Record で返す (キーは 'required', 'stringMin', 'stringEmail', 'transform' など、Plugin シンボル名から 'Plugin' を除いた形)。`.toBuilder()` で通常の Builder に変換でき、`.for<T>().useField(fieldName, fieldRule)` で FieldRule をフィールド定義として組み込める (通常の .v() と混在可)。ルール定義関数が例外を投げた場合、validate は code 'FIELD_RULE_ERROR'、parse は code 'FIELD_RULE_PARSE_ERROR' のエラーを返す (投げ返さない)。非 Error 値が throw された場合は message が 'Validation failed' / 'Parse failed' になる。

#### contentEncoding / contentMediaType の実体検証
- 出典: `test/integration/jsonschema-content-validation.test.ts`
- 形: { type: 'string', contentEncoding: 'base64', contentMediaType: 'application/json' }
- 意味: 単なるアノテーションではなく**実際に中身を検証する**。contentEncoding:'base64' は文字列が正しい base64 かを検証 ('Not valid base64!@#' は不合格)。contentMediaType:'application/json' は (contentEncoding があればデコードした上で) JSON としてパース可能かを検証。'text/html' は HTML らしさ、'text/xml' は XML らしさを検証する ('not xml' は不合格、'Not HTML content' は不合格)。'text/css' / 'text/javascript' / 'text/plain' も対象。ネストしたオブジェクトのプロパティでも同様に効く。

#### array.unique の同値判定
- 出典: `test/integration/edge-cases-coverage.test.ts, test/plugin-registry/individual-field-validation.test.ts`
- 形: b.array.required().unique()
- 意味: [null, undefined, 1] は unique (valid)。[null, null] は重複 (invalid)。[1,2,2,3] は invalid。プリミティブの厳密等価で判定していると読める。

#### parse() の出力オブジェクト構造
- 出典: `test/edge-cases/null-undefined.test.ts, test/integration/complex-validations.test.ts`
- 形: parse(input).data(): TOut
- 意味: **宣言されたフィールドのうち入力に存在したものだけが出力に含まれる。** 入力が {} のとき、optional().transform(v => v ?? 'Anonymous') を宣言していても出力は {} になる (transform は存在する値にしか走らない)。一方 null が存在すれば transform は走り、{ name: 'Anonymous', count: 0 } になる。宣言していないフィールドは保持される (complex-validations の metadata がそのまま出力に残る)。

### optional (2)

#### transform の返り値型制限 (型レベル)
- 出典: `test/type-restrictions/transform-array-object-restriction.test.ts, test/demo/editor-error-demonstration.ts, test/demo/final-union-restriction-verification.ts, test/demo/implementation-status-report.md`
- 形: IsForbiddenTransformOutput<T>, CheckTransformFunction<F>, ForbiddenTransformError<T>
- 意味: transform が Array<plain object> または Array<union containing plain object> を返す場合、**コンパイルエラーにする**。許可: Array<primitive> (string[], number[], boolean[])、Array<primitive union> ((string|number)[], (string|number|boolean)[])、Array<Date>/Array<RegExp> (特殊オブジェクトは除外)、非配列 (string, number, object)。エラー型は _error/_reason/_received/_suggestion/_example のフィールドを持つオブジェクト型で、開発者に代替案を提示する。**この制限の理由は「ネスト配列バリデーションの実装都合」と明記されており、設計思想ではなく実装制約である** (openQuestions 参照)。

#### onSuccessPostProcess
- 出典: `test/demo/onSuccessPostProcess-usage-examples.ts`
- 形: result.onSuccessPostProcess((data: T) => void | Promise<void>): this
- 意味: バリデーション成功時のみ実行される副作用フック。validate()/parse() どちらの結果にも使える。デモ自身が「tap() と同じ機能で名前が分かりやすいだけ」と明記している。async 関数も渡せる (待たれない)。

## 振る舞い規則

- validate() は transform を一切適用せず、元の入力値に対して制約を評価する。parse() のみ transform を適用し、変換後の値を data()/unwrap() で返す。この2メソッドの分離を必ず維持すること。
- abortEarly のデフォルトは true。オプション無指定の validate() は必ず errors.length === 1 を返す。
- abortEarly:false + abortEarlyOnEachField:true = 「フィールドごとに最初の1件」、abortEarly:false + abortEarlyOnEachField:false = 「全違反を列挙」。2軸は直交する。
- エラーの path は宣言パスに具体的な配列インデックスを埋め込んだ形で返す: 'items[0].name', 'departments[0].teams[0].teamName', 'data[1].nested.inner', 'matrix[0][1]'。
- required() は undefined・null・欠損プロパティ・空文字列 '' をすべて拒否する。
- optional() は undefined と欠損のみ許し後続をスキップする。null は許さない。
- nullable() は null のみ許し後続をスキップする。undefined は素通しする (型チェックを行わない)。
- array.required() は空配列 [] を valid とする。長さ制約は minLength/maxLength が担う。
- min/max/minLength/maxLength はすべて閉区間 (境界値を含む)。
- number.min(0) は 0 と -0 と Infinity を valid、-Infinity を invalid とする。
- 文字列長は JS の .length (UTF-16 コード単位) で数える。トリムはしない。' ' や '\n' は長さ1として valid。
- requiredIf / optionalIf / validateIf / skip の述語はルートオブジェクト全体を受け取る。ネストフィールドの定義内でもルートから辿る。
- skip は同一チェーンに複数書け、いずれかが真ならそのフィールドの検証を丸ごとスキップして valid とする。skip 述語は毎回必ず評価される。
- compareField はドット区切りのネストパスを受け付ける。
- プラグインの重複 use() はエラーにせず無視する。プラグインの登録順は検証結果に影響しない。
- プラグイン0個の Builder、ルール0個の validator は常に valid を返す。
- messageFactory が例外を投げてもバリデーション全体はクラッシュせず、フォールバックメッセージ付きのエラーを返す。
- messageFactory が null を返した場合、ライブラリはそれを加工せず error.message にそのまま格納する。
- FieldRule の定義関数が例外を投げた場合、投げ返さず code 'FIELD_RULE_ERROR' (validate) / 'FIELD_RULE_PARSE_ERROR' (parse) のエラー結果を返す。非 Error が throw された場合 message は 'Validation failed' / 'Parse failed'。
- 循環参照・1000段ネスト・prototype なしオブジェクト・疎配列・__proto__ 差し替え配列・10000要素配列・100KB文字列・矛盾した制約設定 (min(-1).max(-5), required().optional()) のいずれでも例外を投げてはならない。
- JSON Schema の type は単一値と配列 (multipleTypes) の両方を受理する。
- JSON Schema の $ref は '#/definitions/x' と '#/$defs/x' の両方を解決する。
- JSON Schema の contentEncoding / contentMediaType はアノテーションではなく実体検証を行う (base64 デコード可能性、JSON/HTML/XML としての妥当性)。
- JSON Schema の未知 format は customFormats で登録されていない限りエラーにせず素通しする。
- JSON Schema の date-time は 'Z' サフィックスと '+09:00' 形式のオフセットの両方を受理する。
- parse() の出力には入力に存在したフィールドのみが含まれる。欠損フィールドに対して transform は実行されない。
- eval / new Function を使わずにこれらすべてを実現する (CSP-safe は絶対要件)。

## 引き継がないもの

- **test/type-safety/ ディレクトリ (空)** — 型安全性テストが1件も存在しない。「型レベルの契約が記録されている」という前提自体が成立していない。新実装では tsd / expectTypeOf / @ts-expect-error による**本物の**negative 型テストをゼロから作る必要がある。
- **test/demo/*.ts 8ファイル (editor-error-demonstration.ts, specific-error-cases.ts, improved-error-messages.ts, final-error-message-test.ts, final-union-restriction-verification.ts, simple-union-error-test.ts, onSuccessPostProcess-usage-examples.ts, implementation-status-report.md)** — jest.config.js の testMatch は '*.test.ts' のみで、これらは .ts / .md のため**一度も実行されたことがない**。中身は console.log と「エディタで開くとエラーが出るはず」というコメントだけ。型制限の検証手段としてまったく機能していない。記録されている意味論 (transform の Array<object> 制限) だけを抽出済み。ファイル自体は全廃棄。
- **test/plugin-registry/plugin-registry-mock-tests.test.ts (277行)** — jest.mock('src/core/builder/context/field-context') で**被テスト対象そのものをモックに差し替えている**。'execution-test' を渡すと 'EXECUTION-TEST' が返る、といったモックが自分で書いた振る舞いを検証しているだけ。冒頭コメントも「to reach 90% coverage」と目的を自白している。完全に無価値。
- **test/integration/jsonschema-final-100-percent, -final-assault, -turbo-100-percent, -surgical-100-percent, -ultimate-final, -ultra-final-266, -final-290-lines, -final-140-lines, -final-push, -simple-final, -precision-coverage, -targeted-coverage, -uncovered (13ファイル / 約7,700行)** — すべてカバレッジ数値稼ぎ目的。ファイル名 (「残り224行」「Final Assault」「Surgical」) と冒頭コメント (「to improve coverage from 65.57% to 90%」「Focus on uncovered lines: 191, 201-204, 212-266」) が目的を自白している。テスト対象は公開APIではなく内部関数 convertJsonSchemaToLuqDSL / convertDSLToFieldDefinition (src/index.ts に export されていない) で、mockBuilder に対して toHaveBeenCalledWith を検証する実装密結合テスト。新実装で内部構造が変われば全滅する上、守るべき契約を何も記録していない。
- **test/integration/jsonschema-full-coverage.test.ts / jsonschema-comprehensive-coverage.test.ts の関数レベルAPI (validateValueAgainstSchema(value, schema, formats?, rootSchema?), resolveRef, getDetailedValidationErrors)** — これらの関数は src/index.ts に export されておらず公開契約ではない。ただし**そこに書かれた JSON Schema の意味論 (型判定・キーワード解釈) は価値がある**ので、公開API (fromJsonSchema) 経由の conformance スイートとして書き直すこと。関数シグネチャ自体は引き継がない。
- **test/integration/array-implementation-status.test.ts, array-implementation-summary.test.ts, array-optimization-demonstration.test.ts, array-type-analysis-demonstration.test.ts (約1,200行)** — 実質すべて console.log による「実装状況レポート」で、アサーションは expect(true).toBe(true) か、内部型ユーティリティ (BuildTimeArrayAnalyzer, ArrayDepth<T>, indexPattern '[i][j]', loopVariables ['i','j']) の検証。これらは配列バリデーションの内部最適化の実装詳細であり、公開契約ではない。さらに array-implementation-status.test.ts は**配列要素バリデーションが動かないことを expect(result.isValid()).toBe(true) で固定している** (壊れた挙動をテストで固定するアンチパターン)。
- **test/integration/multidimensional-array-validation.test.ts (437行)** — 実現不能な空想。例: imageData に対して .v('imageData', b => b.array.required().minLength(1)) しか宣言していないのに、errorPaths が 'imageData[0][2]' (値 300 > 255) を含むことを期待する。0..255 という制約はどこにも宣言されていない。3Dテンソルの 'data[0][0][0].value' も同様に宣言なし。テストが記録しているのは実装ではなく願望。**ただし多次元配列のエラーパス表記 (a[0][1], a[0][1][2].field) という設計意図だけは openQuestions として引き継ぐ価値がある。**
- **test/integration/performance-optimization-verification.test.ts (713行) および各所に散在する performance.now() ベースの閾値アサーション** — 「simple validation ≥100k ops/sec」「complex ≥10k ops/sec」「50ms 以内」「10ms 以内」といったマシン依存・負荷依存の数値をユニットテストに埋め込んでおり、CI で不安定になる。性能は別のベンチマークスイート (専用ハーネス、統計処理、リグレッション判定) に分離すべきで、jest のアサーションにしてはならない。global.gc 依存の memoryUsageMB 計測も --expose-gc なしでは意味をなさない。
- **test/integration/v8-optimization-integration.test.ts.disabled** — .disabled 拡張子で無効化されており、かつ result 変数名のタイポ (9箇所) を含む。既に死んでいる。
- **コンパイルエラーを含むテストファイル群 (error-handling-comprehensive.test.ts の normalresult/parseresult/errorresult/failresult、nested-objects.test.ts の invalidresult、array-validation-simple.test.ts の validresult、array-batching-real-world.test.ts の invalidresult、multidimensional-array-validation.test.ts の validresult/invalidresult)** — 小文字始まりの未定義変数を参照しており、そのままでは TS コンパイルが通らない (実質これらのスイートは失敗している)。中身の意味論は本レポートで抽出済みなので、ファイル自体は捨ててよい。
- **`.valid` プロパティと `.isValid()` メソッドの二重提供** — 同じ情報への2つの入口が全テストで無秩序に混在しており (594 validate 呼び出しに対し .isValid() 374回 + .valid 多数)、読み手が「どちらが正か」を判断できない。新実装ではどちらか一方に統一すべき。判別可能ユニオン (`{ valid: true; data: T } | { valid: false; errors: E[] }`) にするならプロパティ側、Result モナド風にするならメソッド側。
- **parse() が transform 例外を throw する挙動** — error-handling-comprehensive.test.ts が `expect(() => validator.parse({ text: 'FAIL' })).toThrow('Middle transform failed')` を記録している。validate/parse が Result を返す設計なのに transform 例外だけ throw で漏れるのは一貫性を欠く。新実装では Result のエラーとして捕捉すべき (FieldRule 側は既に例外を捕捉して 'FIELD_RULE_PARSE_ERROR' を返しており、この点でも矛盾している)。
- **onSuccessPostProcess** — デモ自身が「tap() と同じ機能で名前が分かりやすいだけ」と明記している純粋な別名。API 表面積を無駄に増やす。tap() に一本化すべき。
- **plugin-registry/individual-field-validation.test.ts の 'should apply default value' テスト** — .default() を一度も呼んでいないのに parse(undefined) が 'active' を返すことを期待している。テスト自体が壊れている。
- **'items[*].field' と 'items.field' という2種類の配列要素パス記法の併存** — 同じ意味に2つの構文がある状態は仕様の曖昧さそのもの。新実装では1つに決めること (推奨: 明示的な `items[*].field`。`items.field` は「items というオブジェクトの field」との区別がつかない)。

## 公開シンボル (139)

`Builder`, `createPluginRegistry`, `FieldRule`, `use`, `for`, `v`, `build`, `validate`, `parse`, `fromJsonSchema`, `toBuilder`, `createFieldRule`, `getPlugins`, `getPluginRegistry`, `useField`, `valid`, `errors`, `isValid`, `isError`, `data`, `unwrap`, `tap`, `tapError`, `map`, `onSuccessPostProcess`, `abortEarly`, `abortEarlyOnEachField`, `strictRequired`, `allowAdditionalProperties`, `customFormats`, `messageFactory`, `maxDepth`, `required`, `optional`, `nullable`, `min`, `max`, `minLength`, `maxLength`, `exactLength`, `pattern`, `email`, `url`, `alphanumeric`, `startsWith`, `endsWith`, `integer`, `finite`, `positive`, `negative`, `multipleOf`, `range`, `truthy`, `falsy`, `unique`, `includes`, `contains`, `oneOf`, `literal`, `custom`, `transform`, `skip`, `requiredIf`, `optionalIf`, `validateIf`, `compareField`, `recursively`, `guard`, `object`, `default`, `string`, `number`, `boolean`, `array`, `union`, `tuple`, `requiredPlugin`, `optionalPlugin`, `nullablePlugin`, `skipPlugin`, `transformPlugin`, `customPlugin`, `literalPlugin`, `oneOfPlugin`, `compareFieldPlugin`, `requiredIfPlugin`, `optionalIfPlugin`, `validateIfPlugin`, `objectPlugin`, `objectRecursivelyPlugin`, `objectMinPropertiesPlugin`, `objectMaxPropertiesPlugin`, `objectAdditionalPropertiesPlugin`, `objectPatternPropertiesPlugin`, `objectPropertyNamesPlugin`, `objectDependentRequiredPlugin`, `objectDependentSchemasPlugin`, `unionGuardPlugin`, `tupleBuilderPlugin`, `readOnlyWriteOnlyPlugin`, `stringMinPlugin`, `stringMaxPlugin`, `stringExactLengthPlugin`, `stringPatternPlugin`, `stringEmailPlugin`, `stringUrlPlugin`, `stringAlphanumericPlugin`, `stringStartsWithPlugin`, `stringEndsWithPlugin`, `stringIpv4Plugin`, `stringIpv6Plugin`, `stringHostnamePlugin`, `stringTimePlugin`, `stringDurationPlugin`, `stringJsonPointerPlugin`, `stringRelativeJsonPointerPlugin`, `stringIriPlugin`, `stringIriReferencePlugin`, `stringUriTemplatePlugin`, `stringBase64Plugin`, `stringContentEncodingPlugin`, `uuidPlugin`, `numberMinPlugin`, `numberMaxPlugin`, `numberRangePlugin`, `numberIntegerPlugin`, `numberFinitePlugin`, `numberPositivePlugin`, `numberNegativePlugin`, `numberMultipleOfPlugin`, `booleanTruthyPlugin`, `booleanFalsyPlugin`, `arrayMinLengthPlugin`, `arrayMaxLengthPlugin`, `arrayUniquePlugin`, `arrayIncludesPlugin`, `arrayContainsPlugin`, `jsonSchemaPlugin`, `jsonSchemaFullFeaturePlugin`

