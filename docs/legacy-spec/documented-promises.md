# documented-promises

読んだファイル: C:\projects\luq\README.md（214行・全読）, C:\projects\luq\docs-site\src\ 配下の全 .astro / .ts / .json（pages 13枚, components 16枚, data 3ファイル）, C:\projects\luq\docs\generated\plugins.md（2269行）, および裏取り用に C:\projects\luq\package.json の exports マップと C:\projects\luq\src\index.ts / src\types\result.ts / src\core\registry\plugin-registry.ts / src\core\plugin\*.ts の methodName 定義。

【ドキュメントが約束している中核】
1. ビルダー連鎖: Builder().use(plugin...).for<T>().v(path, b => chain, options?).useField(path, rule).strict().build()。Builder() は関数（new 不要）。use() は可変長引数も受ける。use() は for() より前。重複 use は無視。順序は（多くのプラグインで）不問。
2. build() が返す Validator: validate(value, options?) / parse(value, options?) / pick(fieldName)。validate は変換を適用せず元値、parse は transform 適用後の値を返す（全ページで繰り返し明記される最重要の意味論的区別）。
3. Result<T>: isValid() / isError() / unwrap() / unwrapOr(d) / unwrapOrElse(fn) / map(fn) / flatMap(fn) / tap(fn) / tapError(fn) / data() / errors / toPlainObject() / valid（後方互換プロパティ）/ value。unwrap() は失敗時 LuqValidationException を throw（e.name === 'LuqValidationException', e.errors）。toPlainObject() は { valid, data?, errors }。
4. ValidationError: { path: string; message: string; code: string }（core-concepts のみ value も列挙）。path は 'user.email' 形式のドット記法。
5. フィールドパス構文: fieldName / nested.field.path / array[*] / nested.array[*].field / data[*][*]（多次元）。「特定インデックス items[0].name は不可、[*] のみ」がトラブルシューティングで明示的に約束されている。
6. ValidationOptions: { abortEarly?: boolean（既定 false）; context?: unknown }。
7. FieldOptions（v() の第3引数）: { default?: T | (() => T); applyDefaultToNull?: boolean（既定 true）; description?: string; deprecated?: boolean | string; metadata?: Record<string, unknown> }。第3引数に生値を渡す既定値ショートハンドあり（.v('language', b => b.string.optional(), 'en')）。
8. strict(): 実行時効果ゼロのコンパイル時全フィールド網羅チェック。未定義フィールドがあると build() を持たない型を返す。チェーン途中でも呼べ、通過後もチェーン継続可。strictOnEditor() は strict() の別名。「strict() は余剰プロパティを実行時に弾かない、それには objectAdditionalProperties(false) を使う」が明示的な約束。
9. Plugin Registry: createPluginRegistry().use(plugin).for<T>().createFieldRule(builderFn, { name, description?, fieldOptions? }) / toBuilder() / getPlugins()。FieldRule は validate(value, options?) / parse(value, options?) / getPluginRegistry()。builder.useField(path, rule) で合成。ドキュメント自身が「Builder があるなら pick() を使え、Registry は不要」と推奨を下げている。
10. カスタムプラグイン: plugin({ name, methodName, allowedTypes, category, impl }) と pluginPredefinedTransform / pluginConfigurableTransform。カテゴリが ChainableFieldBuilder の型変数を制御するという設計思想（standard / fieldReference / transform / conditional / multiFieldReference / context）。
11. JSON Schema Draft-07: jsonSchemaFullFeaturePlugin または jsonSchemaPlugin + 個別プラグインを use し、.fromJsonSchema(schema).build()。実行時に API/CMS から取得したスキーマを読める（動的検証）。
12. 性能・サイズ主張（README と benchmarks ページ、2025-08-14 計測・AMD Ryzen 7 5825U / Node v22.12.0 / 100万回）: バンドル 19.10KB(simple)〜22.48KB(complex) gzipped、JsonSchema 版 26.06/29.08KB、JsonSchema Full 版 31.75/32.31KB。速度 simple 694,692 ops/sec（README は「1.2M ops/sec」と食い違う）、complex 35,946 ops/sec（README は 43K と食い違う）。CSP-safe（eval / new Function 不使用）は全ページで無条件の約束。tree-shaking はプラグイン単位。
13. 環境要件: Node.js 14+, TypeScript 4.1+, target ES2015 以上、strict/strictNullChecks 推奨。ライセンス MIT。

【重大な発見：ドキュメントが約束しているのに実体がないもの】
- result.getErrors() / result.getErrorMessages() / result.getFieldErrors() は src に一切存在しない（grep ヒット 0）。getting-started と core-concepts と troubleshooting のコード例が全滅している。
- validator.validateWithContext(data, context) は存在しない（custom-plugins ページの context カテゴリ例）。
- registry.register(plugin) は存在しない（builder.astro の useField 例）。実体は use(plugin)。
- equalsPlugin / .equals(true) はカタログにも src にも無い（builder.astro と examples.astro の acceptTerms 例）。
- conditionalPlugin は存在しない（plugin-registry の完全例）。
- README のクイックスタートは validateUser(data) と result.issues を使うが、実体は validator.validate(data) と result.errors。README の最初の 30 行が動かない。
- サブパス ./core, ./core/registry, ./plugin, ./plugins, ./async.experimental, ./core/builder/plugins/plugin-creator は package.json の exports に一つも無い。docs の import 文の大半が解決しない。./plugins/numberRange も無い。
- core-concepts だけ items.*.id（ドット星）記法を使い、他の全ページは items[*].id を使う。
- カスタムエラーメッセージのキー名が messageFactory（README, plugins.json 59箇所）と issueFactory（docs/generated/plugins.md 72箇所）で二重化している。さらに .pattern(/re/, '文字列') や .compareField('password', '文字列') のように第2引数に生文字列を渡す例もある。三通り。
- docs/generated/plugins.md の目次にある stringEquals / selfRecursively / recursivelyWithContext は docs-site のカタログにも src/core/plugin/ にも無い。
- docs-site/src/data/plugins.json の methodName フィールドは JSDoc 生成器のバグで、stringEmail / stringUrl / stringDatetime / stringBase64 / stringHostname / stringIpv4 / stringIpv6 / stringIri / stringJsonPointer / stringContentMediaType / stringDatetime を実メソッド名として記録している。src の実定義は .email() / .url() / .datetime() / .base64() / .hostname() / .ipv4() / .ipv6() / .iri() / .jsonPointer() / .contentMediaType()。人間が書いた README・docs ページは全て後者を使っている。後者が正。readOnlyWriteOnlyPlugin の実メソッド名は .readOnly()。
- docs-site の DocsSidebar は /generator へリンクするが、そのページは docs-site/src/pages に存在しない（実際のカタログは /plugins）。

【公開プラグイン全 69 件（docs-site カタログ = /plugins ページの母集合）】
export 名 :: 実メソッド :: 対応型
arrayContainsPlugin :: .contains() :: array
arrayIncludesPlugin :: .includes() :: array
arrayMaxLengthPlugin :: .maxLength() :: array
arrayMinLengthPlugin :: .minLength() :: array
arrayUniquePlugin :: .unique() :: array
booleanFalsyPlugin :: .falsy() :: boolean
booleanTruthyPlugin :: .truthy() :: boolean
compareFieldPlugin :: .compareField() :: string,number,boolean,date,object,array,null,undefined
conditionalSchemaPlugin :: .conditionalSchema() :: object
customPlugin :: .custom() :: string,number,boolean,date,array,object,tuple,union
fromContextPlugin :: .fromContext() :: string,number,boolean,object,array,date,union,tuple
jsonSchemaFullFeaturePlugin :: .fromJsonSchema()（builder-extension） :: 全型
literalPlugin :: .literal() :: string,number,boolean,null
nullablePlugin :: .nullable() :: string,number,boolean,array,object,date,union
numberFinitePlugin :: .finite() :: number
numberIntegerPlugin :: .integer() :: number
numberMaxPlugin :: .max() :: number
numberMinPlugin :: .min() :: number
numberMultipleOfPlugin :: .multipleOf() :: number
numberNegativePlugin :: .negative() :: number
numberPositivePlugin :: .positive() :: number
numberRangePlugin :: .range() :: number
objectPlugin :: .object() :: object
objectAdditionalPropertiesPlugin :: .additionalProperties() :: object
objectDependentRequiredPlugin :: .dependentRequired() :: object
objectDependentSchemasPlugin :: .dependentSchemas() :: object
objectMaxPropertiesPlugin :: .maxProperties() :: object
objectMinPropertiesPlugin :: .minProperties() :: object
objectPatternPropertiesPlugin :: .patternProperties() :: object
objectPropertyNamesPlugin :: .propertyNames() :: object
objectRecursivelyPlugin :: .recursively() :: object
oneOfPlugin :: .oneOf() :: string,number,boolean
optionalPlugin :: .optional() :: string,number,boolean,array,object,date,union
optionalIfPlugin :: .optionalIf() :: string,number,boolean,array,object,date,union
orFailPlugin :: .orFail() :: string,number,boolean,array,object,date,union,tuple
readOnlyWriteOnlyPlugin :: .readOnly() :: string,number,boolean,date,array,object
requiredPlugin :: .required() :: string,number,boolean,date,array,object,tuple,union
requiredIfPlugin :: .requiredIf() :: string,number,boolean,array,object,date,union
skipPlugin :: .skip() :: string,number,boolean,array,object,date,union
stitchPlugin :: .stitch() :: string,number,boolean,date,object,array,tuple,union
stringAlphanumericPlugin :: .alphanumeric() :: string
stringBase64Plugin :: .base64() :: string
stringContentEncodingPlugin :: .contentEncoding() :: string
stringContentMediaTypePlugin :: .contentMediaType() :: string
stringDatePlugin :: .date() :: string
stringDatetimePlugin :: .datetime() :: string
stringDurationPlugin :: .duration() :: string
stringEmailPlugin :: .email() :: string
stringEndsWithPlugin :: .endsWith() :: string
stringExactLengthPlugin :: .exactLength() :: string
stringHostnamePlugin :: .hostname() :: string
stringIpv4Plugin :: .ipv4() :: string
stringIpv6Plugin :: .ipv6() :: string
stringIriPlugin :: .iri() :: string
stringIriReferencePlugin :: .iriReference() :: string
stringJsonPointerPlugin :: .jsonPointer() :: string
stringMaxPlugin :: .max() :: string
stringMinPlugin :: .min() :: string
stringPatternPlugin :: .pattern() :: string
stringRelativeJsonPointerPlugin :: .relativeJsonPointer() :: string
stringStartsWithPlugin :: .startsWith() :: string
stringTimePlugin :: .time() :: string
stringUriTemplatePlugin :: .uriTemplate() :: string
stringUrlPlugin :: .url() :: string
transformPlugin :: .transform() :: string,number,boolean,array,object,date,union
tupleBuilderPlugin :: .tupleBuilder() :: tuple
unionGuardPlugin :: .unionGuard() :: union
uuidPlugin :: .uuid() :: string
validateIfPlugin :: .validateIf() :: string,number,boolean,array,object,date,union
（加えて json-schema ページのみが約束する 70件目: jsonSchemaPlugin :: .fromJsonSchema()）
README は「40+ built-in plugins」と書いているが実数は 69〜70。

【JSON Schema 対応キーワード全件（docs-site/src/pages/json-schema.astro のマッピング表・全 12 カテゴリ 52 行）】
Core Types: type:"string"(組込) / type:"number"(組込) / type:"integer"(numberIntegerPlugin) / type:"boolean"(組込) / type:"null"(nullablePlugin) / type:"array"(組込) / type:"object"(組込)
String Constraints: minLength(stringMinPlugin) / maxLength(stringMaxPlugin) / pattern(stringPatternPlugin)
String Formats: email(stringEmailPlugin) / url|uri(stringUrlPlugin) / uuid(uuidPlugin) / ipv4(stringIpv4Plugin) / ipv6(stringIpv6Plugin) / hostname(stringHostnamePlugin) / date-time(stringDatetimePlugin, タイムゾーン対応) / date(stringDatePlugin, YYYY-MM-DD) / time(stringTimePlugin, HH:MM:SS) / duration(stringDurationPlugin, ISO 8601) / json-pointer(stringJsonPointerPlugin, RFC 6901) / relative-json-pointer(stringRelativeJsonPointerPlugin) / iri(stringIriPlugin, RFC 3987) / iri-reference(stringIriReferencePlugin) / uri-template(stringUriTemplatePlugin, RFC 6570)
Number Constraints: minimum(numberMinPlugin) / maximum(numberMaxPlugin) / exclusiveMinimum(numberMinPlugin) / exclusiveMaximum(numberMaxPlugin) / multipleOf(numberMultipleOfPlugin)
Array Constraints: minItems(arrayMinLengthPlugin) / maxItems(arrayMaxLengthPlugin) / uniqueItems(arrayUniquePlugin) / contains(arrayContainsPlugin) / items(タプル)(tupleBuilderPlugin)
Object Constraints: minProperties(objectMinPropertiesPlugin) / maxProperties(objectMaxPropertiesPlugin) / required(requiredPlugin) / additionalProperties(objectAdditionalPropertiesPlugin) / properties(組込) / patternProperties(objectPatternPropertiesPlugin) / propertyNames(objectPropertyNamesPlugin) / dependentRequired(objectDependentRequiredPlugin) / dependentSchemas(objectDependentSchemasPlugin)
Value Constraints: enum(oneOfPlugin) / const(literalPlugin)
Schema Composition: allOf(customPlugin) / anyOf(customPlugin) / oneOf(oneOfPlugin + customPlugin) / not(customPlugin)
Conditional Validation: if/then/else(requiredIfPlugin + customPlugin)
References: $ref(組込 jsonSchemaPlugin) / definitions・$defs(組込 jsonSchemaPlugin)
Content Validation: contentEncoding(stringContentEncodingPlugin) / contentMediaType(stringContentMediaTypePlugin)
Access Control: readOnly(readOnlyWriteOnlyPlugin) / writeOnly(readOnlyWriteOnlyPlugin)
注: dependentRequired / dependentSchemas は Draft 2019-09 のキーワードであり Draft-07 ではない（Draft-07 は dependencies）。「100% JSON Schema compatible」を名乗るなら dependencies も要る。

【docs-site のページ構成（＝公開された機能の目次）】
トップナビ: /docs/getting-started, /plugins, /benchmarks, /json-schema, /roadmap。
docs サイドバー: Getting Started(Introduction=/docs/getting-started, Core Concepts, Examples & Patterns) / Guides(Custom Plugins, Troubleshooting) / API Reference(Builder API, Validator API, Plugin Registry) / Plugins(Builder Generator=/generator ※存在しない) / Tools(同上) / Future(Roadmap)。
/plugins は静的カタログではなく「プラグインを選ぶと Builder コードを生成してコピーできる」インタラクティブ生成器で、型フィルタ（string / number / boolean / array / object / date）と検索を持つ。生成コードは import { Builder } from '@maroonedog/luq'; import { xxxPlugin } from '@maroonedog/luq'; の形（ルート一括 import）で、他ページの「サブパス個別 import が必須」という指導と矛盾する。

## 引き継ぐ契約 (22件)

### must-preserve (15)

#### Builder
- 出典: `C:\projects\luq\README.md（20-47行）, C:\projects\luq\docs-site\src\pages\docs\api\builder.astro（29-56, 468-497行）`
- 形: Builder(): ChainableBuilder — use(...plugins) → for<T>() → v(path, fn, options?) / useField(path, rule) → strict() → build()
- 意味: ファクトリ関数。new 不要。use() は for() より前に呼ぶ。可変長引数の use(a,b,c) と連鎖 .use(a).use(b) の両方を受ける。同一プラグインの重複 use は無視。use されていないプラグインのメソッドは型に現れない（コンパイルエラー）。

#### for<T>()
- 出典: `C:\projects\luq\docs-site\src\pages\docs\api\builder.astro（57-71行）, docs\core-concepts.astro`
- 形: for<TObject extends object>(): FieldBuilder<TObject>
- 意味: 既存の TypeScript 型をそのまま検証対象に指定する。スキーマ再定義を強要しないという思想の中核。以降の v() のパス引数と b の型がこれで決まる。

#### v(path, builderFn, options?)
- 出典: `C:\projects\luq\docs-site\src\pages\docs\api\builder.astro（73-124行）`
- 形: v(path: NestedKeyOf<T> & string, fn: (b: FieldBuilder) => Chain, options?: FieldOptions<V> | V): FieldBuilder<T>
- 意味: フィールド検証を定義。第2引数の b は b.string / b.number / b.boolean / b.array / b.object / b.date の型別入口を持ち、そこから use 済みプラグインのメソッドだけが連鎖できる。第3引数は FieldOptions か既定値そのもののショートハンド。

#### フィールドパス構文
- 出典: `C:\projects\luq\docs-site\src\pages\docs\troubleshooting.astro（63-186行）, docs\api\builder.astro（Field Path Syntax ボックス）`
- 形: 'name' | 'a.b.c' | 'tags[*]' | 'items[*].name' | 'items[*].attributes.color' | 'data[*][*]' | 'customer.addresses[*].city'
- 意味: ドット記法でネスト、[*] で配列全要素。[*] は多次元に連鎖可。特定インデックス（items[0].name, tags[0], data[0][0]）は明示的にサポートしないと宣言されている。プリミティブ配列も 'tags[*]' で各要素を検証する。

#### build()
- 出典: `C:\projects\luq\docs-site\src\pages\docs\api\builder.astro（226-247行）, docs\examples.astro`
- 形: build(): Validator<T>
- 意味: バリデータを確定。生成コストは高い前提で「一度作って使い回せ」と 3 ページで指導している（examples の Performance Patterns, troubleshooting のメモリリーク項）。

#### validator.validate(value, options?)
- 出典: `C:\projects\luq\docs-site\src\pages\docs\api\validator.astro（52-71行, API 表）`
- 形: validate(value: unknown, options?: ValidationOptions): Result<T>
- 意味: 検証のみ。transform は適用せず元の値を返す。

#### validator.parse(value, options?)
- 出典: `C:\projects\luq\docs-site\src\pages\docs\api\validator.astro（73-93行）, docs\api\builder.astro（typeInferenceExample）, docs\custom-plugins.astro, docs\examples.astro`
- 形: parse(value: unknown, options?: ParseOptions): Result<TTransformed>
- 意味: 検証し transform を適用した値を返す。型レベルでも変換後の型を返すことが約束されている（string→number, string→string[]）。validate と parse の差は 5 ページで繰り返し強調されており、この非対称性そのものが引き継ぐべき意味論。

#### validator.pick(fieldPath)
- 出典: `C:\projects\luq\docs-site\src\pages\docs\api\validator.astro（180-219行, FieldValidator 表）`
- 形: pick(path: NestedKeyOf<T> & string): FieldValidator<T, TypeOfPath<T, path>>; FieldValidator.validate(value, allValues?: Partial<T>, options?)
- 意味: 構築済みバリデータから単一フィールドのバリデータを切り出す。ネストパス可。第2引数に他フィールドの値を文脈として渡せる。フォームのリアルタイム単項目検証の推奨手段で、ドキュメントは Plugin Registry より pick を優先せよと明言している。

#### Result<T>
- 出典: `C:\projects\luq\docs-site\src\pages\docs\api\validator.astro（95-172行, Result Methods 表）`
- 形: isValid(): boolean; isError(): boolean; unwrap(): T; unwrapOr(d: T): T; unwrapOrElse(fn: (e: ValidationError[]) => T): T; map(fn): Result<U>; flatMap(fn): Result<U>; tap(fn): Result<T>; tapError(fn): Result<T>; data(): T | undefined; errors: ValidationError[]; toPlainObject(): { valid: boolean; data?: T; errors: ValidationError[] }; valid: boolean; value: T
- 意味: 関数型 Result。unwrap() は失敗時に LuqValidationException を throw（e.name で判別、e.errors を持つ）。valid は後方互換用プロパティとして文書化。errors はプロパティとして文書化されている（現行 src は errors をプロパティ宣言とメソッド実装の両方で持つ矛盾状態）。

#### ValidationError
- 出典: `C:\projects\luq\docs-site\src\pages\docs\api\validator.astro（117-121行）, docs\getting-started.astro, docs\examples.astro`
- 形: { path: string; message: string; code: string }
- 意味: path はドット記法の絶対パス（'user.email'）。code はプラグイン由来の識別子（'required', 'stringEmail', 'min_length', 'invalid_email' が例として出る — 命名規則がドキュメント内で不統一）。API レスポンスにそのまま詰める例が載っている。

#### ValidationOptions
- 出典: `C:\projects\luq\docs-site\src\pages\docs\api\validator.astro（221-238行）`
- 形: { abortEarly?: boolean; context?: unknown }
- 意味: abortEarly の既定は false（全エラー収集）。context は全フィールドバリデータに伝播し、context カテゴリのプラグインから読める。

#### fromJsonSchema(schema)
- 出典: `C:\projects\luq\README.md（72-107行）, C:\projects\luq\docs-site\src\pages\json-schema.astro（Quick Setup 2枚）`
- 形: Builder().use(jsonSchemaFullFeaturePlugin).fromJsonSchema(schema).build() / Builder().use(jsonSchemaPlugin).use(...個別プラグイン).fromJsonSchema(schema).build()
- 意味: builder-extension プラグインが Builder 自身にメソッドを生やす（for<T>() を経由しない）。実行時に取得した任意のスキーマオブジェクトを受ける。fullFeature 版は全キーワードを内包、jsonSchemaPlugin 版は使うキーワードに対応するプラグインだけ use して tree-shaking する。この二段構えがバンドルサイズ差（31.75KB vs 26.06KB）として公表されている。

#### plugin()
- 出典: `C:\projects\luq\docs-site\src\pages\docs\custom-plugins.astro（26-119, 275-320行）, C:\projects\luq\README.md（109-139行）`
- 形: plugin({ name: string; methodName: string; allowedTypes: readonly TypeName[]; category: 'standard'|'fieldReference'|'transform'|'conditional'|'multiFieldReference'|'context'; impl: (...args) => { check(value, allValues?, context?): boolean | { valid: boolean; ... }; code: string; getErrorMessage?(value, path): string; params?: unknown[] } })
- 意味: 利用者が独自の業務ルールを型安全なチェーンメソッドとして足す唯一の口。category が ChainableFieldBuilder に渡る型変数を決めるという設計思想がページ全体の主題。transform は check が { valid, transformedValue } を返して以降の型を変える。conditional は { valid: true, __skipAllValidation: true } で残りをスキップできる。

#### サブパス個別 import によるプラグイン単位 tree-shaking
- 出典: `C:\projects\luq\docs-site\src\pages\docs\getting-started.astro（174-180行）, docs\troubleshooting.astro（24-29行）, C:\projects\luq\package.json（exports）`
- 形: import { requiredPlugin } from '@maroonedog/luq/plugins/required'; import { stringEmailPlugin } from '@maroonedog/luq/plugins/stringEmail';
- 意味: 「バレル / ワイルドカード import は避けよ、import * as plugins from '@maroonedog/luq/plugins' はもはやサポートしない」と getting-started と troubleshooting の両方で明言。ESM 前提。package.json exports にプラグインごとの types/import/require 3面エントリを持つのが現行形。

#### CSP-safe
- 出典: `C:\projects\luq\README.md（66, 183行）, C:\projects\luq\docs-site\src\pages\benchmarks.astro（Key Insights, CSP バッジ列）`
- 形: eval / new Function を一切使わない
- 意味: AJV との差別化として README・benchmarks・トップページの全てで無条件に主張されている。動的スキーマ読み込み（fetch した JSON Schema をそのまま fromJsonSchema）と両立することが売り。破ると存在理由が消える。

### should-preserve (5)

#### FieldOptions
- 出典: `C:\projects\luq\docs-site\src\pages\docs\api\builder.astro（88-124行）`
- 形: { default?: T | (() => T); applyDefaultToNull?: boolean; description?: string; deprecated?: boolean | string; metadata?: Record<string, unknown> }
- 意味: default は関数も可（遅延既定値）。applyDefaultToNull の既定は true（null にも既定値を適用）。deprecated は文字列で理由を書ける。metadata は任意の付随情報。第3引数に生値を渡すと default のショートハンドになる。

#### strict() / strictOnEditor()
- 出典: `C:\projects\luq\docs-site\src\pages\docs\api\builder.astro（159-224行, Strict Mode Behavior ボックス）`
- 形: strict(): FieldBuilder<T> | { /* build() を持たないエラー型 */ }
- 意味: 型レベルのみの全フィールド網羅チェック。実行時効果は無い。未定義フィールドが残っていると build() を持たない型を返してコンパイルを止める。チェーンのどこでも呼べ、通過後もさらに v() を足せる。strictOnEditor は別名。余剰プロパティの実行時拒否は objectAdditionalProperties(false, { allowedProperties: [...] }) の仕事だと明記されている。

#### pluginPredefinedTransform() / pluginConfigurableTransform()
- 出典: `C:\projects\luq\docs-site\src\pages\docs\custom-plugins.astro（157-273行）`
- 形: pluginPredefinedTransform({ name, allowedTypes, impl: () => (value, ctx) => ({ valid: true, __isTransform: true, __transformFn: (v) => U }) }); pluginConfigurableTransform({ name, allowedTypes, impl: (...config) => (value, ctx) => ({ ...同上 }) })
- 意味: 引数なし固定変換と、設定引数つき変換の作成口。ドキュメントは transform プラグインの作り方を 3 通り（plugin / predefined / configurable）と明言している。

#### 非同期検証レイヤ（experimental）
- 出典: `C:\projects\luq\docs-site\src\pages\docs\troubleshooting.astro（308-406行, Luq's Async Architecture ボックス）`
- 形: import { createAsyncContext, addAsyncSupport } from '@maroonedog/luq/async.experimental'; addAsyncSupport(syncValidator); await createAsyncContext<C>().set(key, promise).build(); await validator.withAsyncContext<C>(ctx).validate(data); getAsyncContext<C>(context)
- 意味: 「検証本体は同期のまま、非同期は前段で並列に解決して文脈として渡す」という明確な設計思想。await は全工程で一度だけ、非同期を使わないときのオーバーヘッドはゼロ、と約束している。experimental を名前に含む別エントリポイント。

#### 環境要件
- 出典: `C:\projects\luq\docs-site\src\pages\docs\getting-started.astro（12-18, 219-224行）`
- 形: Node.js 14.0+, TypeScript 4.1+, target ES2015+, strict/strictNullChecks 推奨, esModuleInterop, moduleResolution node
- 意味: getting-started の Prerequisites と tsconfig 例として公開済み。TS 4.1 はテンプレートリテラル型の導入版で、パス型（NestedKeyOf）の下限を規定している。

### optional (2)

#### createPluginRegistry()
- 出典: `C:\projects\luq\docs-site\src\pages\docs\api\plugin-registry.astro（29-55, 826-870行）`
- 形: createPluginRegistry(): PluginRegistry; .use(plugin): PluginRegistry; .for<T>(): TypedPluginRegistry<T>; .createFieldRule<V>(fn, { name, description?, fieldOptions? }): FieldRule<V>; .toBuilder(): ChainableBuilder; .getPlugins(): Record<string, Plugin>
- 意味: 再利用可能な単一フィールドルールを作り、チーム横断で共有・単体テストするための仕組み。for<T>() 後は name が T の有効パスに型制約され、型も自動推論される。ドキュメント自身が「Builder があるなら pick() を使え」と優先度を下げている。

#### FieldRule / useField()
- 出典: `C:\projects\luq\docs-site\src\pages\docs\api\plugin-registry.astro（166-200, 872-900行）, docs\api\builder.astro（126-160行）`
- 形: FieldRule<V>.validate(value, options?): Result<V>; .parse(value, options?): Result<V>; .getPluginRegistry(): PluginRegistry / builder.useField(path, rule): FieldBuilder<T>
- 意味: ルール単体で検証でき、useField で Builder に差し込むと fieldOptions（既定値・metadata）も一緒に適用される。useField と v() は同じチェーンで混在できる。tags[*] のような配列要素パスにも使える。

## 振る舞い規則

- Builder() は関数呼び出しで生成する。new Builder() ではない。use() は for() より前でなければならず、use していないプラグインのメソッドは型に一切現れない（実行時エラーではなくコンパイルエラーで落ちる）。この「使ったプラグインの分だけ型が生える」性質が tree-shaking の型レベルの裏返しであり、ライブラリの正体。
- use されたプラグインは一度だけ有効になり、重複 use は無視される。use の順序は結果に影響しない（ドキュメントは『ほとんどのプラグインで』と限定しているが、順序依存を新設計に持ち込むべきではない）。
- validate() は transform を適用しない。parse() は適用する。両者は同じ Result<T> 型を返すが、parse の T は変換後の型でなければならない（string→number, string→string[] が型として推論されることが 4 ページで実例つきで約束されている）。この非対称性を崩すと全ドキュメントが嘘になる。
- フィールドパスは静的文字列で、対象型 T から導出された有効パスの合併型に型制約される。無効なパスはコンパイルエラー。配列は [*] のみで、[0] のような具体インデックスはサポートしない。[*] は多次元に連鎖する（data[*][*]）。プリミティブ配列も 'tags[*]' で各要素を検証する。
- 検証は完全に同期。非同期は「前段で並列解決して文脈として渡す」別レイヤ（async.experimental）でのみ扱い、コア API に Promise を混ぜない。非同期を使わない場合のオーバーヘッドはゼロ。
- eval / new Function / Function コンストラクタ / 動的コード生成を一切使わない。CSP 制限環境で動くことが AJV に対する唯一の差別化であり、性能のために破ってはならない。
- バリデータの構築コスト（build()）は検証コストより高い前提で設計する。ドキュメントは 3 箇所で「モジュールスコープで一度作って使い回せ、リクエストハンドラ内で作るな」と指導しており、この性能特性は公開された約束。
- 各プラグインは独立モジュールで、副作用を持たず、静的に到達可能で、サブパス（@maroonedog/luq/plugins/<name>）から個別 import できなければならない。バレル import（import * as plugins）は明示的に非サポートと宣言済み。
- JSON Schema 対応は二段構え。jsonSchemaFullFeaturePlugin は全キーワードを内包する 1 プラグイン（利便性優先・バンドル大）、jsonSchemaPlugin + 個別プラグインは使うキーワード分だけ入る（サイズ優先）。この選択肢の存在自体が公表済みのバンドルサイズ表（31.75KB vs 26.06KB）の根拠。
- カスタムプラグインの category は単なる分類ラベルではなく、チェーンビルダーに渡る型変数と生えるメソッドのシグネチャを決める。standard は素の引数、fieldReference は第1引数が T の有効パス、conditional は (allValues: T) => boolean、transform は <U>(fn: (v: TCurrent) => U) で以降の型を U に付け替える、multiFieldReference は readonly パス配列、context は文脈引数。この対応表がカスタムプラグイン API の骨格。
- エラーは { path, message, code } の平坦な配列。path は 'items[0].name' のような実インデックス入り絶対パスとして利用者に見える必要がある（[*] は定義側の記法であって報告側の記法ではない）。
- strict() は実行時に何もしない。余剰プロパティの実行時拒否は objectAdditionalProperties(false) の役割。この分離はドキュメントが『よくある誤解』として警告つきで明示している。
- 既存の TypeScript 型を書き換えさせない。スキーマから型を導出する（z.infer 方式）のではなく、既に手元にある interface / type を for<T>() に渡すだけで済むこと。これがトップページ・README・core-concepts の全てで対抗軸として掲げられている一番の思想。

## 引き継がないもの

- **Result の重複した二系統アクセサ（isValid() と valid、data() と value、errors プロパティと errors() メソッド、unwrap/unwrapOr/unwrapOrElse/map/flatMap/tap/tapError/onSuccessPostProcess/toPlainObject の全部盛り）** — src/types/result.ts では errors がインターフェース上はプロパティ（148行）なのに実装はメソッド（210行）という矛盾状態にあり、ドキュメントも result.errors と result.getErrors() を混用している。valid は『backward compatibility』とドキュメント自身が書いているが、まだ誰も使っていないライブラリに後方互換は存在しない。新実装は判別可能ユニオン（{ valid: true; value: T } | { valid: false; issues: ValidationIssue[] }）1 系統に決め打ちし、関数型ヘルパは必要最小限に絞るべき。
- **result.getErrors() / getErrorMessages() / getFieldErrors() / validator.validateWithContext()** — src に一切存在しない（grep ヒット 0）。旧世代モデルが書いたドキュメント上の幻。継承する対象ではなく、削除すべき記述。
- **registry.register(plugin) と conditionalPlugin と equalsPlugin / .equals(true)** — いずれも実体がない。register は use の誤記、conditionalPlugin と equals はドキュメント著者の創作。特に .equals(true) は builder.astro と examples.astro の 2 箇所で『利用規約の同意チェック』という頻出ユースケースに使われているので、新実装では booleanTruthy か literal のどちらでそれを満たすかを決めて例を書き直す必要がある。
- **README クイックスタートの API 形（validateUser(data) を直接呼ぶ／result.issues）** — README の冒頭 30 行が実装と食い違っている。「build() が呼び出し可能な関数を返す」という形自体は魅力的だが、docs-site 全 13 ページが validator.validate(...) 前提で書かれているので、どちらか一方に統一する決断が要る（openQuestions 参照）。現状の二重仕様は継承してはいけない。
- **messageFactory / issueFactory / 第2引数の生文字列という 3 通りのエラーメッセージ指定** — messageFactory 59箇所（plugins.json）+ 2箇所（README）、issueFactory 72箇所（docs/generated/plugins.md）、加えて .pattern(/re/, 'msg') / .compareField('password', 'msg') / .equals(true, 'msg') / .required({ message: '...' }) / .email({ message: '...' }) の生文字列・message キー形。同じ機能に 5 通りの書き方が文書化されている。1 つに決めよ。
- **docs-site/src/data/plugins.json および plugins.ts の methodName フィールドと usage フィールド** — JSDoc 生成器（generate-plugin-docs-from-jsdoc.js）が壊れており、methodName に stringEmail / stringUrl / stringDatetime / stringBase64 / stringHostname / stringIpv4 / stringIpv6 / stringIri / stringJsonPointer / stringContentMediaType といった export 名を書き込んでいる。usage も『builder.v("field", b => b.string.stringEmail(..., "value", ..., "value"))』のような無意味な自動生成文字列が 20 件以上。src の methodName 定義が正であり、この生成物は捨てて手書きし直すべき。
- **docs/generated/plugins.md** — 2269 行のうち目次に stringEquals / selfRecursively / recursivelyWithContext という実在しないプラグインが載り、『**Since**: 1.0.0\n/』という壊れた JSDoc 断片が全エントリに残り、issueFactory 系のカスタムメッセージ例だけが docs-site と食い違う。生成器ごと作り直す対象。
- **docs-site/src/pages/plugins/index.astro のコード生成器が吐く import 形（import { xxxPlugin } from '@maroonedog/luq' のルート一括）** — getting-started と troubleshooting が『バレル import は tree-shaking を壊すので使うな』と指導しているのに、公式のコード生成器がまさにそれを吐いている。生成器の出力はサブパス個別 import でなければならない。
- **core-concepts の items.*.id（ドット星）記法** — 他の全ページ（troubleshooting, examples, builder, plugin-registry）が items[*].id を使う。ドット星は 1 箇所きりの誤記。[*] に統一せよ。
- **DocsSidebar の /generator リンク（Plugins セクションと Tools セクションで同じ項目が 2 回出る）** — docs-site/src/pages に generator ページは存在せず、実体は /plugins。しかも同一リンクが 2 セクションに重複している。サイト構成の再設計対象。
- **README の性能数値『1.2M ops/sec (simple), 43K ops/sec (complex)』と『40+ built-in plugins』** — benchmarks ページの実測値は 694,692 ops/sec と 35,946 ops/sec で、README は約 1.7 倍・1.2 倍に盛られている。プラグイン実数も 69〜70 で 40+ は過少。数値は 1 箇所（計測結果ファイル）を単一の情報源にして両者を生成せよ。
- **Plugin Registry（createPluginRegistry / createFieldRule / toBuilder / useField）を第一級 API として残すこと** — ドキュメント自身が 3 箇所（When to Use ボックス、Overview の Recommendation、pick() の Tip）で『Builder があるなら pick() を使え、Registry はほとんどの場合不要』と書いており、公式に格下げされている。plugin-registry.astro は 1010 行と全ページ中最大だが、その分量は価値ではなく重複。新実装では pick() と『FieldRule 相当を素の関数として作る』方式に統合し、Registry という別世界を作らない選択肢を真剣に検討すべき。
- **ChainableFieldBuilder<TObject, TPlugins, TType, TCurrentType, TTypeState> という 5 型変数の露出** — custom-plugins.astro がこの内部型シグネチャをそのまま利用者向けドキュメントに載せている。カテゴリごとの『どんなメソッドが生えるか』という契約だけが引き継ぐ価値のある部分で、型変数の並びと名前は実装詳細。新実装で同じ形を再現する義務はない。
- **docs-site/src/content/docs と docs-site/src/content/guides（config.ts はあるが中身が空）** — Astro のコンテンツコレクションを設定したまま 1 ファイルも入れずに放置され、実際のドキュメントは全部 pages/ 配下の .astro にハードコードされたテンプレート文字列。ページと本文が癒着しているため差分レビューも翻訳もできない。ドキュメント基盤ごと作り直す判断材料。

## 公開シンボル (216)

`Builder`, `use`, `for`, `v`, `useField`, `strict`, `strictOnEditor`, `build`, `validate`, `parse`, `pick`, `fromJsonSchema`, `Result`, `isValid`, `isError`, `unwrap`, `unwrapOr`, `unwrapOrElse`, `map`, `flatMap`, `tap`, `tapError`, `data`, `errors`, `valid`, `value`, `toPlainObject`, `ValidationError`, `ValidationResult`, `ValidationOptions`, `ParseOptions`, `FieldOptions`, `FieldBuilder`, `FieldValidator`, `FieldRule`, `MessageContext`, `IssueContext`, `LuqValidationException`, `NestedKeyOf`, `TypeOfPath`, `TypeName`, `PluginCategory`, `PluginType`, `TypedPlugin`, `BuilderExtensionPlugin`, `BuilderExtensionMethod`, `TransformAwareValidator`, `ApplyFieldTransforms`, `ExtractFieldType`, `ExtractFieldRuleType`, `FieldRuleDefinition`, `PluginRegistry`, `TypedPluginRegistry`, `createPluginRegistry`, `createFieldRule`, `toBuilder`, `getPlugins`, `getPluginRegistry`, `plugin`, `PluginImplementation`, `pluginPredefinedTransform`, `pluginConfigurableTransform`, `pluginBuilderExtension`, `createAsyncContext`, `addAsyncSupport`, `withAsyncContext`, `getAsyncContext`, `GlobalConfig`, `globalConfig`, `setGlobalConfig`, `getGlobalConfig`, `resetGlobalConfig`, `arrayContainsPlugin`, `arrayIncludesPlugin`, `arrayMaxLengthPlugin`, `arrayMinLengthPlugin`, `arrayUniquePlugin`, `booleanFalsyPlugin`, `booleanTruthyPlugin`, `compareFieldPlugin`, `conditionalSchemaPlugin`, `customPlugin`, `fromContextPlugin`, `jsonSchemaPlugin`, `jsonSchemaFullFeaturePlugin`, `literalPlugin`, `nullablePlugin`, `numberFinitePlugin`, `numberIntegerPlugin`, `numberMaxPlugin`, `numberMinPlugin`, `numberMultipleOfPlugin`, `numberNegativePlugin`, `numberPositivePlugin`, `numberRangePlugin`, `objectPlugin`, `objectAdditionalPropertiesPlugin`, `objectDependentRequiredPlugin`, `objectDependentSchemasPlugin`, `objectMaxPropertiesPlugin`, `objectMinPropertiesPlugin`, `objectPatternPropertiesPlugin`, `objectPropertyNamesPlugin`, `objectRecursivelyPlugin`, `oneOfPlugin`, `optionalPlugin`, `optionalIfPlugin`, `orFailPlugin`, `readOnlyWriteOnlyPlugin`, `requiredPlugin`, `requiredIfPlugin`, `skipPlugin`, `stitchPlugin`, `stringAlphanumericPlugin`, `stringBase64Plugin`, `stringContentEncodingPlugin`, `stringContentMediaTypePlugin`, `stringDatePlugin`, `stringDatetimePlugin`, `stringDurationPlugin`, `stringEmailPlugin`, `stringEndsWithPlugin`, `stringExactLengthPlugin`, `stringHostnamePlugin`, `stringIpv4Plugin`, `stringIpv6Plugin`, `stringIriPlugin`, `stringIriReferencePlugin`, `stringJsonPointerPlugin`, `stringMaxPlugin`, `stringMinPlugin`, `stringPatternPlugin`, `stringRelativeJsonPointerPlugin`, `stringStartsWithPlugin`, `stringTimePlugin`, `stringUriTemplatePlugin`, `stringUrlPlugin`, `transformPlugin`, `tupleBuilderPlugin`, `unionGuardPlugin`, `uuidPlugin`, `validateIfPlugin`, `.required()`, `.optional()`, `.nullable()`, `.min()`, `.max()`, `.range()`, `.exactLength()`, `.pattern()`, `.email()`, `.url()`, `.uuid()`, `.alphanumeric()`, `.startsWith()`, `.endsWith()`, `.base64()`, `.date()`, `.datetime()`, `.time()`, `.duration()`, `.hostname()`, `.ipv4()`, `.ipv6()`, `.iri()`, `.iriReference()`, `.jsonPointer()`, `.relativeJsonPointer()`, `.uriTemplate()`, `.contentEncoding()`, `.contentMediaType()`, `.integer()`, `.finite()`, `.positive()`, `.negative()`, `.multipleOf()`, `.truthy()`, `.falsy()`, `.minLength()`, `.maxLength()`, `.unique()`, `.contains()`, `.includes()`, `.object()`, `.additionalProperties()`, `.minProperties()`, `.maxProperties()`, `.patternProperties()`, `.propertyNames()`, `.dependentRequired()`, `.dependentSchemas()`, `.recursively()`, `.oneOf()`, `.literal()`, `.custom()`, `.transform()`, `.compareField()`, `.stitch()`, `.requiredIf()`, `.optionalIf()`, `.validateIf()`, `.skip()`, `.orFail()`, `.conditionalSchema()`, `.fromContext()`, `.readOnly()`, `.tupleBuilder()`, `.unionGuard()`, `b.string`, `b.number`, `b.boolean`, `b.array`, `b.object`, `b.date`, `@maroonedog/luq`, `@maroonedog/luq/plugins/<pluginName>`

