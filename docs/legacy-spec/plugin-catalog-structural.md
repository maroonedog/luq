# plugin-catalog-structural

既存 src/core/plugin/ 直下の構造系プラグインは 15 個（array 系 5・object 系 8・tuple 1・recursive 1）。すべて `plugin({name, methodName, allowedTypes, category, impl})` で作られ、impl は `{ check(value, allValues?), code, getErrorMessage(value, path, allValues?), params }` を返す「ホイスト済みバリデータ」形式に統一されている。値が対象型でないときは `check` が `true` を返して素通しし、型そのものの検査は field-context が型スロット（b.array / b.object）ごとに自動注入する arrayType / objectType バリデータが担う、という二層構造が全体の意味論の核（arrayContains と objectPropertyNames / objectPatternProperties だけがこの規約を破って非対象型に false を返す）。配列要素への適用はプラグインではなくパス構文 `field[*]` / `field[*].prop` / `field[*][*]` で表現し、v() のパス型 NestedKeyOf が `items` / `items[*]` / `items[*].name` のみを許す（`items.name` はコンパイルエラー）。実測で確かに動くのは (1) 配列レベル制約、(2) 1段の `a[*]` スカラー要素検証、(3) 1段の `a[*].prop` 要素フィールド検証（エラーパス `a[0].prop`）、(4) 要素内の配列レベル制約 `a[*].b` の 4 つ。一方 `a[*][*]`（多次元）は無言で一切検証されず、2 段ネスト `a[*].b[*].prop` はパスが `a.b[0].prop` と外側インデックスを落としたうえ誤ったコード（required）を返し、tupleBuilder は build() 時に TypeError で落ちる。再帰は objectRecursivelyPlugin の `recursively("__Self" | "__Element")` マーカー方式で、maxDepth 既定 10・WeakSet による循環参照打ち切り。`__Self` は単体オブジェクトでは動作するが、配列要素パス `a[*]` 上での `recursively("__Self")` は失敗する。加えて field-context の attachPluginMethods がプラグイン構築時の例外を try/catch で完全に握り潰しており、不正引数（minLength(-1) 等）のガードが利用者に一切届かない。

## 引き継ぐ契約 (17件)

### must-preserve (11)

#### arrayMinLengthPlugin
- 出典: `C:\projects\luq\src\core\plugin\arrayMinLength.ts`
- 形: export const arrayMinLengthPlugin; name="arrayMinLength", methodName="minLength", allowedTypes=["array"], category="standard"; impl(minLength: number, options?: ValidationOptions<{min:number; actual:number}>)
- 意味: check: 非配列（null/undefined 含む）は true で素通し。配列なら value.length >= minLength。code 既定 "arrayMinLength"（options.code で上書き可、テストで CUSTOM_MIN_LENGTH の上書きが実測動作）。既定メッセージ `Array must have at least ${min} elements, but got ${actual}`。messageFactory に渡る追加コンテキストは {min, actual}（actual は非配列なら 0）。実装は typeof!==number || <0 で Error(`Invalid minLength: ${x}`) を throw するが、NaN は通過し、しかも throw は attachPluginMethods の try/catch に飲まれて利用者に届かない。

#### arrayMaxLengthPlugin
- 出典: `C:\projects\luq\src\core\plugin\arrayMaxLength.ts`
- 形: export const arrayMaxLengthPlugin; name="arrayMaxLength", methodName="maxLength", allowedTypes=["array"], category="standard"; impl(maxLength: number, options?: ValidationOptions<{max:number; actual:number}>)
- 意味: check: 非配列は true で素通し。配列なら value.length <= maxLength。code 既定 "arrayMaxLength"。既定メッセージ `Array must have at most ${max} elements, but got ${actual}`。追加コンテキスト {max, actual}。arrayMinLength と同じ引数ガードと同じ握り潰し問題。

#### arrayUniquePlugin
- 出典: `C:\projects\luq\src\core\plugin\arrayUnique.ts`
- 形: export const arrayUniquePlugin; name="arrayUnique", methodName="unique", allowedTypes=["array"], category="standard"; impl(options?: ValidationOptions)
- 意味: check: 非配列は true で素通し。要素同士の重複を SameValueZero ではなく `===`（長さ<=10 は二重ループ、>10 は Set）で判定。したがって NaN は `===` では等しくないが Set では等しいという長さ依存の不整合があり、0 と -0 は `===` で等しく Set でも等しい（テスト「0と-0は同じ」は現状 false を返して失敗）。オブジェクト要素は参照同一性のみ。code 既定 "arrayUnique"、既定メッセージ "Array must contain unique values"（メッセージに重複値は含まれない）。

#### arrayIncludesPlugin
- 出典: `C:\projects\luq\src\core\plugin\arrayIncludes.ts`
- 形: export const arrayIncludesPlugin; name="arrayIncludes", methodName="includes", allowedTypes=["array"], category="arrayElement"; impl<TElement = any>(element: TElement, options?: ValidationOptions)
- 意味: check: 非配列は true で素通し。配列なら Array.prototype.includes(element)（SameValueZero: NaN を含む配列は includes(NaN) が true、オブジェクトは参照比較）。code 既定 "arrayIncludes"、既定メッセージ `Array must include ${JSON.stringify(element)}`。messageFactory 追加コンテキストは {element}。宣言 category は "arrayElement" だが JSDoc は "standard" と書いており、実際の挙動は他の standard プラグインと同一（category は現状ほぼ意味を持たない）。

#### objectMinPropertiesPlugin
- 出典: `C:\projects\luq\src\core\plugin\objectMinProperties.ts`
- 形: export const objectMinPropertiesPlugin; name="objectMinProperties", methodName="minProperties", allowedTypes=["object"], category="standard"; impl(minValue: number, options?: ValidationOptions)
- 意味: JSON Schema `minProperties`。check: typeof value !== "object" || value === null なら true で素通し（配列も object なので数えられてしまう）。Object.keys(value).length >= minValue（自身の列挙可能キーのみ）。code 既定 "objectMinProperties"、既定メッセージ `Must have at least ${min} properties, but has ${actual}`、追加コンテキスト {min, actual}。typeof!==number || isNaN || <0 で Error を throw（ただし握り潰される）。

#### objectMaxPropertiesPlugin
- 出典: `C:\projects\luq\src\core\plugin\objectMaxProperties.ts`
- 形: export const objectMaxPropertiesPlugin; name="objectMaxProperties", methodName="maxProperties", allowedTypes=["object"], category="standard"; impl(maxValue: number, options?: ValidationOptions)
- 意味: JSON Schema `maxProperties`。objectMinProperties と対称: 非オブジェクト/null は素通し、Object.keys(value).length <= maxValue。code 既定 "objectMaxProperties"、既定メッセージ `Must have at most ${max} properties, but has ${actual}`、追加コンテキスト {max, actual}。

#### objectAdditionalPropertiesPlugin
- 出典: `C:\projects\luq\src\core\plugin\objectAdditionalProperties.ts`
- 形: export const objectAdditionalPropertiesPlugin; name="objectAdditionalProperties", methodName="additionalProperties", allowedTypes=["object"], category="standard"; impl(allowed: boolean | JSONSchema7, options?: { allowedProperties?: string[]; additionalPropertiesSchema?: JSONSchema7; strict?: boolean } & ValidationOptions)
- 意味: JSON Schema `additionalProperties`。既知プロパティ集合は自動導出されず、必ず options.allowedProperties で明示する（省略時は全キーが「追加」扱い）。strict = (allowed === false || options.strict === true)。strict のとき extraProperties.length === 0 を要求。allowed がオブジェクトなら（または options.additionalPropertiesSchema があれば）追加プロパティ 1 つずつを簡易サブセット検証: type(string/number/boolean/object/array)、minLength/maxLength（string）、minimum/maximum（number）のみ。allowed === true / 未指定は常に true。非オブジェクト/null は素通し。code 既定 "objectAdditionalProperties"。既定メッセージ: strict なら `Additional properties are not allowed: ${extraProperties.join(", ")}`、それ以外は `Additional properties validation failed`。messageFactory 追加コンテキストは {extraProperties: string[]}。

#### objectDependentRequiredPlugin
- 出典: `C:\projects\luq\src\core\plugin\objectDependentRequired.ts`
- 形: export const objectDependentRequiredPlugin; name="objectDependentRequired", methodName="dependentRequired", allowedTypes=["object"], category="standard"; impl(dependencies: Record<string, string[] | { required: string[]; message?: string }>)
- 意味: JSON Schema `dependentRequired`。check(value, allValues) は allValues が渡っていればそちらを、なければ value を対象にする（ルート適用のため）。トリガープロパティが `in` かつ !== undefined のとき、依存先すべてが `in` かつ !== undefined であることを要求。非オブジェクト/配列/null は true で素通し。実測ではルート適用 `.v("", b => b.object.dependentRequired({...}))` が動き、エラー path は ""。code は "DEPENDENT_REQUIRED"（options / code 上書きなし）。メッセージは違反ごとに custom message か `When '${trigger}' is present, the following properties are required: ${missing.join(", ")}` を "; " で連結し、path が空でなければ `${path}: ` を前置。

#### objectRecursivelyPlugin (別名 recursivelyPlugin)
- 出典: `C:\projects\luq\src\core\plugin\objectRecursively.ts / C:\projects\luq\src\core\builder\validator-factory.ts`
- 形: export const objectRecursivelyPlugin; name="recursively"（★プラグイン名だけ object 接頭辞なし）, methodName="recursively", allowedTypes=["object"], category="standard"; impl(targetFieldPath: "__Self" | "__Element", options?: { maxDepth?: number } & ValidationOptions<{targetPath}>)。export const RECURSIVE_SELF = "__Self"; export const RECURSIVE_ELEMENT = "__Element"
- 意味: 検証そのものは行わないマーカープラグイン。check は常に true を返し、代わりに戻り値へ `__isRecursive: true` と `recursive: { targetFieldPath, maxDepth }` を付ける。maxDepth 既定 10、code 既定 "recursively"、（実際には出力されない）メッセージ `Recursive validation for ${targetFieldPath}`。実際の再帰は validator-factory の createRecursiveValidator が担う: (1) currentDepth > maxDepth で打ち切り（エラーなし）、(2) WeakSet による循環参照検出で打ち切り（エラーなし）、(3) null/undefined は元のバリデータ（optional/nullable）だけ適用して再帰しない、(4) "__Self" は自分自身を除く全フィールドバリデータを入れ子オブジェクトへ適用し、エラー path を `${currentPath}.${error.path}` に付け替える。さらに再帰マーカー付きフィールドを見つけたら深さ+1 で再帰、(5) "__Element" は配列の各要素に対し `[*]` を含まない全フィールドバリデータを適用し path を `${currentPath}[${i}].${error.path}` にする。実測: 単体オブジェクトの `__Self`（TreeNode の parent/left/right）は動きエラー path は `parent.name` 等。配列要素パス `categories[*]` 上の `recursively("__Self")` は現状失敗する。

#### 配列要素パス構文 `[*]`（プラグインではなく v() のパス言語）
- 出典: `C:\projects\luq\src\types\util.ts / C:\projects\luq\src\core\builder\nested-array-processor.ts / C:\projects\luq\src\core\builder\array-batch-optimizer.ts`
- 形: NestedKeyOf<T> が生成する形: `items` | `items[*]` | `items[*].prop` | `items[*][*]`（2次元） | `items[*].sub[*].prop`（深いネスト）。TypeOfPath<T, Path> が対応する要素型を解決する。`items.prop`（ドット記法での要素アクセス）は型エラーになる。
- 意味: 配列レベル制約（minLength 等）と要素検証は別々の v() 呼び出しで合成する: `.v("users", b => b.array.required().minLength(1))` ＋ `.v("users[*].name", b => b.string.required().min(2))`。実測で確認できた動作: (1) `users[*].name` → エラー path `users[0].name`、code はプラグインの code（stringMin など）そのまま。(2) `tags[*]`（スカラー要素の直接検証）→ path `tags[1]`。(3) 要素内の配列レベル制約 `users[*].addresses` に minLength → path `users[0].addresses`、code arrayMinLength。(4) 空配列では要素バリデータは 1 度も走らず、配列レベルバリデータのみ走る。(5) 値が非配列なら型スロット自動注入の arrayType が code "VALIDATION_ERROR" / message "Expected array" を出す。

#### 型スロットが自動注入する構造型チェック（arrayType / objectType）
- 出典: `C:\projects\luq\src\core\builder\context\field-context.ts`
- 形: createFieldContext(path, plugins) が b.array / b.object を作る際に無条件で先頭へ差し込むバリデータ。arrayType: check = (v==null ? true : Array.isArray(v))、messageFactory = () => "Expected array"。objectType: check = (v==null ? true : typeof v==="object" && v!==null && !Array.isArray(v))、messageFactory = () => "Expected object"。b.tuple と b.union には自動型チェックが付かない（null を返す）。
- 意味: 「b.array を選んだ時点で配列であることが検証される」という前提が全 array プラグインの素通し設計（非配列は check→true）の根拠になっている。null/undefined はここでは素通しされ required/optional/nullable が判断する。ただし実際のエラー出力では code が "VALIDATION_ERROR" に潰れてプラグイン名が残らない。

### should-preserve (6)

#### arrayContainsPlugin
- 出典: `C:\projects\luq\src\core\plugin\arrayContains.ts`
- 形: export const arrayContainsPlugin; name="arrayContains", methodName="contains", allowedTypes=["array"], category="standard"; impl(schema: unknown | ContainsSchema | JSONSchema7)。export interface ContainsSchema { validator: (value:any)=>boolean; message?: string }
- 意味: JSON Schema Draft-07 の `contains` 相当。引数は 3 形態: (a) プリミティブ/配列/null → value.includes(schema)（完全一致要素が 1 つ以上）、(b) {validator, message?} → value.some(validator)、(c) JSONSchema7 オブジェクト → 内蔵の簡易サブセット検証器 validateAgainstSchema に対する value.some。内蔵検証器が見るキーワードは type(string/number/boolean/array/object/null)、string の minLength/maxLength/pattern、number の minimum/maximum/multipleOf、enum、const のみ（それ以外は無視）。他の array プラグインと違い非配列に対して false を返す（素通ししない）。code は "ARRAY_CONTAINS"（唯一の SCREAMING_SNAKE、options も code 上書きも受け取らない）。メッセージ: (a) `${path} must contain ${JSON.stringify(schema)}` / (b) schema.message ?? `${path} must contain at least one matching item` / (c) `${path} must contain at least one item matching the schema`。

#### objectPlugin
- 出典: `C:\projects\luq\src\core\plugin\object.ts`
- 形: export const objectPlugin; name="object", methodName="object", allowedTypes=["object"], category="standard"; impl(options?: ValidationOptions)
- 意味: check: value !== null && typeof value === "object" && !Array.isArray(value)（プレーンオブジェクト判定。Date/Map/RegExp は通る）。他の構造系と違い null/undefined を素通ししない（undefined は typeof "undefined" で false）。code 既定は "type_mismatch"（他が camelCase なのにここだけ snake_case）、既定メッセージ "Not an object"（path も value も含まない）。b.object 型スロットが自動注入する objectType バリデータ（null/undefined を素通しし "Expected object" を出す）と役割が二重化している。

#### objectPropertyNamesPlugin
- 出典: `C:\projects\luq\src\core\plugin\objectPropertyNames.ts`
- 形: export const objectPropertyNamesPlugin; name="objectPropertyNames", methodName="propertyNames", allowedTypes=["object"], category="standard"; impl(schema: RegExp | string | PropertyNamesSchema)。export interface PropertyNamesSchema { validator: (name:string)=>boolean; message?: string }
- 意味: JSON Schema `propertyNames`。全キーが RegExp（そのまま test）/ string（new RegExp(str) で毎回生成）/ {validator} を満たすことを要求。上記 3 形態のいずれでもなければ false。非オブジェクト・配列・null は false を返す（素通ししない＝他の object プラグインと非対称）。options も code 上書きも受け取らない。code は "PROPERTY_NAMES"。メッセージ: schema.message があればそれ、なければ `${path} has invalid property names: ${invalidNames.join(", ")}. Property names must match ${patternDesc}`（patternDesc は RegExp なら toString()、string なら `/str/`、それ以外は "the specified pattern"）。

#### objectPatternPropertiesPlugin
- 出典: `C:\projects\luq\src\core\plugin\objectPatternProperties.ts`
- 形: export const objectPatternPropertiesPlugin; name="objectPatternProperties", methodName="patternProperties", allowedTypes=["object"], category="standard"; impl(patterns: PatternPropertiesSchema)。export type PatternPropertiesSchema = Record<string, ((value:any)=>boolean) | PatternValidator>; export interface PatternValidator { validator:(value:any)=>boolean; message?: string }
- 意味: JSON Schema `patternProperties` に近いが意味論が異なる: 各プロパティ名について patterns のエントリを宣言順に走査し、最初にマッチしたパターンの検証だけを適用して break する（JSON Schema は「マッチする全パターンを適用」なので非準拠）。どのパターンにもマッチしないプロパティは無条件で valid。値検証は関数 or {validator}。非オブジェクト・配列・null は false。options / code 上書きなし。code は "PATTERN_PROPERTIES"。メッセージは違反ごとに `${prop}: ${customMessage}` または `${prop} (matching pattern ${patternString}) has invalid value` を集めて `${path} has pattern property violations: ${errors.join(", ")}`、空なら `${path} has invalid pattern properties`。パターンは毎回 new RegExp され事前コンパイルされない。

#### objectDependentSchemasPlugin
- 出典: `C:\projects\luq\src\core\plugin\objectDependentSchemas.ts`
- 形: export const objectDependentSchemasPlugin; name="objectDependentSchemas", methodName="dependentSchemas", allowedTypes=["object"], category="standard"; impl(schemas: Record<string, JSONSchema7 | { validator:(value:any)=>boolean; message?: string }>)
- 意味: JSON Schema `dependentSchemas`。dependentRequired と同じ allValues 優先ロジック。トリガープロパティ存在時に、{validator} ならオブジェクト全体を渡して呼ぶ、JSONSchema7 なら内蔵の簡易検証器 validateAgainstJsonSchema をオブジェクト全体に適用。内蔵検証器が見るのは type==="object"、required[]、properties 直下の各 subSchema の type と（string: minLength/maxLength/pattern、number: minimum/maximum、array: minItems/maxItems）、enum、const のみ。ネストは 1 段だけで再帰しない。非オブジェクト/配列/null は素通し。code は "DEPENDENT_SCHEMAS"。メッセージは required 不足があれば `When '${trigger}' is present, the following properties are required: ${missing.join(", ")}`、custom validator なら schema.message ?? `Schema validation failed when '${trigger}' is present`、path 前置は dependentRequired と同じ。

#### tupleBuilderPlugin
- 出典: `C:\projects\luq\src\core\plugin\tupleBuilder.ts / C:\projects\luq\src\core\builder\plugins\composable-plugin.ts`
- 形: export const tupleBuilderPlugin = createComposableDirectlyPlugin<"tupleBuilder","builder",readonly ["tuple"], unknown[]>(...); name="tupleBuilder", methodName="builder"（★呼び出しは b.tuple.builder(...)）, allowedTypes=["tuple"], category="composable-directly"。builder(...builderFns, options?: { rest?: (ctx)=>any; messageFactory?: { notArray?, lengthMismatch?, tooShort? } })
- 意味: 意図された意味論: 固定長タプル（各要素に独立したビルダー）＋任意の rest 要素。最後の引数が rest プロパティを持つか空オブジェクトなら options とみなす（オーバーロード判定）。要素ビルダーは fieldPath `${fieldPath}[${i}]` の FieldContext で事前に build され、rest は `${fieldPath}[rest]` で 1 度だけ build されて全余剰要素に再利用される。検証: 非配列 → code TUPLE_NOT_ARRAY / "Value must be an array"。rest なしで length !== tupleLength → TUPLE_LENGTH_MISMATCH / `Tuple must have exactly ${expected} elements, got ${actual}`。rest ありで length < tupleLength → TUPLE_TOO_SHORT / `Tuple must have at least ${expected} elements, got ${actual}`。各固定要素は validator.validate(value[i], value)（第2引数に配列自身を allValues として渡す）で検証し、エラー path を `${fieldPath}[${i}]` に付け替える。エラー配列が空なら code ELEMENT_INVALID / `Validation failed for element ${i}` をフォールバック。rest 要素は tupleLength 以降を restValidator で検証し同じ path 規則。builder() は 1 度だけ呼ぶ前提で compositions[0] のみ使用。引数ゼロなら常に false を返すバリデータになる。★実測: `.v("loc", b => b.tuple.required().builder(...))` は build() 時に TypeError: Cannot read properties of undefined (reading 'addValidator') で落ちる（composable-plugin.ts が存在しない builder._executionPlan を触る）ため、この API は現状まったく機能していない。

## 振る舞い規則

- プラグイン実装の統一形: impl(...args) は { check(value, allValues?): boolean, code: string, getErrorMessage(value, path, allValues?): string, params: unknown[] } を返す。副作用を持たず、値の書き換えもしない。新実装でもこの「純粋な check ＋ 遅延メッセージ生成」の分離は引き継ぐ価値がある（メッセージ文字列は失敗時にしか組み立てない）。
- 対象型でない値は素通しする（check→true）のが array/object 制約プラグインの原則。型そのものは b.array / b.object の型スロットが注入する arrayType / objectType が判定する。例外は arrayContains・objectPropertyNames・objectPatternProperties（非対象型に false）と objectPlugin（undefined に false）。新実装ではこの規約を全プラグインで統一すること。
- null / undefined の扱いは構造プラグインの責務ではなく required / optional / nullable が決める。実測: `b.array.optional()` に null を渡すと code "optional" / `items cannot be null (use undefined for optional fields)` が出る（optional は undefined のみ許容）。`b.array.nullable()` なら null は通る。
- 配列レベル制約と要素検証は別々の v() 呼び出しで合成する。`b.array.minLength(3)` は配列そのものにしか作用せず、要素検証は `field[*]` / `field[*].prop` という別パスで宣言する。1 つのチェーンの中で要素バリデータを合成する API は存在しない（tupleBuilder だけが例外的に子ビルダーを受け取る）。
- 要素パスのエラー path は宣言時の `[*]` が実行時の実インデックスに置換される: 宣言 `users[*].name` → 出力 `users[0].name`、宣言 `tags[*]` → 出力 `tags[1]`。要素エラーの code は要素プラグインの code をそのまま引き継ぐ（stringMin, numberMin など）。
- 空配列に対しては要素バリデータを 1 度も実行しない。配列レベルバリデータ（minLength 等）だけが走る。
- 1 フィールド内の複数バリデータは既定で最初の失敗で打ち切られる（abortEarlyOnEachField 既定 true）。実測: `.includes("a").unique()` に ["b","b"] を与えると arrayIncludes のエラーだけが返り arrayUnique は報告されない。一方、配列要素の反復では abortEarlyOnEachField が強制的に false に上書きされ、同一要素の全フィールドが検証される（nested-array-processor / array-batch-optimizer の effectiveAbortEarlyOnEachField = false）。
- 配列要素パスは実行時に「配列バッチ」へ再編される: parseArrayElementPath が `a[*].b` / `a.*.b` / `a[*]` / `a[*][*]` を { arrayPath, elementField } に分解し、buildNestedArrayHierarchy が親子関係（childArrays）と depth を持つ木を作り、配列を 1 回だけ走査して全要素フィールドをまとめて検証する。要素フィールドのアクセサは事前コンパイルされる。この「配列を 1 度だけ読んで要素の全フィールドをバッチ検証する」という発想は引き継ぐ価値がある。
- 再帰は `recursively("__Self")` / `recursively("__Element")` の 2 キーワードのみ。任意フィールドパスを渡す分岐はコード上存在するが公開型は RecursiveKeyword に絞られている。maxDepth 既定 10、深さ超過も循環参照（WeakSet）もエラーではなく静かな打ち切り。
- `__Self` は「ルート型に対して宣言した全フィールドルールを、この入れ子オブジェクトにもう一度適用する」。自分自身のフィールドパスだけは無限再帰防止のためスキップされる。`__Element` は「配列の各要素に対してルート型の全フィールドルール（`[*]` を含むものを除く）を適用する」。
- JSON Schema からの読み込み（fromJsonSchema）は構造キーワードを次のように解決しようとする: minItems→chain.minItems、maxItems→chain.maxItems、uniqueItems→chain.unique()、items(配列)→chain.tupleBuilder(...)、minProperties→chain.minProperties、maxProperties→chain.maxProperties、additionalProperties→chain.additionalProperties、propertyNames→chain.propertyNames。ただし minItems/maxItems/tupleBuilder というメソッドは存在しない（実際の methodName は minLength/maxLength/builder）ため、これらの分岐は `&& chain.minItems` の存在チェックで無言に落ちて何も適用されない。新実装ではメソッド名の対応表を単一の真実として持つこと。
- tree-shaking の単位は 1 プラグイン 1 ファイル 1 named export で、package.json の exports に `./plugins/<name>` サブパスが 1 対 1 で並んでいる（arrayMinLength / arrayMaxLength / arrayUnique / arrayIncludes / arrayContains / object / objectMinProperties / objectMaxProperties / objectAdditionalProperties / objectPropertyNames / objectPatternProperties / objectDependentRequired / objectDependentSchemas / tupleBuilder）。objectRecursively と unionGuard にはサブパスが無く、src/index.ts からも export されていない（core/plugin/index.ts からのみ）。新実装ではこの取りこぼしを塞ぐこと。
- allowedTypes は型スロットへのメソッド露出を決める唯一のゲート。array 系は ["array"]、object 系は ["object"]、tupleBuilder は ["tuple"]。allowedTypes に含まれない型スロットにはメソッドが生えない（型レベルでも FilterPluginsByType で除外される）。
- TypeName は string / number / date / array / union / tuple / object / boolean / null / any の 10 種。型スロットは b.string / b.number / b.boolean / b.date / b.array / b.object / b.tuple / b.union。tuple と union には自動型チェックが注入されない。

## 引き継がないもの

- **field-context.ts の attachPluginMethods にある `try { ... } catch (e) { /* Plugin error - ignore silently */ }`** — プラグイン構築時の例外を完全に握り潰す。arrayMinLength(-1) / objectMinProperties(NaN) 等の引数ガードが throw しても利用者に届かず、しかもバリデータが validators 配列に push されないので「そのルールが静かに消える」。テスト『負の最小長でエラーを投げる』『非数値の最大長でエラーを投げる』はこれが原因で失敗している。設定ミスは必ず build 時に落とすべき。
- **エラーコードの命名がバラバラ（camelCase の arrayMinLength / objectMinProperties と、SCREAMING_SNAKE の ARRAY_CONTAINS / PROPERTY_NAMES / PATTERN_PROPERTIES / DEPENDENT_REQUIRED / DEPENDENT_SCHEMAS / TUPLE_NOT_ARRAY、snake_case の type_mismatch が混在）** — エラーコードは利用者が switch する公開契約。新実装では 1 つの規則（プラグイン名と一致する camelCase を推奨）に統一する。
- **options / code 上書き / messageFactory を受け取らないプラグイン（arrayContains, objectPropertyNames, objectPatternProperties, objectDependentRequired, objectDependentSchemas）** — 同じカタログの中で「カスタムメッセージが差せるもの」と「差せないもの」が混在している。ValidationOptions は全プラグイン共通の第 N 引数として一貫させる。
- **array-type-analysis.ts の BuildTimeArrayAnalyzer（new Function による多次元ループコード生成、createTypedArrayValidator, generateOptimizedValidator, generateNestedLoopCode）** — CSP-safe を絶対条件に掲げているのに `new Function` でコード文字列を評価している。しかも array-batch-optimizer からは optimizedValidator が実際には一度も設定されず（arrayStructure も未設定）、丸ごとデッドコード。多次元配列は素直な再帰ループで書けばよい。
- **nested-array-processor.ts の parseArrayElementPath（正規表現の場当たり的な多段マッチ）と、その下流のバリデータ探索ロジック（fullFieldPaths を線形走査して `fullPath.includes(elementField)` で部分文字列一致させ「最初に見つかったバリデータ」を使う）** — パス解決が部分文字列一致という当て推量になっており、`users[*].addresses[*].street` で外側インデックスを落とした path `users.addresses[0].street` と誤ったコード（stringMin であるべきところ required）を返す原因になっている。パスは正しい構文木（セグメント列 + 配列ワイルドカード）としてパースし、バリデータは構造化キーで引くべき。
- **`items.name` のようなドット記法で配列要素にアクセスする経路（TypeOfPath の「Implicit array element access」分岐と、それを前提にした旧テスト群）** — NestedKeyOf は `items[*].name` しか生成せず、実行時の配列バッチも `[*]` 前提。ドット記法は型では拒否されるのに TypeOfPath には残っていて、二重の表現が存在している。要素アクセスは `[*]` 一本に統一する。
- **composable / composable-conditional / composable-directly という 3 つの別系統プラグイン機構（composable-plugin.ts の attachComposablePlugin が存在しない builder._executionPlan を触る）** — tupleBuilderPlugin がこの機構の唯一の実利用者で、build() 時に TypeError で落ちる＝タプル検証は現状 1 行も動かない。子ビルダーを取るプラグインは標準機構の中で表現できるはずで、機構をもう 1 つ増やす価値はなかった。
- **objectAdditionalProperties が既知プロパティを options.allowedProperties で手入力させる設計** — 利用者は既に .v("user.name", ...) 等でプロパティを宣言しているのに、additionalProperties のために同じ一覧をもう一度書かされる。宣言済みフィールドから既知キー集合を導出できるようにするか、少なくとも二重宣言を強制しない形にする。
- **arrayContains / objectAdditionalProperties / objectDependentSchemas それぞれが内部に持つ独自の「簡易 JSON Schema 検証器」（validateAgainstSchema / インライン type チェック / validateAgainstJsonSchema）** — 同じ仕事をする 3 つの互いに異なる不完全実装。サポートするキーワードも挙動もバラバラで、いずれもネストしない。JSON Schema 評価は 1 箇所に集約する。
- **objectPatternProperties の「最初にマッチしたパターンだけ適用して break」という挙動** — JSON Schema の patternProperties は「マッチする全パターンを適用」なので Draft-07 非準拠。Draft-07 互換を掲げる以上、意味論を仕様に合わせる。
- **arrayUnique の長さ 10 を境に比較方法（`===` の二重ループ / Set）を切り替える最適化** — 長さによって NaN の重複判定結果が変わるという意味論の揺れを生んでいる。等価性の定義（SameValueZero か、深い等価か）を先に決め、単一の方法で実装する。
- **objectPlugin の code "type_mismatch" とメッセージ "Not an object"（path も value も含まない）、および b.object 型スロットが注入する objectType との役割の重複** — b.object を選んだ時点で objectType が走るので .object() はほぼ冗長。片方に寄せる。メッセージにも path を含める。
- **各プラグインファイル冒頭の未使用 import（VALID_RESULT / INVALID_RESULT / ERROR_SEVERITY を import しているのに一度も使わないファイルが array/object 系のほぼ全部）と、「V8 Optimization」「monomorphic」等を謳うコメント** — 根拠のない最適化コメントとデッドな import がファイルの大半を占めている。JSDoc の @luq-plugin ブロック（name/category/description/allowedTypes/params/returns/since）は仕様として価値があるので、そちらは形式を引き継ぐ。
- **arrayIncludesPlugin の category: "arrayElement"** — JSDoc は standard と書いており、実行時に category が挙動を変えることもない（分岐は composable* 判定だけ）。実態と一致しない分類ラベルは捨てる。PluginCategory の 11 値のうち実際に意味を持つのは composable 系判定と transform だけ。
- **objectRecursivelyPlugin の name が "recursively" で export 名が objectRecursivelyPlugin、さらに recursivelyPlugin という別名 export もある三重表記** — プラグイン名・export 名・別名が食い違い、しかも src/index.ts にも package.json exports にも載っていない。命名を 1 つに決め、公開経路を揃える。

## 公開シンボル (84)

`arrayMinLengthPlugin`, `arrayMaxLengthPlugin`, `arrayUniquePlugin`, `arrayIncludesPlugin`, `arrayContainsPlugin`, `objectPlugin`, `objectMinPropertiesPlugin`, `objectMaxPropertiesPlugin`, `objectAdditionalPropertiesPlugin`, `objectPropertyNamesPlugin`, `objectPatternPropertiesPlugin`, `objectDependentRequiredPlugin`, `objectDependentSchemasPlugin`, `objectRecursivelyPlugin`, `recursivelyPlugin`, `tupleBuilderPlugin`, `minLength`, `maxLength`, `unique`, `includes`, `contains`, `object`, `minProperties`, `maxProperties`, `additionalProperties`, `propertyNames`, `patternProperties`, `dependentRequired`, `dependentSchemas`, `recursively`, `builder`, `RECURSIVE_SELF`, `RECURSIVE_ELEMENT`, `__Self`, `__Element`, `ArrayMinLengthContext`, `ArrayMaxLengthContext`, `ContainsSchema`, `PropertyNamesSchema`, `PatternValidator`, `PatternPropertiesSchema`, `DependentRequiredSchema`, `DependentRequiredMapping`, `SchemaValidator`, `DependentSchemasMapping`, `TupleBuilderFunction`, `RestBuilderFunction`, `TupleBuilderOptions`, `ArrayDepth`, `ArrayElementType`, `ElementType`, `NestedKeyOf`, `TypeOfPath`, `arrayMinLength`, `arrayMaxLength`, `arrayUnique`, `arrayIncludes`, `ARRAY_CONTAINS`, `type_mismatch`, `objectMinProperties`, `objectMaxProperties`, `objectAdditionalProperties`, `PROPERTY_NAMES`, `PATTERN_PROPERTIES`, `DEPENDENT_REQUIRED`, `DEPENDENT_SCHEMAS`, `TUPLE_NOT_ARRAY`, `TUPLE_LENGTH_MISMATCH`, `TUPLE_TOO_SHORT`, `ELEMENT_INVALID`, `@maroonedog/luq/plugins/arrayMinLength`, `@maroonedog/luq/plugins/arrayMaxLength`, `@maroonedog/luq/plugins/arrayUnique`, `@maroonedog/luq/plugins/arrayIncludes`, `@maroonedog/luq/plugins/arrayContains`, `@maroonedog/luq/plugins/object`, `@maroonedog/luq/plugins/objectMinProperties`, `@maroonedog/luq/plugins/objectMaxProperties`, `@maroonedog/luq/plugins/objectAdditionalProperties`, `@maroonedog/luq/plugins/objectPropertyNames`, `@maroonedog/luq/plugins/objectPatternProperties`, `@maroonedog/luq/plugins/objectDependentRequired`, `@maroonedog/luq/plugins/objectDependentSchemas`, `@maroonedog/luq/plugins/tupleBuilder`

