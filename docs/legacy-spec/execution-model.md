# execution-model

## 全体像（実測に基づく事実）

`build()` は `src/core/builder/core/field-builder.ts:190-227` で `createValidatorFactory(plugins).buildOptimizedValidator(processedDefinitions)` を呼ぶ。返るのは `TransformAwareValidator<T, TTransformed>` = `{ validate, parse, pick, validateRaw?, parseRaw? }`。

### build() 時に「本当に」事前計算しているもの（引き継ぐ価値がある）
1. **フィールドごとの validator レコード列の確定**。`createFieldContext(path, plugins)` にビルダー関数を1回通し、`_validators: ValidatorRecord[]` と `_transforms: TransformFn[]` を配列として固定する（`unified-validator.ts:66-77`）。実行時にはこの配列を回すだけ。
2. **フィールドアクセサの事前コンパイル**。`createNestedValueAccessor(path)` / `field-accessor-optimized.ts:createAccessor` が、パス深さ 0〜5 を専用クロージャに展開（`obj?.[k1]?.[k2]?.[k3]`）、6以上はループ。**`new Function` は使っていない**（CSP-safe）。setter も同様に事前生成。
3. **存在チェッカ (`createFieldExistenceChecker`) の事前コンパイル**（`validator-factory.ts:994-1021`）。`in` 演算子ベースで、`undefined` が入っている場合と欠損を区別する。
4. **エラーコード / メッセージ生成関数のプリフェッチ**。`errorCodes[i] = validator.code || validator.pluginName || "VALIDATION_ERROR"` を配列に落とす。
5. **配列バッチ階層 (`NestedArrayBatchInfo`) の構築**。`buildNestedArrayHierarchy` が `items[*].name` 等のパスから「配列パス → 直下要素フィールド群 → 子配列」の木を作り、要素フィールドごとのアクセサを事前生成する。

### 実行時にやっていること
`validate(value, options)`:
- `value == null` → 即 `Result.error([{path:"", code:"REQUIRED", message:"Value is required"}])`
- `fieldOptionsMap`（`.default()` 等）があれば **入力を浅くコピーして default を適用**してから検証する
- STEP1: 配列バッチ（要素をインデックス展開して検証）
- STEP2: fast フィールド群
- STEP3: slow フィールド群（欠損チェック＋暗黙 REQUIRED を含む）
- エラーがあれば `Result.error(errors)`、なければ `Result.ok(value)`（**元オブジェクトをそのまま返す**）

`parse(value, options)`: 同じ順序だが `transformedData = { ...obj }`（**浅いコピー1回だけ**）に対して transform 結果を `setNestedValue` で書き戻す。ネストしたオブジェクト／配列要素は共有参照なので、**入力の入れ子を破壊する**（`array-batch-optimizer` 側は要素ごとに `{...element}` するが、`nested-array-processor` は object でない要素をそのまま通す）。

### 短絡（abort）の2階層 — これが本質的な意味論
**2レベルある。両方ともデフォルト true。**
- `abortEarly`（オブジェクトレベル）: `options?.abortEarly !== false`。最初にエラーが出たフィールドで `Result.error` を返して残りのフィールドを検証しない。
- `abortEarlyOnEachField`（フィールドレベル）: `options?.abortEarlyOnEachField !== false`。1フィールド内の複数バリデータ（`.required().min(3).pattern(...)`）のうち最初の失敗で打ち切る。false なら同一フィールドの全違反を集める。

`test/integration/abort-early-real-world.test.ts:75-90` が「`abortEarly:false, abortEarlyOnEachField:true` → フィールドごとに1ずつ全フィールド分」というフォームUX向けの組み合わせを明示的にテストしている。これが引き継ぐべき中核仕様。

**例外**: 配列要素の検証だけは `effectiveAbortEarlyOnEachField = false` を**ハードコードで強制**している（`array-batch-optimizer.ts:235`、`nested-array-processor.ts:393`）。すなわち「配列要素内は必ず全フィールド検証する」。要素間は `abortEarly` に従う。

### 実行順序の保証（現状は保証されていない）
エラー順は **配列バッチ → fast フィールド → slow フィールド** で、`.v()` の宣言順ではない。fast/slow の割り当ては `Map` の挿入順に依存する。新実装は「宣言順」を明示的に保証すべき（後述の openQuestions）。

### "strategy" は何種類あり、何で切り替わるか
`ValidationStrategy` enum（`strategy-factory.ts:16-21`）は **4種類**: `FAST_SEPARATED`, `DEFINITION_ORDER`, `ARRAY_BATCH`, `HOISTED_OPTIMIZED`。

しかし**実際に効いているのは高々2種類、しかもフィールド単位ではなくスキーマ全体で1つ**。`execution-strategy-selector.ts:33-37` に `// TODO: Support per-field strategy analysis` とあり、`analyzeFields()` が返す**単一の** `StrategyAnalysis` を全フィールドに配っている。`analyzeFields` の判定は:
- どれか1つでも配列要素パスを含む → `ARRAY_BATCH`（→ 全フィールドが slow 扱い）
- どれか1つでも transform を含む → `DEFINITION_ORDER`（→ 全フィールドが slow 扱い）
- それ以外 → `FAST_SEPARATED`（→ 全フィールドが fast 扱い）

`HOISTED_OPTIMIZED` はどこからも生成されない。`ARRAY_BATCH` / `DEFINITION_ORDER` に対応する `IValidationStrategy` 実装（`createArrayBatchStrategy` / `createMultiFieldStrategy` / `createStrategy` / `createOptimalStrategy` / `createSingleFieldStrategy`）は**一切呼ばれない**（grep 済み: `strategy-factory` からのインポートは `analyzeFields` / `StrategyAnalysis` / `ValidationStrategy` のみ）。

さらに `buildUnifiedValidators` は `createUnifiedValidator(..., "fast_separated", accessor)` を**常にハードコード**で渡す（`validator-factory.ts:344-352`）。つまり strategy 分析の唯一の実効果は「fast マップに入るか slow マップに入るか」だけ。

**そして fast/slow は性能差ではなく意味論差を生んでいる**（これが最大の罠）:
- fast パス: 欠損フィールドの存在チェックをしない。プラグインが判断する。
- slow パス: `fieldExistenceCache` で存在チェックし、**「欠損 かつ optional でない かつ required プラグインもない」なら暗黙の `REQUIRED` エラーを自動生成する**（`validator-factory.ts:1284-1295`）。

同じスキーマでも「配列や transform を1つ足すと全フィールドが slow に落ち、暗黙 REQUIRED が発火するようになる」。これは仕様として維持不能。新実装は「暗黙 REQUIRED を出すか否か」を strategy と切り離し、明示的な規則にすること。

さらに `analyzeFields` の transform 検出は `builderFunction.toString()` に正規表現 `/\.(\w+)\(/g` をかけてメソッド名を抜くソース文字列解析（`strategy-factory.ts:530-541`）。eval ではないので CSP は破らないが、`.toString()` はミニファイ・トランスパイル・カバレッジ計装で壊れる。捨てる。

### unified / ultra-fast / raw の3バリアント — 実測した使用状況
| モジュール | 実際に使われるか | 内容 |
|---|---|---|
| `optimization/unified-validator.ts` | **使われる（唯一の実路）** | フィールド単位バリデータの実体。内部でさらに3分岐 |
| `builder/raw-validator.ts` | **環境変数でのみ到達** | `process.env.LUQ_ULTRA_FAST === "true"` または `global.__LUQ_ULTRA_FAST__ === true` かつ配列バッチなし かつ validator 総数 ≤50 のときだけ（`validator-factory.ts:462-471`） |
| `builder/ultra-fast-validator.ts` | **完全な死骸** | `createUltraFastSingleFieldValidator` / `createUltraFastMultiFieldValidator` は validator-factory の 48-50 行で import されるだけで**一度も呼ばれない**（grep 済み） |

`unified-validator` の内部分岐（`createUnifiedValidator`, 79-105行）:
1. skip プラグインなし & transform なし & validator ≤10 → `createUltraFastValidator`（1個/2個/N個で特殊化、成功時は凍結済みシングルトン `ULTRA_FAST_VALID_RESULT` を返して**アロケーションゼロ**）
2. skip なし & transform あり & validator ≤10 & transform ≤5 → `createOptimizedTransformValidator`（1v1t / 2v1t を手展開）
3. それ以外 → `executeFastSeparated`（validate→transform の2相）または `executeDefinitionOrder`（skip プラグインがある場合。宣言順で1本のループ）

`executeInDefinitionOrder = strategy === "definition_order" || hasSkipPlugins`。strategy は常に `"fast_separated"` なので、**実質「skip 系プラグイン（`skip` / `validateIf` = `shouldSkipAllValidation`）を使ったフィールドだけが definition-order 実行になる」**。

### 1.2M ops/sec を生んでいた実際の要素（再現すべきもの）
1. **成功パスでオブジェクトを一切作らない**。凍結シングルトン `{valid:true, errors:[]}` を返す。
2. **エラーメッセージを失敗時にのみ計算する**（`computeErrorMessage`）。
3. **アクセサをビルド時に閉包へ焼き込む**（実行時の `split(".")` ゼロ）。
4. **validator 数で関数を特殊化**（1個・2個・N個）。
5. **`validate` は transform 相を完全にスキップする**（`VALIDATE_MODE`）。`parse` だけ transform を走らせる。
6. **配列を1回だけ読み、その要素に対して全フィールドをまとめて検証する**（配列バッチの本質。同じ配列を N フィールド分 N 回走査しない）。

### 配列バッチ最適化が実際に速くしていたこと
`array-batch-optimizer.ts` 冒頭のコメントが意図を書いている: `customer.addresses.type/.name/.street` の3フィールドを別々に処理すると配列を3回走査する。バッチは「配列を1回取得 → 各要素について type/name/street をまとめて検証」に畳む。**これは正しい最適化で、新実装でも再現すべき**（データ指向のループ交換）。

`nested-array-processor` は任意深さの `a[*].b[*].c` を階層化し、`items[0].tags[2]` のような**インデックス入りの正確なエラーパス**を組み立てる。これも仕様として引き継ぐ。

**ただし実装は最適化を自ら殺している**: `createArrayBatchValidator(batchInfo, allValidators)` が `executeValidate` / `executeParse` の**ループ内**で呼ばれている（`validator-factory.ts:1112`, `1419`, `1453`）。つまりバッチバリデータを **validate() のたびに再構築**している。「ビルド時に事前計算」という設計意図が実装で守られていない。これが README の complex 43K ops/sec（simple の 1/28）の主因の一つと見てよい。

### ビルド時コストの実測
`builderFunction` は1フィールドあたり**最低6回**実行される: `build()` で1回（結果は `rules` に捨てられる）、`fieldsWithBuilders` の optional/required 判定で1回、`buildUnifiedValidators` が3回呼ばれ（slow / fast / all）そのうち該当する2呼び出しでそれぞれ本体1回＋`createUnifiedValidator` 内部1回。ビルド結果のキャッシュもない。

### CSP 安全性の穴（重要）
`src/types/array-type-analysis.ts:196` に **`new Function(...)` がある**（多次元配列用のループ生成器）。`validator-factory.ts:46` と `array-batch-optimizer.ts:20` は型 `ArrayStructureInfo` しか使っていないが `import type` ではないため**モジュールが実行時バンドルに載る**。README の「CSP-safe: no eval/Function」は現状バンドル上は嘘になり得る。新実装ではこのファイルごと廃棄し、`import type` 規律を徹底すること。

### 再入不可（並行実行で壊れる）共有可変状態
性能の名目で導入された可変シングルトンが複数あり、これらは**捨てるべき**:
- `ultra-fast-validator.ts:12-13` `SUCCESS_RESULT` / `ERROR_RESULT` をモジュールスコープで使い回し
- `unified-validator.ts:701` `const singleError = {path, code, message}` をバリデータ間で使い回し
- `unified-validator.ts:961-977` `validateError` / `parseError` / `parseSuccess` を事前確保して毎回上書き（`parseSuccess.data = transform(value)` → 前回の結果を保持したオブジェクトを返す）
- `validator-factory.ts:705` `const errors: any[] = []` をクロージャで共有し `errors.length = 0` でリセット（`.slice()` で防御しているが脆い）

### 死んでいる／壊れているコード（この領域）
- `src/core/optimization/array-batch-validator.ts`（214行）: **どこからも import されていない**
- `src/core/optimization/core/validation-engine.ts`（763行）/ `field-utils.ts`: `strategy-factory` からしか参照されず、`strategy-factory` の該当関数は呼ばれない → 実質全死
- `src/core/builder/ultra-fast-validator.ts`（258行）: 全死
- `strategy-factory.ts` の `IValidationStrategy` / `createFastSeparatedStrategy` / `createDefinitionOrderStrategy` / `createArrayBatchStrategy` / `createMultiFieldStrategy` / `createStrategy` / `createOptimalStrategy` / `createSingleFieldStrategy` / `createArrayBatchStrategyFromFields`: 全死
- `validator-factory.ts` 内の `validateArrayElementField` / `parseArrayElementField` / `hasOptionalValidator`: 定義のみで参照ゼロ
- `array-batch-optimizer.ts` の legacy パス（209-363行）: `result.isValid()` を呼ぶが `UnifiedValidator` の返り値には `isValid` メソッドがない → 到達すれば **TypeError で落ちる**
- `unified-validator.ts` の静的メッセージ事前計算（682-695行）: `field-context.ts:409` が `messageFactory` に必ずフォールバック `(() => "Validation failed")` を入れるため `isDynamic` が**常に true**。最適化が一度も発火しない
- `raw-validator.ts` の `validate()`（フィールド2個以上）: `validateRaw` の boolean だけを見て `{path:"", code:"VALIDATION_ERROR", message:"Validation failed"}` を返す。**エラーのパスも原因も失われる**。ultra-fast モードは意味論的に等価ではない

### エラーパスの不整合（新実装で必ず決着させること）
同じ `items[*].name` が、通る経路によって別のパスを報告する:
- 配列バッチ経路（`nested-array-processor`）→ `items[0].name`（インデックス入り、正しい）
- 非バッチ経路（`validator-factory.ts:validateArrayElementPath:2016`）→ `error.path || elementPath` で、validator が返す `error.path` はパターン文字列 `items[*].name` なのでそちらが勝つ → **`items[0].name` にならない**

## Contracts to preserve (25)

### must-preserve (17)

#### TransformAwareValidator<T, TTransformed>
- Source: `src/core/builder/plugins/plugin-types.ts:1133-1147`
- Shape: { validate(value: Partial<T> | unknown, options?: ValidationOptions): Result<T>; parse(value: Partial<T> | unknown, options?: ParseOptions): Result<TTransformed>; pick<K extends NestedKeyOf<T>>(key: K): FieldValidator<T, TypeOfPath<T, K>> }
- Meaning: build() の戻り値。validate は入力をそのまま Result.ok に載せて返す（transform を適用しない）。parse は transform を適用した新しいオブジェクトを返す。pick は単一フィールド用のサブバリデータを返す。

#### ValidationOptions
- Source: `src/types/index.ts:41-53`
- Shape: { abortEarly?: boolean; abortEarlyOnEachField?: boolean; messageFactory?: MessageFactory; translate?: (key: string, params?: Record<string, unknown>) => string; context?: Record<string, unknown> }
- Meaning: abortEarly / abortEarlyOnEachField はいずれも既定 true。実装は `options?.abortEarly !== false` という判定なので、undefined と true が同じ意味になる。messageFactory / translate / context は型に存在するが execution-model 側では読まれていない（validator-factory は abortEarly 系しか参照しない）。

#### abortEarly（オブジェクトレベル短絡）
- Source: `src/core/builder/validator-factory.ts:1060, 1102, 1176, 1291, 1316`
- Shape: abortEarly?: boolean  // default true
- Meaning: true のとき、最初にエラーを出したフィールドの時点で残りのフィールドを検証せず Result.error を返す。false のとき全フィールドを検証してエラーを蓄積する。

#### abortEarlyOnEachField（フィールド内短絡）
- Source: `src/core/optimization/unified-validator.ts:118,141,571-591 / test/integration/abort-early-real-world.test.ts:75-90`
- Shape: abortEarlyOnEachField?: boolean  // default true
- Meaning: true のとき、1つのフィールドに連鎖した複数バリデータのうち最初の失敗で打ち切り、そのフィールドのエラーは1になる。false のとき同一フィールドの全違反を集める。abortEarly と直交し、`{abortEarly:false, abortEarlyOnEachField:true}` は「全フィールドについて代表エラー1ずつ」というフォーム UX 向けの組み合わせで、テストで固定されている。

#### Result<T>
- Source: `src/types/result.ts:86-158, 234-340`
- Shape: { isValid(): boolean; readonly valid: boolean; isError(): boolean; unwrap(): T; unwrapOr(d: T): T; unwrapOrElse(fn): T; map<U>(fn): Result<U>; flatMap<U>(fn): Result<U>; tap(fn): Result<T>; tapError(fn): Result<T>; data(): T | undefined; readonly errors: ValidationError[]; toPlainObject(): { valid: boolean; data?: T; errors: ValidationError[] } }
- Meaning: validate / parse の戻り値。成功時は errors が空配列、失敗時は data() が undefined。unwrap() は失敗時に LuqValidationException を投げる。Result.ok は prototype ベース（Object.create(successProto)）で成功パスのアロケーションを抑えている。`valid` は isValid() の後方互換 getter。

#### ValidationError
- Source: `src/types/index.ts:25-30`
- Shape: { path: string; message: string; code: string; paths(): string[] }
- Meaning: 公開エラー形。`paths()` は関数（配列ではない）。code は validator の `code` → `pluginName` → "VALIDATION_ERROR" の順にフォールバック。path はフィールドパス、配列要素の場合はインデックス入り（items[0].name）が正。

#### REQUIRED（ルートレベル）
- Source: `src/core/builder/validator-factory.ts:1029-1038, 1336-1345`
- Shape: value == null → Result.error([{ path: "", code: "REQUIRED", message: "Value is required", paths: () => [""] }])
- Meaning: validate/parse に null / undefined を渡したときの固定応答。path は空文字列。

#### validate は transform を適用しない / parse のみ適用する
- Source: `src/constants.ts:10-12 / src/core/optimization/unified-validator.ts:594-603`
- Shape: VALIDATE_MODE = "validate" | PARSE_MODE = "parse"
- Meaning: validate は検証相だけを実行して transform 相をスキップし、入力オブジェクトをそのまま Result.ok に載せる。parse は検証成功後に transform を順に適用し、書き換えた新オブジェクトを返す。この分離が validate の速度を生んでいる中核。

#### フィールド内の実行順序
- Source: `src/core/optimization/unified-validator.ts:107-110, 218-338, 514-655`
- Shape: validators を宣言順に実行 → (parse 時のみ) transforms を宣言順に実行
- Meaning: 既定は「全 validator → 全 transform」の2相（fast_separated）。skip 系プラグイン（shouldSkipAllValidation を持つもの）が含まれるフィールドだけ、validator と transform を宣言順で1本のパイプラインとして実行する（definition_order）。

#### skip セマンティクス（shouldSkipAllValidation）
- Source: `src/core/optimization/unified-validator.ts:260-268, 556-565 / src/core/plugin/skip.ts:80 / src/core/plugin/validateIf.ts:123`
- Shape: validator.shouldSkipAllValidation?(value, rootData): boolean
- Meaning: true を返した時点で、そのフィールドの以降の validator を全てスキップして成功扱いにする（break）。skipPlugin / validateIfPlugin が生成する。

#### skipForNull / skipForUndefined セマンティクス
- Source: `src/core/optimization/unified-validator.ts:232-252, 529-550, 1186-1197 / src/core/plugin/nullable.ts:74 / src/core/plugin/optional.ts:76`
- Shape: validator.skipForNull?: true / validator.skipForUndefined?: true
- Meaning: フィールドのどれか1つの validator がこのフラグを持ち、かつ値が null（/ undefined）のとき、そのフィールドは検証も transform も全てスキップして成功扱いになり、parse では元の値をそのまま返す（transform をかけない）。nullablePlugin が skipForNull、optionalPlugin / optionalIfPlugin が skipForUndefined を立てる。

#### 内部 validator レコード形
- Source: `src/core/builder/context/field-context.ts:395-450`
- Shape: { check: (value, rootData) => boolean; name: string; code: string; pluginName: string; getErrorMessage?: (value, path, rootData) => string; messageFactory: (issueContext) => string; inputType; outputType; metadata; shouldSkipAllValidation?; shouldSkipValidation?; shouldSkipFurtherValidation?; skipForNull?; skipForUndefined?; __isRecursive?; recursive?; params? }
- Meaning: プラグインと実行エンジンの間の唯一の契約。check は同期の boolean 述語で第2引数にルートデータを受ける（実際の呼び出しは2引数のみ。validation-engine が想定していた第3引数 arrayContext は実路では渡されていない）。エラーメッセージは getErrorMessage 優先、なければ messageFactory。両方が throw した場合は `Validation failed for ${path}` にフォールバックする。

#### エラーメッセージの遅延計算
- Source: `src/core/optimization/unified-validator.ts:881-906`
- Shape: computeErrorMessage(validator, value, path, rootData): string
- Meaning: メッセージは検証が失敗したときにのみ生成する。成功パスでは一切呼ばない。getErrorMessage / messageFactory が例外を投げた場合も検証は落とさず既定文言にフォールバックする。

#### パスアクセサのビルド時コンパイル（CSP-safe）
- Source: `src/core/plugin/utils/field-accessor-optimized.ts:26-80`
- Shape: createAccessor(pathSegments: readonly string[]): (obj: unknown) => unknown
- Meaning: 深さ 0〜5 を専用クロージャ（obj?.[k1]?.[k2]...）に展開、6以上はループ。実行時に split(".") をしない。new Function / eval を使わずに達成している点が CSP-safe の実体。setter も同様。

#### 配列バッチ（ループ交換）最適化
- Source: `src/core/builder/array-batch-optimizer.ts:1-16, 270-360 / src/core/builder/nested-array-processor.ts:383-620`
- Shape: arrayPath ごとに { elementFields: string[], accessors: Map<field, accessor>, childArrays } を持ち、配列を1回だけ読んで各要素について全 elementFields を検証する
- Meaning: N 個の要素フィールドがあっても配列走査は1回。フィールドごとに配列を走査し直さない。これが complex スキーマ性能の中核的な意図。

#### 配列要素エラーパスのインデックス展開
- Source: `src/core/builder/nested-array-processor.ts:410-412, 552`
- Shape: パターン `items[*].name` → 実エラーパス `items[0].name`、多階層は `a[0].b[2].c`
- Meaning: エラーの path は宣言パターンではなく実インデックスに展開されていなければならない。任意深さの入れ子配列で親のインデックスを引き継いで組み立てる。

#### 空配列の扱い
- Source: `src/core/builder/array-batch-optimizer.ts:262-266 / src/core/optimization/core/strategy-factory.ts:254-257`
- Shape: arrayData.length === 0 → 要素検証をスキップし、配列自身の validator（minLength 等）だけを走らせる
- Meaning: 空配列に対して要素レベルの required 等を発火させない。配列本体レベルの検証は別途走る。

### should-preserve (7)

#### ParseOptions
- Source: `src/types/index.ts:58-71`
- Shape: ValidationOptions & { transforms?: Record<string, (value: unknown) => unknown> }
- Meaning: parse 用。`transforms` フィールドは型に存在するが execution-model のどこからも読まれていない（デッド）。

#### 配列要素内は abortEarlyOnEachField を常に false に強制
- Source: `src/core/builder/array-batch-optimizer.ts:235 / src/core/builder/nested-array-processor.ts:393`
- Shape: effectiveAbortEarlyOnEachField = false
- Meaning: 配列要素の検証では、呼び出し側の abortEarlyOnEachField によらず要素内の全フィールドを検証する。要素間の打ち切りは abortEarly に従う。

#### 成功結果のゼロアロケーション
- Source: `src/core/optimization/unified-validator.ts:869-876`
- Shape: const ULTRA_FAST_VALID_RESULT = Object.freeze({ valid: true, errors: [] })
- Meaning: フィールド検証が成功したときに凍結済みシングルトンを返し、オブジェクト生成を避ける。1.2M ops/sec を支える中核テクニック。凍結しているので呼び出し側が書き換えられない点も重要。

#### 配列本体の検証失敗時は要素検証をスキップ
- Source: `src/core/builder/validator-factory.ts:1091-1108`
- Shape: 配列パス自身の validator が失敗 → continue（要素ループに入らない）
- Meaning: `items` が配列でない／required 違反のとき、`items[*].name` のエラーを重ねて出さない。

#### default 値の適用タイミング
- Source: `src/core/builder/validator-factory.ts:509-521, 1044-1057, 1352-1362`
- Shape: applyDefault(currentValue, fieldOptions, { allValues }) を検証前に適用
- Meaning: validate / parse のどちらでも、検証を始める前に fieldOptions の default を適用した（浅くコピーした）オブジェクトに対して検証を行う。validate では default 適用後のオブジェクトを検証しつつ Result.ok には元の value を返す（＝ validate は default を結果に反映しない）。parse は反映する。

#### pick(key)
- Source: `src/core/builder/validator-factory.ts:2641-2760`
- Shape: pick<K extends NestedKeyOf<T>>(key: K): FieldValidator<T, TypeOfPath<T, K>>  // { validate(value, allValues?, options?), parse(value, allValues?, options?) } を返す
- Meaning: 単一フィールド（および `key[*]...` / `key.*...` / `key....` に前方一致する派生パス群）だけを検証するサブバリデータを返す。定義が見つからないキーに対しては常に成功するバリデータを返す。返り値は Result ではなく `{ valid, value, errors }` のプレーン形である点に注意（validate/parse とは別の形）。

#### objectRecursively の再帰実行モデル
- Source: `src/core/builder/validator-factory.ts:328-331, 2061-2115 / src/core/plugin/objectRecursively.ts:115`
- Shape: validator.__isRecursive === true, validator.recursive = { targetFieldPath: string | "__Self" | "__Element", maxDepth?: number }  // maxDepth 既定 10
- Meaning: 深さが maxDepth を超えたら成功として打ち切る。WeakSet で訪問済みオブジェクトを追跡し循環参照を成功扱いで打ち切る。`__Self` は「ルートの全フィールドバリデータを入れ子オブジェクトに再適用」、`__Element` は配列要素に対する同様の適用を意味する。再帰中はフィールド間で abort early しない。

### optional (1)

#### 空スキーマの挙動
- Source: `src/core/builder/validator-factory.ts:263-281`
- Shape: fieldDefinitions.length === 0 → validate: () => Result.ok({}), parse: (v) => Result.ok(v)
- Meaning: フィールドを1つも宣言しないビルダーは常に成功する。validate は入力を無視して空オブジェクトを返す（parse は入力をそのまま返す）という非対称がある。

## Behavioural rules

- build() は純粋な事前計算フェーズであること。実行時に構築してよいオブジェクトはエラー配列と（parse の）出力オブジェクトだけ。旧実装が createArrayBatchValidator を validate() のループ内で毎回呼んでいたような「実行時構築」は禁止。
- build() 中に各フィールドのビルダー関数を実行するのは 1 回だけにすること。旧実装は最低 6 回実行していた。ビルダー関数の副作用に依存してはならないが、多重実行を前提にもしないこと。
- 実行時の速度は次の 6 点で担保する: (1) 成功時に凍結シングルトン結果を返しアロケーションゼロ、(2) エラーメッセージは失敗時のみ計算、(3) パスアクセサ／セッタはビルド時にクロージャへ焼き込み実行時 split をしない、(4) validate は transform 相を完全にスキップ、(5) 配列は1回だけ走査して要素の全フィールドをまとめて検証、(6) 失敗が起きるまでは分岐を最小に保つ。
- validator 数 1/2/N での関数手展開（旧 createUltraFastValidator の 1個・2個特殊化）は、実測ベンチで有意差が出た場合にのみ導入すること。旧実装はこの手展開でコード量を数倍にしたが、効果を測った形跡がない。既定は素直な for ループ1本。
- abortEarly と abortEarlyOnEachField は 2 レベル独立の短絡制御として維持し、両方とも既定 true。判定は `!== false` ではなく明示的な既定値代入（`const abortEarly = options?.abortEarly ?? true`）で書くこと。
- 配列要素の内部は abortEarlyOnEachField を無視して常に全フィールドを検証する。この非対称は意図的な仕様なので保つが、コード内でハードコードするのではなく名前の付いた定数／規則として表現すること。
- エラーの順序は .v() の宣言順に一致させること。旧実装は「配列バッチ → fast マップ → slow マップ」という内部データ構造の都合で順序が決まっており、これは仕様として保証されていなかった。新実装は単一の順序付きフィールドリストを唯一の真実とすること。
- フィールドの実行経路（fast/slow のような内部分類）が検証の意味論を変えてはならない。旧実装は slow パスにだけ暗黙の REQUIRED エラー生成があり、スキーマに配列や transform を 1 つ足すと全フィールドの挙動が変わった。欠損フィールドの扱いはプラグイン（required / optional）だけが決めること。
- 「暗黙 REQUIRED」を残すか否かを設計時に一度だけ決め、全フィールドに一様に適用すること。フィールドが欠損しているかどうかの判定は `in` ベースの存在チェック（undefined が明示的に入っている場合と欠損を区別する）で行う。
- 配列要素のエラーパスは必ず実インデックスに展開する（items[0].name）。パターン文字列（items[*].name）がエラーとして外に出てはならない。旧実装は経路によってどちらも出ていた。
- eval / new Function を絶対に使わない。型だけを使うモジュールは `import type` で読み、実行時バンドルに載せないこと。旧実装は src/types/array-type-analysis.ts の new Function をバンドルに載せていた。
- モジュールスコープや validator スコープの可変シングルトン結果オブジェクトを作らないこと。成功結果の共有は Object.freeze された不変値に限る。旧実装の SUCCESS_RESULT / ERROR_RESULT / singleError / parseSuccess は返した後に上書きされる再入不可な設計だった。
- parse の入力非破壊性を明示的に決めること。旧実装は `{ ...obj }` の浅いコピーしかせず、入れ子オブジェクトと配列要素は入力と共有参照だったため、transform が呼び出し側のデータを書き換えていた。
- validator の check は同期の純粋述語 (value, rootData) => boolean に固定する。副作用・非同期・throw を前提にしない（throw はメッセージ生成側でのみ握り潰す）。
- 実行エンジンのバリアントは 1 つに統一すること。旧実装の unified / raw / ultra-fast の 3 バリアントは、片方が死んでおり、もう片方は意味論が非等価だった。
- 環境変数やグローバル変数で実行モードを切り替えないこと（LUQ_ULTRA_FAST）。挙動が実行環境で変わり、意味論も非等価だった。

## Not carried forward

- **src/core/builder/ultra-fast-validator.ts（258行）全体** — createUltraFastSingleFieldValidator / createUltraFastMultiFieldValidator は validator-factory.ts:48-50 で import されているだけで、リポジトリ全体で一度も呼び出されていない（grep で確認）。加えてモジュールスコープの SUCCESS_RESULT / ERROR_RESULT を使い回すため再入不可。完全な死骸。
- **src/core/optimization/array-batch-validator.ts（214行）全体** — src/ 全体を grep してもこのファイルを import しているモジュールが 1 つも存在しない。
- **src/core/optimization/core/validation-engine.ts（763行）と field-utils.ts** — strategy-factory.ts からしか参照されておらず、その strategy-factory の該当関数群（createFastSeparatedStrategy 等）は実路から一度も呼ばれない。validateHoisted / reconstructErrors（エラーインデックスだけ返して後からメッセージを再構成する遅延化）は着想としては良いが、実装は使われた形跡がなく、unified-validator 側の「失敗時のみメッセージ計算」で同じ効果が既に得られている。
- **ValidationStrategy enum の 4 値と IValidationStrategy 抽象（strategy-factory.ts）** — HOISTED_OPTIMIZED はどこからも生成されない。ARRAY_BATCH / DEFINITION_ORDER に対応する IValidationStrategy 実装は createStrategy / createOptimalStrategy / createSingleFieldStrategy 経由でしか作られず、その 3 関数はどこからも呼ばれない。実効的には「fast マップに入るか slow マップに入るか」の 1 ビットしかなく、それすらフィールド単位ではなくスキーマ全体で 1 個。抽象が支えているものが何もない。
- **selectOptimalStrategies / groupByStrategy による fast/slow の 2 マップ分割** — execution-strategy-selector.ts:33-37 に `// TODO: Support per-field strategy analysis` とあり、全フィールドに同一の StrategyAnalysis を配っている。しかも分割の唯一の実効果は「slow パスにだけ暗黙 REQUIRED 生成がある」という意味論差で、性能差ではない。スキーマに配列や transform を 1 つ足すだけで全フィールドの検証意味論が変わる、という維持不能なバグを生んでいる。
- **builderFunction.toString() + 正規表現によるプラグイン呼び出し抽出（strategy-factory.ts:530-541 extractPluginCalls / isTransformPlugin）** — ソース文字列解析はミニファイ、トランスパイル、カバレッジ計装、bind されたクロージャで壊れる。transform の有無はビルダー関数を 1 回実行して _transforms.length を見れば正確に分かる（実際 unified-validator はそうしている）。二重の判定ロジックがあり片方が不正確。
- **raw-validator.ts と LUQ_ULTRA_FAST 環境変数 / global.__LUQ_ULTRA_FAST__ 経路** — 実行環境の環境変数で検証の意味論が変わる。しかも非等価: フィールド 2 個以上の raw validate() は validateRaw の boolean だけを見て `{path:"", code:"VALIDATION_ERROR", message:"Validation failed"}` という情報ゼロのエラーを返す（raw-validator.ts:355-368, 456-467）。どのフィールドがなぜ落ちたか分からない。「速いモード」と称して壊れたモードを配っている。
- **TransformAwareValidator の optional メンバ validateRaw? / parseRaw?** — README にもドキュメントにも記載がなく（grep 済み）、LUQ_ULTRA_FAST モードでしか実体が入らないので実質常に undefined。型に現れる意味がない。
- **array-batch-optimizer.ts の legacy パス（209-363行）** — `result.isValid()` を呼んでいるが（312行）、UnifiedValidator が返すのは `{ valid, errors }` のプレーンオブジェクトで isValid メソッドを持たない。到達すれば TypeError で落ちる。_nestedInfo が常に付く現在の経路では到達しないが、死んだうえに壊れている。
- **src/types/array-type-analysis.ts の ArrayTypeAnalyzer.generateOptimizedValidator / createNestedLoopValidator / generateNestedLoopCode（new Function によるループ生成）** — new Function は CSP 違反であり README の「CSP-safe: no eval/Function」と真っ向から矛盾する。呼び出し元は存在しないが、validator-factory.ts:46 と array-batch-optimizer.ts:20 が値インポート構文で（import type ではなく）このモジュールを読んでいるため実行時バンドルに載る。多次元配列は普通の再帰ループで書けば十分。
- **unified-validator.ts の validator 数 1個・2個の手展開特殊化（706-786行）および createOptimizedTransformValidator の 1v1t / 2v1t 手展開（953-1110行）** — 同じロジックを 4〜6 回書き写しており、片方だけ直すバグ（実際 skipForNull チェックが parse 側 1114-1197 行にしか入っておらず、1v1t / 2v1t 特殊化パスには入っていない）を既に生んでいる。V8 は単純な for ループを十分に最適化する。効果測定の根拠なくコードを 5 倍にしている。
- **unified-validator.ts:682-695 の「静的エラーメッセージの事前計算」** — field-context.ts:409 が messageFactory に必ず `(() => "Validation failed")` をフォールバックで入れるため、isDynamic[i] は常に true。この分岐は一度も static 側に落ちない。動かない最適化。
- **モジュール／クロージャスコープの可変結果オブジェクト（unified-validator.ts:701 singleError, 961-977 validateError/parseError/parseSuccess, ultra-fast-validator.ts:12-13 SUCCESS_RESULT/ERROR_RESULT, validator-factory.ts:705 共有 errors 配列）** — 返したオブジェクトが次の呼び出しで書き換わる。parseSuccess.data は前回の transform 結果を保持したまま返る。呼び出し側が結果を保持する／同一バリデータを入れ子で呼ぶ／並行に呼ぶと壊れる。得られるアロケーション削減より正しさの損失が大きい。
- **validator-factory.ts 内の validateArrayElementField / parseArrayElementField / hasOptionalValidator** — 定義のみで参照ゼロ（grep でカウント 1）。hasOptionalValidator にはコメントアウトされた console.log デバッグが 6 行残っている。
- **validator-factory.ts 1137-1154 / 1227-1244 の「親が空配列ならスキップ」ループ** — fast ループと slow ループに完全にコピペで重複しており、しかもフィールドパスの各接頭辞について getNestedValue を毎回呼ぶ O(depth) の走査を全フィールド × 毎回の validate() で行う。ホットパスに置かれた線形探索。配列の入れ子構造はビルド時に分かるのだから、実行時に文字列を split して親を辿り直す必要がない。
- **validator-factory.ts の 3 回の buildUnifiedValidators 呼び出し（slow 用 / fast 用 / all 用）と 230-240 行の「allValidators から fast/slow マップを事後的に上書きする」パッチ** — 同じ validator を 3 セット作り、そのあと [*] を含むパスだけ後から差し替えるという構造。フィールドごとに 1 個の validator を持つ単一のマップがあれば足りる。ビルド時間の 3 倍化と、どのマップが正しいのか分からない状態を生んでいる。
- **コード中の「V8 optimization:」コメント（unified-validator.ts と validator-factory.ts に数十箇所）** — 大半が根拠のない儀式（「for...of より for が速い」「ローカル変数に取ると速い」）で、いくつかは実際には最適化になっていない（凍結オブジェクトを返してから .errors を map するなど）。コメントが実装の正しさを保証しているかのように見せているが、測定の裏付けがない。新実装ではベンチマークで示せない最適化コメントを書かないこと。
- **build() が def.builderFunction(context) を 1 回実行して結果を FieldDefinition.rules に詰める処理（field-builder.ts:202-222）** — rules フィールドは validator-factory 側で一切読まれない。ビルダー関数の実行 1 回分を丸ごと捨てている。

## Published symbols (49)

`Builder`, `.use()`, `.for<T>()`, `.v(path, builderFn)`, `.field()`, `.useField()`, `.strict()`, `.build()`, `TransformAwareValidator`, `validate(value, options?)`, `parse(value, options?)`, `pick(key)`, `ValidationOptions`, `ParseOptions`, `abortEarly`, `abortEarlyOnEachField`, `messageFactory`, `translate`, `context`, `transforms`, `Result`, `Result.ok`, `Result.error`, `Result<T>.isValid()`, `Result<T>.isError()`, `Result<T>.valid`, `Result<T>.errors`, `Result<T>.unwrap()`, `Result<T>.unwrapOr()`, `Result<T>.unwrapOrElse()`, `Result<T>.map()`, `Result<T>.flatMap()`, `Result<T>.tap()`, `Result<T>.tapError()`, `Result<T>.data()`, `Result<T>.toPlainObject()`, `ValidationError`, `ValidationError.path`, `ValidationError.code`, `ValidationError.message`, `ValidationError.paths()`, `LuqValidationException`, `REQUIRED`, `VALIDATION_ERROR`, `PARSE_ERROR`, `FieldValidator`, `NestedKeyOf`, `TypeOfPath`, `ApplyFieldTransforms`

