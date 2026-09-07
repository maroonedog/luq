# anti-patterns

破綻の起点は一箇所に特定できる。`TypedPlugin<TName, TMethodName, TMethod extends Function, ...>`（src/core/builder/plugins/plugin-types.ts:63-76）が、プラグインのメソッド実装を「Function」という情報ゼロの型で受けたこと。引数タプルも戻り値も型として保持しなかったため、ビルダー連鎖の型を作るには「捨てた情報を再構築する」しかなくなった。その再構築が MapPluginMethodsToChainable / InferChainableReturnType / GetPluginCategoryByMethod / ApplyTypesToMethod（同ファイル 288-640行）という、`category` 文字列を分岐キーにした巨大な条件型の連鎖であり、1482行のうち約900行がこの再構築に費やされている。しかも InferMethodParameters は `GetPluginMethodByName<TPlugins, TMethodName> extends (...args: infer P) => any ? P : never` で結局 Function から推論し直すだけで、TMethod を捨てた損失は回復していない。

型側でこうなった結果、ランタイム側は型と一切接続できなくなった。createChainableBuilder は `const builder: any = {}` を組み立てて最後に `as IChainableBuilder<...>` で嘘をつく（src/core/builder/core/builder.ts:25,101）。createOptimizedTypeBuilder は `Record<string, unknown>` にプラグインメソッドを動的代入して `as ChainableFieldBuilder<...>`（src/core/builder/context/field-context.ts:180,303）。型とランタイムが完全に分離した二重帳簿になり、以降どの層も相手を検証できないので `any` が伝播した。any 1365件の分布は validator-factory.ts 116、unified-validator.ts 90、plugin-interfaces.ts 77、types/types.ts 66 と、まさにこの境界層に集中している。

2882行の validator-factory.ts が生まれた理由も同根。型が守ってくれないので、実行時に「このフィールドは optional か」を `built._validators.some(v => v.name === "optional")` と文字列比較で調べ（validator-factory.ts:106,109,1852,1856）、失敗したら `catch (e)` で握り潰して false と仮定する（同 112-115）。さらに「速い経路」を作るたびに新しい実行エンジンを丸ごと足したため、validate 実行経路が createRawValidator / createUltraFastExecutorValidator / createValidatorExecutor の3系統（validator-factory.ts:471,578,595）、その下の単一フィールド実行も createUltraFastValidator / createOptimizedTransformValidator / executeFastSeparated / executeDefinitionOrder の4系統（unified-validator.ts:661,912,514,218）に分裂した。合計7実装。しかもその分岐を決める selectOptimalStrategies は全フィールドに同一の解析結果を配っており（src/core/optimization/execution-strategy-selector.ts:33-37 の「TODO: Support per-field strategy analysis」）、fast/slow 分割は実質機能していない。583行の strategy-factory.ts と763行の validation-engine.ts はこの空回りのために存在し、validation-engine.ts に至っては唯一の参照元 array-batch-validator.ts 自体が完全に未参照で、実質全量が死んでいる。

「同じ責務が2つ3つある」の実測: フィールドアクセサ生成が3実装（src/core/plugin/utils/field-accessor.ts / field-accessor-optimized.ts / src/core/optimization/core/field-utils.ts に createFieldAccessor・createFieldSetter・createNestedValueAccessor・createBatchAccessors がそれぞれ重複）＋ validator-factory.ts:1791,1871,1897 のローカル再実装で計4。パス解析が parseFieldPath×2、parseArrayElementPath、validateArrayElementPath、analyzeArrayField、getPathSegments、normalizeFieldPath で計7。ValidationError 型が4定義（src/types/index.ts:25 / src/core/builder/types/types.ts:201 / src/core/optimization/core/validation-engine.ts:7 / src/core/plugin/jsonSchema/types.ts:71）で互いに非互換。ValidationFunction が2定義（src/core/plugin/types.ts:88 の型付き版と src/core/builder/types/types.ts:208 の `(value: any, ctx) => {valid}`）。ValidationResult が3定義。createValidationError が3実装。バレルが3本（src/index.ts / src/core/index.ts / src/core/plugin/index.ts）でエクスポート集合が全部違う。

そして最も重い矛盾は思想の裏切りが実コードに残っていること。「CSP-safe: eval/new Function を絶対に使わない」と掲げながら src/types/array-type-analysis.ts:196 で `new Function` によるコード生成を行い、実際に同ファイル 309行から呼ばれている。「プラグイン単位の tree-shaking」と掲げながら、コアの createValidationError が `validator.pluginName === "stringStartsWith" | "stringEndsWith" | "stringMin" | "stringMax" | "arrayMaxLength" | "arrayMinLength"` を直書きしている（src/core/optimization/unified-validator.ts:1298-1330）。コアが個別プラグインを名前で知っている時点で、プラグインは独立モジュールではない。さらに strategy-factory.ts:530-541 の extractPluginCalls は `builderFunction.toString()` を正規表現で走査してユーザーのビルダー関数から使用プラグインを推測しており、minify すれば壊れる。src/core/builder/validator-factory.ts:462-464 は `process.env.LUQ_ULTRA_FAST` と `(global as any).__LUQ_ULTRA_FAST__` で挙動を切り替えており、ブラウザ素バンドルでは process 未定義で例外になる。

正しさを直接壊しているものも複数実測した。src/core/builder/ultra-fast-validator.ts:12-13 はモジュールレベルの可変オブジェクト SUCCESS_RESULT / ERROR_RESULT を全呼び出しで共有して返しており、2回目の validate が1回目の戻り値を書き換える。src/types/result.ts は Result.ok を successProto ベース（errors は**メソッド** 208行）、Result.error を createResult のオブジェクトリテラル（errors は**ゲッタ** 335行）で作っており、`Result<T>` インターフェースが宣言する `readonly errors: ValidationError[]`（148行）を成功系が満たしていない。src/core/builder/plugins/composable-plugin.ts:108-113 は `for (let i = 0; i < transforms.length; i++) { if (!validators[i].check(...)) }` と、transforms の長さで validators を回している。公開型 ValidationError が要求する `paths(): string[]` は約20箇所で個別に手書き生成されているが（array-batch-optimizer.ts、nested-array-processor.ts、raw-validator.ts、validator-factory.ts ほか）、src/ にも test/ にも呼び出しが1件も無い純粋な死荷重で、しかも実装によって `[""]`、`[path]`、`path.split('.')` と返す値が違う。

tsconfig.json は `"strict": true` の直下で noImplicitAny / strictNullChecks / strictFunctionTypes / strictPropertyInitialization / noImplicitThis / noImplicitReturns を全て false にしており、さらに `exclude` に `src/core/async.experimental/**/*` を入れて4ファイル（約800行）を型検査から丸ごと外している。200行超のファイルは33個、最大2882行。完全未参照モジュールは13個（async.experimental 3件、field-type-detector、array-batch-validator、conditionalSchema、message-factories、shared、stitch-typed、stitchSimple、__tests__/test-utils、src/core/registry.ts、types/indexed-result.ts）。

以下 behaviorRules に、新実装で同じ罠に落ちないための禁止事項を「Xのとき Y するな、代わりに Z」の形で列挙する。これが本領域の成果物の本体である。

## 引き継ぐ契約 (13件)

### must-preserve (7)

#### Builder().use(plugin).for<T>().v(path, fn).build()
- 出典: `src/core/builder/core/builder.ts, src/core/builder/core/field-builder.ts, src/core/builder/plugins/plugin-types.ts:1240-1358`
- 形: Builder<TInput=any>(): IChainableBuilder<TInput,{},{}>; .use(...plugins) はプラグイン型を TPlugins に累積; .for<TObject extends object>(): FieldBuilder<TObject, {}, TPlugins, never>; .v<Key extends NestedKeyOf<TObject> & string, TFieldBuilder>(path: Key, def: (ctx: FieldBuilderContext<TObject,TPlugins,TypeOfPath<TObject,Key>>) => TFieldBuilder, options?: FieldConfig): FieldBuilder<TObject, AddFieldTransform<TMap,Key,TypeOfPath<TObject,Key>,ExtractFieldType<TFieldBuilder>>, TPlugins, TDeclaredFields|Key>; .build(): TransformAwareValidator<TObject, ApplyFieldTransforms<TObject,TMap>>
- 意味: use はイミュータブルに見えるが実体は同一 builder オブジェクトへの破壊的追加（builder.ts:41-99）。for は毎回新しい FieldBuilder を返す。v は毎回新しい FieldBuilder インスタンスを返す（field-builder.ts:100-115、ここは正しくイミュータブル）。TMap は「型が変わったフィールドだけ」を蓄積する差分マップで、build 時に元の TObject へ適用される。

#### TransformAwareValidator.validate / parse
- 出典: `src/core/builder/plugins/plugin-types.ts:1133-1148, src/core/builder/validator-factory.ts:490-556`
- 形: validate(value: Partial<T>|unknown, options?: ValidationOptions): Result<T>; parse(value: Partial<T>|unknown, options?: ParseOptions): Result<TTransformed>
- 意味: validate は transform を実行せず検証のみ（VALIDATE_MODE）、parse は transform を適用して変換後データを返す（PARSE_MODE）。この二相分離は全実行エンジンに一貫して存在する意味論であり保持価値がある。value が null/undefined のとき code:"REQUIRED", path:"" のエラー1件を返す。

#### プラグイン記述子 { name, methodName, allowedTypes, category, impl }
- 出典: `src/core/builder/plugins/plugin-creator.ts:79-105`
- 形: plugin({ name: TPluginName, methodName: TMethodName, allowedTypes: readonly TypeName[], category: PluginCategory, impl: (...args) => ValidatorFormat })
- 意味: name はエラーコード既定値かつ重複排除キー、methodName はビルダー連鎖に生えるメソッド名（name と別で良い。例 stringMin → min）、allowedTypes は b.string / b.number 等どの型ビルダーに生やすかのフィルタ（field-context.ts:331 で includes 判定）。この4項目の分離は正しい設計で引き継ぐ。

#### ValidatorFormat（hoisted validator 返り値）
- 出典: `src/core/builder/plugins/plugin-interfaces.ts:26-68, src/core/plugin/required.ts:66-84`
- 形: { check: (value, allValues?, arrayContext?) => boolean; code: string; getErrorMessage: (value, path, allValues?, arrayContext?) => string; params: unknown[] }
- 意味: impl は「引数を受けて事前計算を済ませ、純粋な check 関数を返す」二段階。check は副作用なし・真偽値のみ。メッセージ生成は失敗時にだけ呼ぶ遅延生成。この二段階＋遅延メッセージは本物の設計判断で保持すべき。ただし後述の __isXxx マーカー群は同じオブジェクトに混載されており、それは引き継がない。

#### プラグインは自分の担当型以外の値を通す（type-tolerant check）
- 出典: `src/core/plugin/stringMin.ts:63-68, src/core/builder/context/field-context.ts:39-155`
- 形: check: (value) => { if (typeof value !== "string") return true; return value.length >= minLength; }
- 意味: stringMin は非文字列に対して true を返す。型不一致の報告は b.string が自動で積む stringType バリデータ（field-context.ts:39-52）の責務であり、個々のプラグインは重複してエラーを出さない。これは「1つの不正値につきエラー1件」を保つための意味論であり must-preserve。同様に null/undefined の扱いも required/optional/nullable に一元化されている。

#### 型ビルダー入口の語彙 b.string / b.number / b.boolean / b.date / b.array / b.tuple / b.union / b.object / b.any
- 出典: `src/core/builder/plugins/plugin-types.ts:1090-1128, src/core/builder/context/field-context.ts:410-524`
- 形: FieldBuilderContext<TObject,TPlugins,TFieldType> の9プロパティ
- 意味: TypeName ユニオンは "string"|"number"|"date"|"array"|"union"|"tuple"|"object"|"boolean"|"null"|"any" の10種だが、コンテキストに生えるのは9種（"null" は入口を持たない）。union のみ既定で型チェックを積まず、ガード未定義なら build 時に必ず失敗する validator を注入する（field-context.ts:204-213）。

#### フィールドパス構文 NestedKeyOf / TypeOfPath
- 出典: `src/types/util.ts:44-131`
- 形: "a.b.c" ドット区切り、"items[*]" 配列要素、"items[*].name" 配列要素プロパティ、"matrix[*][*]" 2次元
- 意味: 型レベルで TObject から到達可能なパスだけを許す。NestedKeyOf は深さ5固定（util.ts:44 の Depth デクリメント表）で1次元・2次元配列のみ手展開。TypeOfPath は3次元まで手展開し、加えて ".*" 記法と「ドット区切りで配列に当たったら暗黙に要素へ潜る」フォールバック（util.ts:118-125）も受け付ける。パス構文の存在は must-preserve だが、この非対称と暗黙潜行は doNotInherit。

### should-preserve (4)

#### Result<T> の公開表面
- 出典: `src/types/result.ts:86-158`
- 形: isValid(): boolean; isError(): boolean; unwrap(): T; unwrapOr(d): T; unwrapOrElse(fn): T; map(fn); flatMap(fn); tap(fn); tapError(fn); data(): T|undefined; readonly errors: ValidationError[]; readonly valid: boolean; toPlainObject()
- 意味: 検証結果は例外ではなく Result で返し、unwrap のみが LuqValidationException を投げる。この方針は保持価値がある。ただし現状は valid ゲッタと isValid() メソッド、data() と value ゲッタ、errors プロパティと errors() メソッドが重複・矛盾しており、新実装では1つに絞る必要がある。

#### ValidationOptions / ParseOptions
- 出典: `src/types/index.ts:41-53`
- 形: { abortEarly?: boolean; abortEarlyOnEachField?: boolean; messageFactory?: MessageFactory; translate?: (key, params?) => string; context?: Record<string, unknown> }
- 意味: abortEarly はフィールド間の打ち切り、abortEarlyOnEachField はフィールド内バリデータ列の打ち切り。既定はどちらも true（unified-validator.ts:115 の `options?.abortEarlyOnEachField !== false`）。この2軸の分離は意味があり保持する。

#### MessageContext / MessageFactory によるエラーメッセージ差し替え
- 出典: `src/core/plugin/types.ts:27-46, src/core/plugin/stringMin.ts:6-9`
- 形: ValidationOptions<TContext>.messageFactory?: (ctx: MessageContext & TContext) => string; MessageContext = { path: string; value: unknown; code: string }
- 意味: 各プラグインが固有の追加コンテキスト型を宣言する（例 StringMinContext = MessageContext & { min: number; actual: number }）。プラグインごとに型付きコンテキストを与える発想は良い。ただし実装は messageFactory の arity を見て3種の呼び出し規約を分岐しており（stringMin.ts:73-95）、それは引き継がない。

#### ValidationError の公開形
- 出典: `src/types/index.ts:25-30`
- 形: { path: string; message: string; code: string; paths(): string[] }
- 意味: path はドット/[*] 記法の文字列、code はプラグイン name またはプラグイン指定の code。paths() メソッドは公開型に含まれるが呼び出し実績ゼロで実装ごとに返り値が異なる（doNotInherit 参照）。新実装では { path, code, message } の3フィールドに統一するのが妥当。

### optional (2)

#### validator.pick(key)
- 出典: `src/core/builder/plugins/plugin-types.ts:1141, src/core/builder/validator-factory.ts:2641`
- 形: pick<K extends NestedKeyOf<T>>(key: K): FieldValidator<T, TypeOfPath<T, K>>
- 意味: 構築済みバリデータから単一フィールド用バリデータを切り出す。FieldValidator.validate(value, allValues?, options?) は他フィールド参照系のために allValues を第2引数で受ける。機能としては引き継ぐ価値があるが、現状は createPickValidatorFactory が4通りの経路で別々に生成され（validator-factory.ts:471,578,626,2641）、うち1経路は `pick: null as any` を後から代入して埋めている（同 615,632）。

#### FieldConfig / FieldOptions による default 値
- 出典: `src/core/builder/types/field-options.ts, src/core/builder/validator-factory.ts:490-556`
- 形: .v(path, fn, { default: value | (ctx) => value }) → applyDefault(currentValue, fieldOpts, { allValues })
- 意味: 検証・パースの前段でフィールド既定値を適用する。validate 経路では入力オブジェクトを浅くコピーしてから適用する（validator-factory.ts:506-518）。機能は保持価値があるが、適用箇所が実行経路ごとに重複実装されている。

## 振る舞い規則

- 【破綻の起点・最優先】プラグイン記述子の型でメソッド実装を保持するとき、`TMethod extends Function` のような情報ゼロの型引数で受けてはいけない（plugin-types.ts:63-76 が全崩壊の起点）。代わりに引数タプルと出力型を独立した型引数として保持する — 例: `Plugin<TName extends string, TMethod extends string, TArgs extends readonly unknown[], TIn, TOut>` とし、連鎖メソッドは `(...args: TArgs) => FieldChain<..., TOut>` で直接組み立てる。条件型で後から復元しようとするな。
- 【連鎖型】ビルダー連鎖メソッドの戻り値を決めるとき、`category` 文字列を分岐キーにした条件型（MapPluginMethodsToChainable / InferChainableReturnType、plugin-types.ts:354-640、約290行）を書いてはいけない。代わりにプラグイン記述子自身に「この呼び出し後の値型」を型として持たせ、連鎖側は `TOut` をそのまま次段へ渡すだけにする。カテゴリごとに戻り値を書き換える必要が出た時点で設計が間違っている。
- 【型とランタイムの接続】ビルダー実装を書くとき、`const builder: any = {...}` を組んで最後に `as IChainableBuilder<...>` で返してはいけない（builder.ts:25,101 / field-context.ts:180,303）。代わりに実装オブジェクトが宣言型に構造的に適合することをコンパイラに検証させる。動的にメソッドを生やす必要があるなら、生やす層を「型なしの内部レコード」に閉じ込め、その境界に1つだけ明示的な型ガード関数を置き、`as` を使うのはその関数の中だけにする。
- 【連鎖の同一性】プラグインメソッドを実装するとき、共有された validators 配列に push して `return builder`（同一オブジェクト）を返してはいけない（field-context.ts:340-359）。同じコンテキストから2本の連鎖を分岐させると両方に混入する。代わりに各メソッドは新しいイミュータブルなチェーン値（`{ rules: readonly Rule[] }` 等）を返す純粋関数にする。
- 【コンテキスト生成】フィールドコンテキストを作るとき、9種すべての型ビルダーを事前生成し、その各々に全プラグインのメソッドを代入してはいけない（field-context.ts:410-524 + attachPluginMethods）。フィールド数×プラグイン数×9 個のクロージャを build のたびに生成する。代わりに `b.string` 等はアクセス時に必要な1つだけを構築する（getter か関数呼び出し）、もしくは型ごとのメソッドテーブルをプラグイン集合ごとに1度だけ作って共有する。
- 【エラー握り潰し】プラグインの呼び出しやフィールド構築が失敗しうるとき、`try { ... } catch (e) { /* ignore */ }` で握り潰してはいけない（field-context.ts:364-366「Plugin error - ignore silently」、validator-factory.ts:112-115）。壊れたプラグインが「常に通る検証器」になり、バグが無言で本番に出る。代わりに構築時例外はそのまま呼び出し元へ投げる。ビルド時に落ちるのは正しい挙動である。
- 【フォールバック】プラグインの返り値が期待した形でないとき、`return () => false` や `return () => true` の暗黙フォールバックを返してはいけない（field-context.ts:381-390 の extractCheckFunction、392-419 の extractTransformFunction）。前者は無言で全部落ち、後者は無言で全部通る。代わりに判別可能ユニオンで返り値の形を1つに固定し、合わない場合は構築時に throw する。
- 【コア↔プラグイン境界】エラーコンテキストやメッセージを組み立てるとき、コア側で `validator.pluginName === "stringMin"` のように個別プラグイン名を分岐してはいけない（unified-validator.ts:1298-1330 で6プラグイン分を直書き）。これはプラグイン独立と tree-shaking の思想そのものを壊す。代わりにプラグインが自分の ValidatorFormat に構造化コンテキストを載せて返し、コアはそれを透過的に運ぶだけにする。コアが特定プラグインの名前を知る必要が生じたら設計が間違っている。
- 【メタ情報】バリデータに付随する特殊情報を表すとき、`__isTransform` `__isRecursive` `__isNullable` `__isStitch` `__isPreprocess` `__isOrFail` `__isFromContext` `__isDefault` `__isCoerce` `__isArrayElementField` のようなマーカー真偽プロパティを1つのオブジェクトに混載してはいけない（plugin-interfaces.ts:44-68 に10種、コア5ファイルが参照）。マーカーが増えるたびにコアの分岐が増え any が必要になる。代わりに判別可能ユニオン `type Rule = { kind: "check"; ... } | { kind: "transform"; ... } | { kind: "recurse"; ... }` にし、`kind` の網羅を switch で強制する。
- 【フィールド属性の判定】あるフィールドが optional か required かを知りたいとき、構築済みバリデータ配列を `v.name === "optional"` の文字列比較で走査してはいけない（validator-factory.ts:106,109,1852,1856）。代わりに チェーンの結果値に `isOptional: boolean` のような構造化された属性として持たせ、型でも表現する。
- 【ユーザーコードの解析】ユーザーが書いたビルダー関数から使用プラグインを知りたいとき、`builderFunction.toString()` を正規表現で走査してはいけない（strategy-factory.ts:530-541）。minify・トランスパイル・プロパティ mangling で無音で壊れる。代わりにビルダー関数を1度だけ実行し、返ってきた構造化されたチェーン値を検査する。
- 【コード生成】多次元配列など可変構造の高速ループが欲しいとき、`new Function(...)` でコードを生成してはいけない（array-type-analysis.ts:196、同309行から実際に到達する）。CSP-safe という中核思想への直接違反。代わりに再帰関数か、深さごとに手書きした固定関数を選択する。新実装では `new Function` と `eval` の使用を lint で機械的に禁止せよ。
- 【環境依存分岐】実行戦略を切り替えたいとき、`process.env.LUQ_ULTRA_FAST` や `(global as any).__LUQ_ULTRA_FAST__` を読んではいけない（validator-factory.ts:462-464）。ブラウザ素バンドルで process 未定義例外になり、バンドラも枝を落とせない。代わりに切り替えが本当に要るなら build() の options 引数として明示的に受け取る。要らないなら経路を1本にする。
- 【結果オブジェクト】ホットパスでアロケーションを減らしたいとき、モジュールレベルの可変オブジェクトを使い回して返してはいけない（ultra-fast-validator.ts:12-13 の SUCCESS_RESULT / ERROR_RESULT を全呼び出しが共有し、2回目の validate が1回目の戻り値を破壊する）。代わりに毎回新しいオブジェクトを返す。成功時にオブジェクトを避けたいなら `boolean` を返す別関数を用意する（値を共有するのではなく、値を返さない）。
- 【実行経路】性能最適化のために新しい実行経路を足したくなったとき、既存経路を残したまま分岐で新実装を追加してはいけない（validate 実行経路が createRawValidator / createUltraFastExecutorValidator / createValidatorExecutor の3系統、その下に createUltraFastValidator / createOptimizedTransformValidator / executeFastSeparated / executeDefinitionOrder の4系統、計7実装）。代わりに実行経路は1本に固定し、最適化はその1本の中で行う。ベンチマークで有意差が測れなければ足さない。
- 【閾値マジックナンバー】経路選択の条件を書くとき、`fastValidators.size <= 10` `totalValidators <= 50` `validators.length <= 10` `transforms.length <= 5` のような根拠不明の閾値を置いてはいけない（validator-factory.ts:459-469、unified-validator.ts:85-99）。フィールドを1つ足しただけで別実装に切り替わり、挙動差がバグとして現れる。代わりに分岐を持たない。
- 【戦略解析】フィールドごとに最適戦略を選ぶ設計にするなら、全フィールドに同一の解析結果を配る実装（execution-strategy-selector.ts:33-37、コメントに「TODO: Support per-field strategy analysis」）を作ってはいけない。空回りのために strategy-factory.ts 583行 + validation-engine.ts 763行が存在した。代わりに、フィールドごとの差が本当に要るまで戦略という概念自体を導入しない。
- 【ユーティリティ重複】パスアクセサやパス解析が必要になったとき、モジュールごとに自前実装を置いてはいけない（createFieldAccessor 系が field-accessor.ts / field-accessor-optimized.ts / field-utils.ts の3実装＋ validator-factory.ts:1791,1871,1897 のローカル4つ目、パス解析は計7実装）。代わりにパス解析・値取得・値設定を1モジュールに1実装だけ置き、全消費者がそれを import する。「optimized」という接尾辞の第2実装を作った時点で敗北している。
- 【型の一意性】ドメイン型（ValidationError, ValidationResult, ValidationFunction, ValidationContext）を定義するとき、モジュールごとにローカル定義を置いてはいけない（ValidationError が4定義で互いに非互換: src/types/index.ts:25 は `paths(): string[]` を要求するが builder/types/types.ts:201・validation-engine.ts:7・jsonSchema/types.ts:71 は持たない）。代わりに1ファイルに1定義を置き、他は type import で参照する。同名で形の違う型が2つできた時点で any による橋渡しが必ず発生する。
- 【Result 実装】Result 型を実装するとき、成功系と失敗系を別々の生成方法（successProto ベースの Object.create と createResult のオブジェクトリテラル）で作ってはいけない（result.ts:163-247 と 258-338）。成功系の `errors` はメソッド、失敗系の `errors` はゲッタで、宣言インターフェース `readonly errors: ValidationError[]`（148行）を成功系が満たしていない。代わりに単一の判別可能ユニオン `{ ok: true; value: T } | { ok: false; errors: readonly ValidationError[] }` を返し、ヘルパは純粋関数にする。
- 【API の重複表面】同じ情報に複数の取り出し口を作ってはいけない（Result に isValid() と valid ゲッタ、data() と value ゲッタ、errors プロパティと errors() メソッドが併存）。代わりに1つの情報に1つのアクセス方法だけを公開する。
- 【未使用 API】公開型のフィールドを設計するとき、実装コストが構築のたびに発生するのに誰も呼ばないメンバーを置いてはいけない（ValidationError.paths() は約20箇所で個別に手書き生成され、返り値も `[""]` / `[path]` / `path.split('.')` と実装ごとに違い、src/ にも test/ にも呼び出しが0件）。代わりに ValidationError は `{ path, code, message }` の3フィールドに固定する。
- 【名前空間】ユーティリティ関数群をまとめるとき、`export namespace ResultUtils { ... }`（result.ts:344-399）を使ってはいけない。namespace はオブジェクトにコンパイルされ tree-shaking を壊す。代わりに個別の名前付き export にする。
- 【グローバル可変状態】設定を持たせたいとき、モジュールレベルの可変シングルトン（global-config.ts:28 の `let currentConfig` と setGlobalConfig）を公開してはいけない。SSR・並行テスト・複数バリデータ共存で干渉する。しかも現状 src 内部の利用箇所は0件で、公開されているだけの死んだ API。代わりに設定は Builder か build() に引数として渡す。
- 【エイリアス】同じ機能に別名を与えてはいけない（`field` と `v` が完全に同一実装で片方は @deprecated: field-builder.ts:121、`strict` と `strictOnEditor` が同一: 同175、`objectRecursivelyPlugin as recursivelyPlugin` の別名再輸出: core/plugin/index.ts:70-71）。代わりに名前を1つに決める。ゼロ利用者の今しかこの決定はできない。
- 【バレル】エントリポイントを作るとき、複数のバレルで異なる部分集合を輸出してはいけない（src/index.ts / src/core/index.ts / src/core/plugin/index.ts の3本がすべて別集合。core/index.ts に至っては「ベンチマークで使うものだけ」という基準で選ばれている）。代わりに index.ts は再輸出のみとし、輸出集合は1箇所で決める。plugin ファイルが存在するのに src/index.ts から輸出されていない20件（conditionalSchema, fromContext, numberFinite, numberRange, objectRecursively, optionalIf, orFail, stitch, stitchSimple, stitch-typed, stringAlphanumeric, stringEndsWith, stringExactLength, stringStartsWith, unionGuard, message-factories, shared, shared-constants, testUtils, transform-type-restrictions）のような取りこぼしを構造的に防ぐ。
- 【メッセージ差し替え】ユーザー指定のメッセージ生成関数を呼ぶとき、`factory.length` で引数の個数を見て呼び出し規約を切り替えてはいけない（stringMin.ts:73-95 が0引数・2引数・1引数の3規約を arity で判別）。アロー関数のデフォルト引数や rest 引数で length は簡単に変わる。代わりに messageFactory のシグネチャを `(ctx: MessageContext & TExtra) => string` の1本に固定する。
- 【宣言と実装の一致】ファクトリ関数を書くとき、宣言した戻り値型と実際に返る値の形を食い違わせてはいけない（plugin-creator.ts:79-105 の `plugin()` は `TypedPlugin<..., TImpl, ...>` すなわち `create(): TImpl` と宣言するが、実際の create は pluginName を注入した `WithPluginName<TImpl>` を返す）。代わりに注入後の型をそのまま戻り値型に書く。`as unknown as` が5箇所（createImpl 内）に並んだ時点で型が嘘をついている。
- 【ループの取り違え】配列を並行に扱うコードを書くとき、別の配列の length でループしてはいけない（composable-plugin.ts:108-113 が `for (let i = 0; i < transforms.length; i++) { if (!validators[i].check(...)) }` と transforms の長さで validators を回している。transforms が空なら全検証がスキップされる）。代わりに走査対象の配列自身で回す。この種のコピペ由来のバグはレビューで拾えないので、そもそも配列の並行走査を設計に持ち込まない。
- 【ビルダー関数の実行回数】build() を実装するとき、ユーザーのビルダー関数を複数回実行してはいけない（現状 1フィールドにつき、field-builder.build の processedDefinitions で1回、validator-factory の optional/required 判定で1回、buildUnifiedValidators が slow/fast/all の3回呼ばれてそれぞれ内部で1回 + createUnifiedValidator 内でさらに1回、計5回以上）。ユーザーのビルダー関数が純粋である保証はない。代わりに1度だけ実行して結果を構造化した値として持ち回る。
- 【配列パス構文】フィールドパスの配列要素を表す構文を決めるとき、複数の記法を同時に受け付けてはいけない（現状 `items[*].name` と `items.*.name` の両方を受け、さらに `items.name` を「暗黙に要素へ潜る」と解釈する: util.ts:112-125 と nested-array-processor.ts:15-19）。曖昧さがパス解析実装を7個に増やした一因。代わりに `[*]` 1本に固定し、ドット区切りは常にオブジェクトプロパティを意味する。
- 【型レベルの配列次元】NestedKeyOf / TypeOfPath を書くとき、次元数を手で展開してはいけない（NestedKeyOf は1次元と2次元のみ、TypeOfPath は3次元まで展開していて非対称: util.ts:44-131）。代わりに再帰1本で任意次元を扱い、深さ制限は1つのデクリメント機構で表現する。手展開の結果、型が許すパスと実行時が解釈できるパスがズレる。
- 【実験コード】未完成の機能を置くとき、tsconfig の exclude で型検査から外してはいけない（`"exclude": [..., "src/core/async.experimental/**/*"]` が4ファイル約800行を検査対象外にしており、うち3ファイルは完全に未参照）。代わりに未完成なら src に入れない。入れるなら型検査を通す。
- 【エスケープハッチ】性能のための代替 API を公開インターフェースに置いてはいけない（TransformAwareValidator の `validateRaw?` / `parseRaw?` はオプショナルで、経路によって存在したりしなかったりする: plugin-types.ts:1143-1148、validator-factory.ts:566-576）。利用者は存在チェックを強いられ、実装は2系統の維持を強いられる。代わりに validate/parse の1組だけを公開する。
- 【並行 API】同じ目的に2つの入口を用意してはいけない（Builder 連鎖 API と createPluginRegistry / createFieldRule / useField の2系統が併存し、registry は 687行で内部に Builder を再構築している: plugin-registry.ts:24,119）。代わりに入口は Builder 1本にする。フィールド単位の再利用が要るなら、Builder が返す値の一部として表現する。
- 【ドキュメント】JSDoc に例を書くとき、存在しない API を書いてはいけない（field-builder.ts:124-129 と plugin-types.ts:1310-1313 の useField の例が `registry.createFieldRules()`（複数形）と `rules.string.required()` を使っているが、実 API は `createFieldRule`（単数形）でその形も返さない）。代わりに例はコンパイルされる場所（型テストか examples ディレクトリ）に置く。
- 【最適化コメント】「V8 optimization」「Hidden Class 統一」「1M+ ops/sec」といったコメントを、計測なしに書いてはいけない（src 全体に散在し、実際にはそのコメントが付いた箇所が共有可変オブジェクト事故や7重実装を生んだ）。代わりに最適化は計測結果へのリンクとともにコミットする。計測がないなら最も単純な実装を選ぶ。
- 【死んだモジュール】新しい実装を書いたら古い実装を消す。残してはいけない（未参照モジュールが13件: async-plugin-extensions.ts, async-validator-integration.ts, from-context-plugin.ts, field-type-detector.ts, array-batch-validator.ts, conditionalSchema.ts, message-factories.ts, shared.ts, stitch-typed.ts, stitchSimple.ts, __tests__/test-utils.ts, src/core/registry.ts, indexed-result.ts。さらに validation-engine.ts 763行は唯一の参照元が未参照モジュールなので実質全量が死んでいる）。代わりに、未参照モジュールと未使用 export を CI で検出して失敗させる（knip 等）。
- 【未使用 import】プラグインを新規作成するとき、テンプレートをコピーして使わない import を残してはいけない（`import { VALID_RESULT, INVALID_RESULT } from "./shared-constants"` を31ファイルが行い、少なくとも required.ts / stringMin.ts / stringPattern.ts では未使用。unused-vars 229件の主要因）。代わりに noUnusedLocals を有効にし CI で落とす。
- 【tsconfig】strict を名乗るとき、`"strict": true` の直下で個別フラグを false にしてはいけない（tsconfig.json が noImplicitAny / strictNullChecks / strictFunctionTypes / strictPropertyInitialization / noImplicitThis / noImplicitReturns の6つをすべて false にしている）。これが any 1365件を「コンパイルが通る」状態に保った土壌。代わりに個別フラグの上書きを一切書かず、最初のコミットから真の strict で始める。

## 引き継がないもの

- **TypedPlugin<TName, TMethodName, TMethod extends Function, TAllowedTypes, TPluginType, TCategory> の6型引数構造そのもの（plugin-types.ts:63-76）** — TMethod を Function に潰したことが全崩壊の起点。加えて TPluginType（"validator"|"transform"）と TCategory（11種）が意味的に重複しており、transform は両方に現れる。型引数6個のうち実際に情報を運んでいるのは TName / TMethodName / TCategory の3つだけ。新実装は引数タプル型と出力型を保持する別構造にする。
- **PluginCategory の11値（standard / conditional / transform / fieldReference / multiFieldReference / arrayElement / composable / composable-conditional / composable-directly / context / builder-extension）** — カテゴリが増えるたびに MapPluginMethodsToChainable と ApplyTypesToMethod と GetMethodCategory と PluginImplementation と CategoryMethodSignature の5箇所の条件型に分岐が増える設計になっており、これが plugin-types.ts 1482行の主因。composable / composable-conditional / composable-directly は3つとも「複数回呼んで蓄積する」同一の目的で、別カテゴリである必然性がない。arrayElement / preprocessor はカテゴリとして定義されているが plugin-creator の createImpl では preprocessor の分岐が存在せずデフォルト（standard）に落ちる不整合もある。
- **MapPluginMethodsToChainable / InferChainableReturnType / ApplyTypesToMethod / GetPluginCategoryByMethod / GetPluginMethodByName / InferMethodParameters / ExtractPluginMethodsByCategory / ExtractConditionalPluginMethods / ExtractTransformPluginMethods / ExtractFieldReferencePluginMethods / ExtractMultiFieldReferencePluginMethods / ExtractComposablePluginMethods / GetMethodCategory / IsConditionalMethod / FlattenPluginMethods / ExtractPluginMethods / FilterPluginsByType（plugin-types.ts 全体の約900行）** — すべて「TMethod を Function に潰した情報損失を復元する」ための機構。損失を起こさなければ1行も要らない。IntelliSense の応答も悪化させる。
- **ChainableFieldBuilderTransformAware / CanRefineToType / refineString・refineNumber・refineArray・refineTuple・refineUnion・refineBoolean・refineDate・refineObject・refineAny の refine 系9メソッド** — plugin-types.ts:192-259 に型が定義され field-context.ts:232-303 に実装があるが、ChainableFieldBuilderTransformAware は plugin-types.ts の外から1度も参照されていない。実装側もコメントに「needed by jsonSchema.ts」とあるだけの内部用の型変更ハッチで、公開 API としての一貫性がない。
- **TypeStateFlags / ApplyTypeState（excludeUndefined / excludeNull フラグ）** — plugin-types.ts:906-926 に定義され連鎖型を通じて引き回されているが、外部参照0件。nullable の戻り値型を作るためだけの機構であり、`TCurrentType | null` を直接扱えば不要。
- **ValidateUnionType / UnionArrayObjectError / HasArrayWithObjectElement / UnionHasArrayWithObject / ExtractArrayFromUnion / IsArrayElementObject** — plugin-types.ts:1447-1490。`_error: "❌ Union types with Array<object> are not supported..."` という絵文字入りのエラーメッセージ型を返す機構だが外部参照0件。エラーメッセージを型で表現する手法は IDE 体験を悪化させ、実装制約を型に固着させる。新実装では union × Array<object> を最初からサポートするか、サポートしないことを実行時エラーで伝える。
- **strict() / strictOnEditor() と MissingFields / DeclaredFields** — 完全同一実装のエイリアス2つ（field-builder.ts:160-181）。両方に @deprecated と WIP が同時に付いており、返り値が成功時は FieldBuilder、失敗時は `{ _error: string; _missingFields: ... }` という別型になるため .build() が生えず意味不明なエラーになる。DeclaredFields は外部参照0件。
- **ValidationError.paths(): string[]** — 公開型 src/types/index.ts:25-30 が要求するため約20箇所で手書き生成されているが（array-batch-optimizer.ts 7箇所、nested-array-processor.ts 4箇所、raw-validator.ts 4箇所、validator-factory.ts 2箇所、async-context.ts、async-validator-integration.ts ほか）、src/ にも test/ にも呼び出しが1件も存在しない。しかも実装ごとに `[""]` / `[path]` / `path.split('.')` と返り値が異なる。エラー生成のたびにクロージャを1つ余計に確保している。
- **validateRaw / parseRaw と RawValidator / UltraFastValidator（raw-validator.ts 476行、ultra-fast-validator.ts 258行）** — TransformAwareValidator のオプショナルメンバーとして公開されており、経路によって存在したりしなかったりする。ultra-fast-validator はモジュール共有の可変結果オブジェクトを返す明確なバグを含む。Result を返さない第2の返却規約を公開表面に持ち込んだこと自体が誤り。
- **execution-strategy-selector.ts / core/strategy-factory.ts / core/validation-engine.ts / optimization/array-batch-validator.ts（計1642行）** — strategy-selector は全フィールドに同一戦略を配るだけの空回り（同ファイルのコメントが自ら TODO と認めている）。strategy-factory は builderFunction.toString() 正規表現でプラグイン使用を推測する。validation-engine の唯一の参照元 array-batch-validator は完全未参照。合わせて実質全量が死んでいる。
- **src/types/array-type-analysis.ts の BuildTimeArrayAnalyzer.generateOptimizedValidator / createNestedLoopValidator / generateNestedLoopCode** — new Function によるコード生成（196行）で CSP-safe 思想への直接違反。同ファイル 309行から実際に呼ばれており、単なる死にコードではない。多次元配列は再帰で扱う。
- **src/core/global-config.ts（globalConfig / setGlobalConfig / getGlobalConfig / resetGlobalConfig / GlobalConfig）** — モジュールレベルの可変シングルトン。src 内部からの利用が0件で、公開されているだけ。messageKeyPrefix / toBooleanTruthyValues / numberFormat / dateFormat / trimStrings / caseSensitive / customTransforms という設定項目群も、実際にそれらを読むプラグインが存在しない。
- **src/core/registry/plugin-registry.ts（createPluginRegistry / PluginRegistry / FieldRule / createFieldRule / toBuilder / useField / ExtractFieldRuleType / FieldRuleDefinition）** — Builder と並行する第2の検証定義入口。687行で内部的に Builder を再構築しており、FieldRule には `_phantomType: T` と `_getInternalValidators?(): { validators: any[]; transforms: any[]; executionPlan: any }` という any 3個の内部脱出口がある（executionPlan は他所で既に廃止された概念）。入口を1本にする決定を今下すべき。
- **process.env.LUQ_ULTRA_FAST / (global as any).__LUQ_ULTRA_FAST__ による挙動切り替え（validator-factory.ts:462-464）** — ブラウザ素バンドルで process 未定義例外。隠れた挙動差でバグ再現が不可能になる。
- **src/core/async.experimental/ 全4ファイル（async-context.ts, async-plugin-extensions.ts, async-validator-integration.ts, from-context-plugin.ts、計約800行）** — tsconfig の exclude で型検査対象外。うち3ファイルは完全に未参照。async 検証を新実装で提供するかは openQuestions の判断事項であり、この実装は起点にならない。
- **src/core/registry.ts / src/types/indexed-result.ts / src/core/builder/context/field-type-detector.ts / src/core/plugin/{conditionalSchema,message-factories,shared,stitch-typed,stitchSimple}.ts / src/core/plugin/__tests__/test-utils.ts** — すべて完全未参照。stitch は stitch.ts / stitchSimple.ts / stitch-typed.ts の3実装が並存し、うち2つが死んでいる。
- **src/types/valitator.ts（ファイル名のタイプミス）とその中の Validator / FieldValidator / ValidatorStrategy** — ファイル名が誤記のまま公開型（InferType の依存元）として残っている。中の FieldValidator は plugin-types.ts の同名 FieldValidator と別定義で衝突している。ValidatorStrategy は参照0件。
- **`field` メソッド（`v` と完全同一の @deprecated エイリアス）と `recursivelyPlugin`（objectRecursivelyPlugin の別名再輸出）** — 利用者ゼロの今なら1名に統一できる。deprecated を初版から抱えて出発する理由がない。
- **successProto / createResult の二重 Result 実装と LuqValidationException の `createLuqValidationException as any as { new (...) }` 偽コンストラクタ（result.ts:36-41）** — 成功系と失敗系で errors の実体（メソッド vs ゲッタ）が異なり宣言インターフェースを成功系が満たしていない。偽コンストラクタは instanceof を機能させないまま new を許す二重 any キャスト。
- **200行超の33ファイル、とりわけ validator-factory.ts 2882行 / plugin-types.ts 1482行 / unified-validator.ts 1366行 / types/types.ts 797行 / error-generation.ts 789行 / validation-engine.ts 763行 / nested-array-processor.ts 711行 / plugin-registry.ts 687行 / dsl-converter.ts 602行 / plugin-interfaces.ts 597行 / strategy-factory.ts 583行** — 新規約は1ファイル200行以内。これらは分割対象ではなく破棄対象。分割してもカテゴリ分岐と多重実行経路という構造がそのまま持ち込まれる。

## 公開シンボル (67)

`Builder`, `IChainableBuilder`, `ChainableBuilder`, `FieldBuilder`, `FieldBuilderContext`, `ChainableFieldBuilder`, `TransformAwareValidator`, `ApplyFieldTransforms`, `ExtractFieldType`, `FieldValidator`, `ValidationResult`, `ValidationError`, `ValidationOptions`, `ParseOptions`, `MessageContext`, `MessageFactory`, `SEVERITY`, `Result`, `LuqValidationException`, `ResultUtils`, `TypedPlugin`, `PluginType`, `PluginCategory`, `TypeName`, `TypeMapping`, `ValidatorFormat`, `PluginImplementation`, `StandardPluginImplementation`, `ConditionalPluginImplementation`, `TransformPluginImplementation`, `FieldReferencePluginImplementation`, `ArrayElementPluginImplementation`, `MultiFieldReferencePluginImplementation`, `ContextPluginImplementation`, `PreprocessorPluginImplementation`, `StandardValidationMethod`, `ConditionalValidationMethod`, `FieldReferenceValidationMethod`, `MultiFieldReferenceValidationMethod`, `TransformValidationMethod`, `ArrayElementValidationMethod`, `ContextValidationMethod`, `PluginValidationResult`, `plugin`, `pluginPredefinedTransform`, `pluginConfigurableTransform`, `pluginBuilderExtension`, `BuilderExtensionPlugin`, `BuilderExtensionMethod`, `ComposablePlugin`, `createValidatorResult`, `createPluginRegistry`, `PluginRegistry`, `FieldRule`, `ExtractFieldRuleType`, `FieldRuleDefinition`, `GlobalConfig`, `globalConfig`, `setGlobalConfig`, `getGlobalConfig`, `resetGlobalConfig`, `NestedKeyOf`, `TypeOfPath`, `ElementType`, `InferType`, `PluginMapFromArray`, `BuilderExtensions`

