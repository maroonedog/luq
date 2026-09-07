# json-schema-mapping

## 対象領域

`fromJsonSchema()` = JSON Schema Draft-07 の JSON を実行時に読み込み、Luq の Builder 連鎖に変換する経路。実装は `src/core/plugin/jsonSchema/` 8ファイル (計 2,390行) + 束ねプラグイン `src/core/plugin/jsonSchemaFullFeature.ts` (188行)。

## 最重要の事実：実装は「2つの別々のエンジン」に分裂している

読んだ結果、この領域には **意味論的に一致しない2つの JSON Schema エンジン** が同居している。

- **経路A（ビルダー変換）**: `convertJsonSchemaToLuqDSL()` → `LuqFieldDSL[]` → `convertDSLToFieldDefinition()` → `applyBaseType()` + `applyConstraints()` → `builder.v(path, fn)`。`fromJsonSchema()` が実際に使うのはこれだけ。
- **経路B（純関数インタプリタ）**: `validateValueAgainstSchema(value, schema, customFormats, rootSchema)`（`validation-core.ts`）と `getDetailedValidationErrors()`（`error-generation.ts`）。JSON Schema をその場で解釈する再帰バリデータ。経路A からは `allOf`/`anyOf`/`oneOf` を `chain.custom()` に包む時だけ間接的に使われる。

**経路B はほぼ完全な Draft-07 実装で、テストも通っている。経路A は大穴だらけで、fromJsonSchema の統合テストは 42 スイート中 32 が失敗している**（`./node_modules/.bin/jest test/…/jsonSchema` 実測: 32 failed / 10 passed、104 tests failed / 602 passed）。通っている 10 スイートは全て経路B・純関数のユニットテスト（`validation-core.test.ts`, `format-validators.test.ts`, `ref-resolver.test.ts`, `dsl-converter.test.ts`, `error-generation*.test.ts`, `index.test.ts`）。

実測した経路Aの機能欠落の証拠（`test/integration/jsonschema-format.test.ts` 実行結果）:
- `{type:"string", format:"date"}` に `"2024-13-01"` → **valid=true**（期待 false）
- `{type:"string", format:"ipv4"}` に `"999.999.999.999"` → **valid=true**（期待 false）
- `format: "email"` と `format: "date-time"` は正しく落ちる

これは `applyConstraints()`（dsl-converter.ts 485-509行）が format のうち **email / uri / url / uuid / date-time / datetime の6語しか builder メソッドに繋いでいない** ことと完全に一致する。残りの format は黙って無視される。

## 引き継ぐべき思想（実装ではなく）

1. **JSON を渡すだけで、プラグイン連鎖を書いたのと同じ検証器が得られる**（`Builder().use(jsonSchemaFullFeaturePlugin).fromJsonSchema(schema).build()`）。CSP-safe（eval / new Function は一切なし。実際に全ファイル grep して 0 件）。
2. **JSON Schema キーワード → 既存プラグインへの 1:1 マッピング**。JSON Schema 専用の別バリデータを作らず、`minLength` は `stringMinPlugin` の `.min()`、`uniqueItems` は `arrayUniquePlugin` の `.unique()` という形で既存プラグイン資産に落とす。これが tree-shaking を壊さないための設計意図。
3. **`jsonSchemaFullFeaturePlugin` = 「全部入り1個」**。45個のプラグインを内部で `.use()` して回し、最後に `jsonSchemaPlugin` を足す。「JSON Schema を丸ごと食わせたい人は 1 import で済む／自分で必要なものだけ選びたい人は `jsonSchemaPlugin` + 個別プラグイン」という二段構え。
4. **customFormats による format 拡張**（`JsonSchemaOptions.customFormats: Record<string, (value) => boolean>`）。組み込みより優先される。
5. **未知の format は「通す」**（`validateFormat` の最終 `return true`）。これは JSON Schema 仕様（format はデフォルト annotation）に沿った正しい判断で、引き継ぐべき。ただし `error-generation.ts` は同じ状況で `isValid = false` にしており矛盾している（下記 doNotInherit）。

## format 全リスト（`formatValidators` のキー全18件、grep 済み・省略なし）

| format | 判定規則（format-validators.ts 実装） | Draft-07 標準か | 経路A（builder）に繋がるか |
|---|---|---|---|
| `email` | `..` を含めば false → `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/` | ○ | ○ `.email()` |
| `url` | `new URL(v)` が投げなければ true | ✕（非標準・独自追加） | ○ `.url()` |
| `uri` | `new URL(v)` → 失敗時 `/^([a-zA-Z][a-zA-Z0-9+.-]*):(.+)$/`、`//` 始まりは以降に内容必須 | ○ | ○ `.url()` にマップ |
| `uri-reference` | `new URL` → 失敗時「`/` 始まり or `:` を含まない」なら true | ○ | ✕ 無視 |
| `uuid` | `/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`（v1–v5 のみ） | ✕（2019-09 で追加） | ○ `.uuid()`（ただし plugin 側は v1–v8 を許容し**不一致**） |
| `date` | `/^\d{4}-\d{2}-\d{2}$/` かつ `new Date(v).toISOString().startsWith(v)`（実在日チェック） | ○ | **✕ 無視（実測で確認）** |
| `date-time` | `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/` かつ `!isNaN(new Date(v))` | ○ | ○ `.datetime()`（plugin 側はオフセット `+09:00` も許容し**不一致**） |
| `time` | `/^\d{2}:\d{2}:\d{2}(\.\d{3})?$/` + h≤23 / m≤59 / s<60 | ○ | ✕ 無視 |
| `duration` | `/^P(?:(\d+Y)?(\d+M)?(\d+D)?)(?:T(\d+H)?(\d+M)?(\d+(?:\.\d+)?S)?)?$/` | ✕（2019-09） | ✕ 無視 |
| `ipv4` | 4オクテット正規表現 + 各部 0–255 の数値チェック | ○ | **✕ 無視（実測で確認）** |
| `ipv6` | `/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/` **または `v.includes('::')` なら無条件 true** | ○ | ✕ 無視 |
| `hostname` | 長さ ≤253 + RFC1123 ラベル正規表現 | ○ | ✕ 無視 |
| `json-pointer` | `/^(\/([^\/~]|~[01])*)*$/` | ○ | ✕ 無視 |
| `relative-json-pointer` | `/^[0-9]+#?$/`（**JSON Pointer 部分を全く見ていない**） | ○ | ✕ 無視 |
| `iri` | `/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/` | ○ | ✕ 無視 |
| `iri-reference` | `/^([a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*|\/[^\s]*|[^\s:\/]+)$/` | ○ | ✕ 無視 |
| `uri-template` | `/^[^{}]*(\{[^{}]+\}[^{}]*)*$/` | ○ | ✕ 無視 |
| `regex` | `new RegExp(v)` が投げなければ true | ○ | ✕ 無視 |

**Draft-07 標準で未実装**: `idn-email`, `idn-hostname`（2つとも `formatValidators` に無い → `validateFormat` が無条件 true を返す）。

**同じ format の実装が3セット並存している**（全て別々の正規表現）:
- (1) `jsonSchema/format-validators.ts` … 経路B が使う
- (2) 個別プラグイン（`stringEmail.ts` の `DEFAULT_EMAIL_REGEX`、`stringIpv4.ts` の `IPV4_REGEX`、`stringDatetime.ts` の STRICT/LENIENT 2種、`uuid.ts` の v1–v8 パターン等）… 経路A が使う
- (3) `error-generation.ts` 内のインライン switch（`email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/`、`uri: /^https?:\/\//`、`uuid` は version nibble を見ない）… エラーメッセージ生成専用で、しかも **未知 format を `isValid=false`** にしていて (1) と逆


## 引き継ぐ契約 (14件)

### must-preserve (9)

#### fromJsonSchema
- 出典: `src/core/plugin/jsonSchema/plugin.ts`
- 形: fromJsonSchema<TBuilder>(schema: JSONSchema7 | unknown, options?: JsonSchemaOptions): TBuilder — Builder 拡張メソッド。内部で this.for() を呼び、DSL 化した各フィールドを fieldBuilder.v(path, definition) で積む。戻り値は FieldBuilder なので .build() を続けて呼ぶ
- 意味: JSON Schema を受け取り、properties を再帰的に平坦化して各フィールドのバリデータ連鎖を組み立てる。ネスト objectは 'a.b.c'、配列要素は 'items[*]'、patternProperties は '*' というパス表記になる。path==='' のルート制約フィールドは .v() から除外され、additionalProperties===false のとき fieldBuilder.strict()、dependentRequired があるとき各依存先に requiredIf(data => data[trigger] !== undefined) を追加する

#### jsonSchemaPlugin
- 出典: `src/core/plugin/jsonSchema/plugin.ts`
- 形: BuilderExtensionPlugin<"jsonSchema", "fromJsonSchema", (schema, options?) => TBuilder>。src/index.ts と ./plugins/jsonSchema サブパスから公開
- 意味: fromJsonSchema メソッドだけを Builder に生やす最小プラグイン。実際の検証は利用者が別途 .use() した個別プラグインが担う（無い機能は黙って無視される設計）

#### jsonSchemaFullFeaturePlugin
- 出典: `src/core/plugin/jsonSchemaFullFeature.ts`
- 形: BuilderExtensionPlugin<"jsonSchemaFullFeature", "fromJsonSchema", (schema, options?) => TBuilder>。src/index.ts と ./plugins/jsonSchemaFullFeature サブパスから公開
- 意味: extendBuilder で 45 個のプラグインを順に builderInstance.use() し、最後に jsonSchemaPlugin を use する『全部入り』。README が唯一 JSON Schema 用途として宣伝している公開シンボル。名前・振る舞い（1 import で Draft-07 全体をカバーする意図）は維持必須

#### customFormats の優先順位
- 出典: `src/core/plugin/jsonSchema/format-validators.ts`
- 形: validateFormat(value, format, customFormats) / applyConstraints の format 分岐
- 意味: customFormats に同名キーがあれば組み込みより先に必ずそちらを使う。ビルダー経路では chain.refine(customFormats[format]) に流す（ただし chain.refine を実装したプラグインは src 内に存在しない → 実際には何も付かない）

#### 未知 format は検証を通す
- 出典: `src/core/plugin/jsonSchema/format-validators.ts`
- 形: validateFormat(...): boolean — 最終行 return true
- 意味: 組み込みにも customFormats にも無い format 名は valid 扱い。JSON Schema 仕様（format は既定で annotation）に沿った正しい挙動

#### validateValueAgainstSchema
- 出典: `src/core/plugin/jsonSchema/validation-core.ts`
- 形: (value: unknown, schema: JSONSchema7, customFormats?, rootSchema?) => boolean
- 意味: Draft-07 のほぼ全体を解釈する再帰バリデータ。これがこの領域で唯一まともに動いていて、テストで意味論が保全されている資産。const/enum は deepEqual で判定、undefined は常に invalid、null は type に 'null' が含まれるか enum/const 経由でのみ valid。boolean schema（true/false）も items/allOf/anyOf/oneOf/not/if/then/else の各所で扱う

#### resolveRef
- 出典: `src/core/plugin/jsonSchema/ref-resolver.ts`
- 形: (ref: string, rootSchema: JSONSchema7, definitions?) => JSONSchema7
- 意味: '#' 始まりのローカル参照のみ。'#/definitions/X' と '#/$defs/X' の両方を受ける（セグメントが 'definitions' か '$defs' のとき current.definitions ?? current.$defs に降りる）。'#/properties/foo' のような一般 JSON Pointer 経路も動く。外部参照は Error('External $ref not supported: ...') を投げる。解決不能は Error('Cannot resolve $ref: ...')

#### jsonSchemaFullFeature が束ねる 45 プラグインの公開名とメソッド名
- 出典: `src/core/plugin/jsonSchemaFullFeature.ts`
- 形: requiredPlugin(.required) / optionalPlugin(.optional) / nullablePlugin(.nullable) / requiredIfPlugin(.requiredIf) / oneOfPlugin(.oneOf) / literalPlugin(.literal) / customPlugin(.custom) / stringMinPlugin(.min) / stringMaxPlugin(.max) / stringPatternPlugin(.pattern) / stringEmailPlugin(.email) / stringUrlPlugin(.url) / uuidPlugin(.uuid, name は "stringUuid") / stringDatePlugin(.date) / stringDatetimePlugin(.datetime) / stringIpv4Plugin(.ipv4) / stringIpv6Plugin(.ipv6) / stringHostnamePlugin(.hostname) / stringTimePlugin(.time) / stringDurationPlugin(.duration) / stringJsonPointerPlugin(.jsonPointer) / stringBase64Plugin(.base64) / stringIriPlugin(.iri) / stringIriReferencePlugin(.iriReference) / stringUriTemplatePlugin(.uriTemplate) / stringRelativeJsonPointerPlugin(.relativeJsonPointer) / stringContentEncodingPlugin(.contentEncoding) / stringContentMediaTypePlugin(.contentMediaType) / numberMinPlugin(.min) / numberMaxPlugin(.max) / numberIntegerPlugin(.integer) / numberMultipleOfPlugin(.multipleOf) / arrayUniquePlugin(.unique) / arrayMinLengthPlugin(.minLength) / arrayMaxLengthPlugin(.maxLength) / arrayContainsPlugin(.contains) / objectMinPropertiesPlugin(.minProperties) / objectMaxPropertiesPlugin(.maxProperties) / objectAdditionalPropertiesPlugin(.additionalProperties) / objectPropertyNamesPlugin(.propertyNames) / objectPatternPropertiesPlugin(.patternProperties) / objectDependentRequiredPlugin(.dependentRequired) / objectDependentSchemasPlugin(.dependentSchemas) / tupleBuilderPlugin(メソッド名は .builder, allowedTypes ['tuple']) / readOnlyWriteOnlyPlugin(.readOnly, 同ファイルに writeOnlyPlugin(.writeOnly))
- 意味: 『どの JSON Schema キーワードがどのプラグインに落ちるか』の対応表そのもの。プラグイン名とメソッド名は利用者が直接書く公開 API なので維持必須

#### package.json exports サブパス
- 出典: `package.json`
- 形: "./plugins/jsonSchema" と "./plugins/jsonSchemaFullFeature"（前者は jsonSchema/index.ts バレルに解決）
- 意味: README が示す唯一の JSON Schema 導入経路 import { jsonSchemaFullFeaturePlugin } from "@maroonedog/luq/plugins/jsonSchemaFullFeature"。サブパス名は維持必須

### should-preserve (5)

#### JsonSchemaOptions
- 出典: `src/core/plugin/jsonSchema/types.ts`
- 形: { strictRequired?: boolean; allowAdditionalProperties?: boolean; customFormats?: Record<string, (value: any) => boolean> }
- 意味: fromJsonSchema の第2引数。実際に読まれているのは customFormats だけ（plugin.ts が convertDSLToFieldDefinition に渡す）。strictRequired と allowAdditionalProperties は src 全体を grep しても types.ts の宣言以外に出現が 0 件で完全な死にフィールド

#### getDetailedValidationErrors / getSpecificValidationErrors
- 出典: `src/core/plugin/jsonSchema/error-generation.ts`
- 形: (value, schema: JSONSchema7|boolean, customFormats?, rootSchema?, path?) => ValidationError[] / (value, schema, targetPath, customFormats?, rootSchema?) => ValidationError[]
- 意味: エラー種別コード体系がここで定義されている: FALSE_SCHEMA, TYPE_MISMATCH, CONST, ENUM, MIN_LENGTH, MAX_LENGTH, PATTERN, FORMAT, CONTENT_ENCODING, MINIMUM, MAXIMUM, EXCLUSIVE_MINIMUM, EXCLUSIVE_MAXIMUM, MULTIPLE_OF, MIN_ITEMS, MAX_ITEMS, UNIQUE_ITEMS, ADDITIONAL_ITEMS, CONTAINS, MIN_PROPERTIES, MAX_PROPERTIES, REQUIRED, ADDITIONAL_PROPERTIES, PROPERTY_NAMES, ALL_OF, ANY_OF, ONE_OF, NOT。パスは 'a.b' と 'a[0]' の混在表記。getSpecificValidationErrors は '/a/b' 形式を 'a.b' に正規化してから前方一致（'.', '[' 区切り）でフィルタする

#### ValidationError
- 出典: `src/core/plugin/jsonSchema/types.ts`
- 形: { path: string; message: string; code: string; value?: unknown; constraint?: unknown }
- 意味: JSON Schema 由来のエラー1件を表す形。code が上記コード体系、constraint に違反したスキーマ値が入る

#### resolveAllRefs
- 出典: `src/core/plugin/jsonSchema/ref-resolver.ts`
- 形: (schema, rootSchema, visited = new Set<string>()) => JSONSchema7
- 意味: properties / items / allOf / anyOf / oneOf / not / if / then / else を再帰的に $ref 展開する。循環参照を検出すると Error('Circular reference detected: ...') を投げる。公開されているが convertJsonSchemaToLuqDSL からは呼ばれていない

#### formatValidators / getSupportedFormats / isFormatSupported
- 出典: `src/core/plugin/jsonSchema/format-validators.ts`
- 形: Record<string, (value: string) => boolean> / () => string[] / (format: string) => boolean
- 意味: サポート format の実体テーブルと、その名前一覧を実行時に問い合わせる API。18 件（email, url, uri, uri-reference, uuid, date, date-time, time, duration, ipv4, ipv6, hostname, json-pointer, relative-json-pointer, iri, iri-reference, uri-template, regex）

## 振る舞い規則

- 【キーワード対応表 — Draft-07 全キーワードを1件も省略せず列挙】以下、『B』= validateValueAgainstSchema（純関数インタプリタ、テスト通過済み）、『A』= fromJsonSchema のビルダー変換経路。
- $schema : A=無視 / B=無視。src/core/plugin/jsonSchema/ 全8ファイルを grep して出現 0 件。新実装では『読み捨てる』ことを明示的に決めること。
- $id : A=無視 / B=無視。grep 出現 0 件。$id によるベース URI 解決は一切ない。
- $ref : A=部分対応。convertJsonSchemaToLuqDSL の先頭とプロパティ単位で resolveSchemaRef を1段だけ呼ぶ（非再帰）。items / allOf / anyOf / oneOf / if / then / else の中の $ref は展開されないまま constraints に格納される。B=validateValueAgainstSchema 冒頭で rootSchema が渡っていれば1段解決。resolveAllRefs（再帰・循環検出付き）は公開されているがどちらの経路からも呼ばれていない。ローカル参照（'#' 始まり）のみ。外部参照は throw。
- $comment : A=無視 / B=無視。grep 出現 0 件。
- definitions / $defs : resolveRef が両方をパス解決の対象にする。それ自体はフィールドとして走査されない（properties でないため）。
- title : A=無視 / B=無視。grep 出現 0 件。
- description : A=無視 / B=無視（plugin.ts の JSDoc に @description があるだけ）。
- default : A=無視 / B=無視。既定値の適用機構は存在しない。
- examples : A=無視 / B=無視。grep 出現 0 件。
- readOnly / writeOnly : A=無視 / B=無視。jsonSchema/ 配下で grep 出現 0 件。readOnlyWriteOnlyPlugin(.readOnly / .writeOnly) は jsonSchemaFullFeature に同梱されているのに、fromJsonSchema からは決して呼ばれない。
- type : A=processSchemaTypes が LuqFieldDSL['type'] にマップ。string→string, number→number, integer→number, boolean→boolean, array→array, object→object, null→null、未知は string にフォールバック。配列型は 'null' を除いた残りが1個なら単一型 + nullable=true、2個以上なら multipleTypes に格納。type が無く enum があれば enum[0] の typeof から推論、const があれば const の typeof から推論。B=validateType / validateMultipleTypes。number は NaN を除外、integer は Number.isInteger。
- type: "null" : A=applyBaseType が chain.literal(null) を返す（literalPlugin 依存）。B=value === null。
- type: ["string","null"] 等 : A=nullable=true として chain.nullable()。
- type: ["string","number"] 等（null 以外の複数型）: A=builder.oneOf(スキーマ関数の配列) を呼ぶ。ただし oneOfPlugin の impl シグネチャは (allowedValues: readonly unknown[]) すなわち『許容値のリスト』であって関数配列ではない。型不一致で意図通りに動かない。filterConstraintsForType が型ごとに制約を絞る意図だけは読み取れる。
- enum : A=extractConstraints で constraints.enum に格納されるが applyConstraints では一切参照されない（＝ビルダー経路で enum は完全に無視される）。B=schema.enum.some(deepEqual) で正しく判定。
- const : A=applyConstraints の先頭で chain.literal(const) を返し、以降の制約適用を全部スキップして即 return する。B=deepEqual(value, const) で判定し、以降の型別検証をスキップして即 return。
- multipleOf : A=chain.multipleOf(n)（numberMultipleOfPlugin）。B=Number.isInteger(value / multipleOf)。浮動小数の誤差対策は無い。
- maximum : A=chain.max(n)。B=value > maximum で false。
- exclusiveMaximum : A=数値形式なら constraints.max=値かつ exclusiveMax=true として chain.max(値, {exclusive:true})、boolean 形式なら exclusiveMax にそのまま格納。B=数値形式は value >= exclusiveMaximum で false、boolean true 形式は maximum と併用して value >= maximum で false（Draft-04 互換を両方受ける）。
- minimum : A=chain.min(n)。B=value < minimum で false。
- exclusiveMinimum : maximum 側と対称。数値形式・boolean 形式の両方を受ける。
- maxLength : A=chain.max(n)（stringMaxPlugin）。B=value.length > maxLength で false。※コードポイント数ではなく UTF-16 length。
- minLength : A=chain.min(n)（stringMinPlugin）。B=value.length < minLength。
- pattern : A=chain.pattern(文字列)（stringPatternPlugin）。B=new RegExp(pattern).test(value)。アンカーなし部分一致（仕様通り）。
- format : A=email→.email() / uri と url→.url() / uuid→.uuid() / date-time と datetime→.datetime() の4分岐のみ。それ以外の14個の format は黙って無視（実測: format:"date" の "2024-13-01"、format:"ipv4" の "999.999.999.999" がどちらも valid になる）。customFormats がある場合は chain.refine(fn) に渡すが .refine を提供するプラグインは src に存在しない。B=validateFormat で18 format 全対応。
- contentEncoding : A=constraints に格納されるが applyConstraints では参照されない（無視）。B=validateStringConstraints が 'base64' のみ検証（/^[A-Za-z0-9+/]*={0,2}$/ かつ長さ %4===0）。stringContentEncodingPlugin 自体は base64 / base32 (/^[A-Z2-7]*={0,6}$/) / binary (/^[01\s]*$/) を持つが繋がっていない。
- contentMediaType : A=constraints に格納されるが applyConstraints では参照されない（無視）。B=validation-core は『何もしない』と明記、error-generation は該当箇所がコメントアウトされている。stringContentMediaTypePlugin は application/json, text/html, text/xml, text/plain, text/css, text/javascript, application/xml, application/pdf, image/png, image/jpeg, image/gif, image/svg+xml の12種と、text/* 全般（常に true）・*json*（JSON.parse）・*xml* のフォールバックを持ち、base64 デコード（Buffer or atob）にも対応するが、fromJsonSchema からは呼ばれない。
- items（単一スキーマ）: A=配列型プロパティなら 'path[*]' というパスの子フィールドを生成して再帰変換。B=全要素を items スキーマで再帰検証。boolean スキーマも扱う。
- items（タプル配列）: A=constraints.items が配列なら chain.tupleBuilder(items) を呼んで即 return するが、tupleBuilderPlugin のメソッド名は 'builder'（allowedTypes ['tuple']）であって 'tupleBuilder' ではない。ガード `if (chain.tupleBuilder)` により黙って無効化される。B=index ごとに対応スキーマで検証。
- additionalItems : A=extractConstraints が拾わない（完全に無視）。B=タプル検証時、items 長を超えた要素に対し false なら不合格、オブジェクトならそのスキーマで検証。ADDITIONAL_ITEMS エラーコードあり。
- maxItems : A=`chain.maxItems` を呼ぼうとするが、src 全体に methodName 'maxItems' のプラグインは存在しない（arrayMaxLengthPlugin のメソッド名は 'maxLength'）。ガードにより黙って無視される。B=value.length > maxItems。
- minItems : maxItems と同様。A では黙って無視。B=value.length < minItems。
- uniqueItems : A=chain.unique()（arrayUniquePlugin）。B=deepEqual による O(n^2) 重複検出。error-generation 側は JSON.stringify 比較で、キー順に依存する別実装になっている。
- contains : A=constraints.contains に格納されるが applyConstraints では参照されない（無視）。arrayContainsPlugin(.contains) は同梱されているのに繋がっていない。B=value.some(item => validate(item, contains))、boolean スキーマも扱う（false なら常に不合格、true なら空配列で不合格）。
- maxProperties : A=chain.maxProperties(n)（objectMaxPropertiesPlugin）。B=Object.keys(value).length > maxProperties。
- minProperties : A=chain.minProperties(n)。B=同様。
- required : A=親スキーマの required 配列に自分の名前があれば constraints.required=true → chain.required()。B=validateObjectConstraints が `requiredProp in value` で判定。
- properties : A=再帰的に平坦化して 'a.b.c' 形式のドット区切りパスに展開。B=再帰検証。ただし B は value 側のキーを回すため、schema.properties にあるが値に無いキーは検証されない（required 側で担保）。
- patternProperties : A=convertJsonSchemaToLuqDSL がパターン文字列をプロパティ名として扱い、パスに '*'（ネスト時 'parent.*'）というリテラルのアスタリスクを使ったフィールドを生成する。さらに applyConstraints は constraints.patternProperties を参照しない。B=各プロパティ名を各パターンで new RegExp().test して、一致したものを検証。objectPatternPropertiesPlugin は Record<string, (value)=>boolean | {validator}> を期待していて JSONSchema7 を受け取れない形になっている。
- additionalProperties : A=ルート（path==='')で false のときだけ fieldBuilder.strict() を呼ぶ。フィールドレベルでは chain.additionalProperties(値) を呼ぶが、objectAdditionalPropertiesPlugin は options.allowedProperties（既定 []）に無いキーを全部『余分』とみなすため、allowedProperties を渡さない fromJsonSchema からの呼び出しでは全プロパティが不合格になる。LuqFieldDSL に allowedProperties フィールドが定義されているが、src 全体で一度も代入されていない（grep 済み、types.ts の宣言のみ）。B=false なら properties と patternProperties 一致キー以外を拒否、オブジェクトならそれで検証。
- dependencies（Draft-07 の正式キーワード）: A=無視 / B=無視。jsonSchema/ 配下で grep 出現 0 件。Draft-07 では dependencies が配列（dependentRequired 相当）とスキーマ（dependentSchemas 相当）の両方を兼ねるが、どちらの形式も一切扱われない。代わりに Draft 2019-09 の dependentRequired だけが `(schema as any).dependentRequired` として読まれている。
- propertyNames : A=chain.propertyNames(JSONSchema7) を呼ぶが、objectPropertyNamesPlugin は RegExp | string | {validator: (name)=>boolean} しか受け付けず、JSONSchema7 オブジェクトは最後の else に落ちて return false になる（＝全プロパティ名が不合格）。B=各キー名を propertyNames スキーマで検証。boolean スキーマも扱う（false ならキーが1つでもあれば不合格）。
- if / then / else : A=extractConstraints が constraints.if/then/else に格納するが applyConstraints はこれらを一切参照しない（完全に無視）。types.ts には conditionalValidation と requiredIf という別フィールドも宣言されているが、src 全体で代入も参照も無い。B=if を評価し、true なら then、false なら else で検証して即 return。boolean スキーマも扱う。conditionalSchemaPlugin(.conditionalSchema) という専用プラグインが存在するが、src/index.ts からも core/plugin/index.ts からも export されておらず、fromJsonSchema からも呼ばれない完全な死にコード（全 src/test を grep して定義行1件のみ）。
- allOf : A=chain.custom(v => allOf.every(s => validateValueAgainstSchema(v, s))) として経路Bに丸投げ。$ref 解決用の rootSchema を渡していないため、allOf の中の $ref は解決できない。B=全部を再帰検証。boolean スキーマも扱う。error-generation は個別エラーに加えて ALL_OF エラーも重ねて出す。
- anyOf : A=chain.custom(v => anyOf.some(...))。B=some。ルート直下に anyOf があると convertJsonSchemaToLuqDSL が path:'' のフィールド1件だけ返して即 return し、properties の走査を丸ごと飛ばす。plugin.ts は path==='' を .v() から除外するので、結果として『検証が1つも登録されていないバリデータ』が出来る。
- oneOf : A=chain.custom(v => 適合数 === 1)。B=適合数を数えて 1 でなければ不合格。ルート直下の場合の挙動は anyOf と同じ問題を持つ。error-generation は 0 件と 2 件以上でメッセージを分ける。
- not : A=constraints.not に格納されるが applyConstraints では参照されない（無視）。B=not に適合したら不合格。boolean スキーマも扱う。
- dependentRequired（Draft 2019-09）: A=ルート（path==='')でのみ、(schema as any).dependentRequired を読んで、依存先ごとに fieldBuilder.v(dep, b => b.requiredIf(data => data[trigger] !== undefined)) を積む。ネストしたオブジェクトの dependentRequired は無視。objectDependentRequiredPlugin(.dependentRequired) も同梱されているが fromJsonSchema からは呼ばれない。B=無視。
- dependentSchemas（Draft 2019-09）: A=無視 / B=無視。objectDependentSchemasPlugin(.dependentSchemas) は jsonSchemaFullFeature に同梱されているが、fromJsonSchema から呼ばれる箇所が無い。同プラグイン内の validateAgainstJsonSchema は type / minLength / maxLength / pattern / minimum / maximum / minItems / maxItems / enum / const / required だけを見る簡易実装で、経路B とは別物。
- unevaluatedProperties / unevaluatedItems / contentSchema / deprecated / $anchor / $dynamicRef : 全て未対応（grep 出現 0 件）。Draft-07 の範囲外だが、新実装で『対象外』と明示すべき。
- boolean スキーマ（true / false をスキーマとして使う）: A=非対応（convertJsonSchemaToLuqDSL は typeof propertySchema === 'object' のものしか処理しない）。B=items / allOf / anyOf / oneOf / not / if / then / else / additionalProperties / additionalItems / propertyNames / contains の各所で個別に扱う。getDetailedValidationErrors はトップレベルの boolean スキーマも受けて FALSE_SCHEMA を返す。
- undefined の扱い : B は value === undefined を常に invalid とする（JSON Schema にそもそも undefined は無いという立場）。新実装ではオプショナルフィールドの未定義とどう区別するかを決める必要がある。
- null の扱い : B は value === null のとき、type に 'null' が含まれれば即 true、含まれず enum も const も無ければ即 false、enum/const があればそちらの判定に進む。

## 引き継がないもの

- **2エンジン構成そのもの（applyConstraints のビルダー変換 と validateValueAgainstSchema の再帰インタプリタ）** — 同じ JSON Schema に対して別々の答えを出す。format:'date' はインタプリタでは落ちるがビルダーでは通る（実測済み）。uniqueItems はインタプリタが deepEqual、error-generation が JSON.stringify。exclusiveMinimum の解釈も両者で微妙にずれる。新実装は『キーワード→プラグイン』の単一マッピングに一本化し、プラグインが無いキーワードは静かに無視するのではなく明示的に失敗させるか、対応プラグインを必ず用意すること。
- **format 実装の3重化（jsonSchema/format-validators.ts / 個別 stringXxx プラグイン / error-generation.ts のインライン switch）** — 同じ format 名で3種類の正規表現が動いている。email は3つとも別物、uuid は format-validators が v1–v5・uuidPlugin が v1–v8・error-generation がバージョン無視。date-time は format-validators がタイムゾーンオフセットを拒否し stringDatetimePlugin は受け入れる。さらに未知 format の扱いが format-validators は true、error-generation は false で正反対。format 判定は1箇所（プラグイン側）に集約すべき。
- **applyConstraints の `if (constraints.x !== undefined && chain.x)` という『メソッドがあれば呼ぶ』ダックタイピング** — 存在しないメソッド名（minItems, maxItems, tupleBuilder）を書いても型エラーにならず、実行時に黙って検証が消える。実際に minItems / maxItems / tuple items が全て無音で無効化されている。新実装は必要プラグインが未登録なら型エラー、あるいは実行時に明示的な例外にすべき。
- **extractConstraints が拾ったのに applyConstraints が一度も参照しない制約群（enum, integer, contains, not, if, then, else, patternProperties, contentEncoding, contentMediaType, dependentRequired のフィールドレベル）** — 『対応しているように見えて何もしない』のが最悪。特に enum と integer と not が効かないのは JSON Schema 利用者の期待を正面から裏切る。LuqConstraints 型に『格納するが使わない』フィールドを持たせる構造自体を捨てること。
- **LuqFieldDSL / LuqConstraints という中間 DSL 表現** — JSON Schema をほぼそのまま別名のフラット構造に写しただけで抽象化の利得が無い上、conditionalValidation / requiredIf / allowedProperties / multipleTypes など src 全体で一度も代入されない死にフィールドを抱えている。JSON Schema → プラグイン呼び出しの直接マッピングで足りる。
- **JsonSchemaOptions の strictRequired と allowAdditionalProperties** — src 全体を grep して types.ts の宣言以外に出現が 0 件。完全な死にオプション。新実装では customFormats だけを残すか、意味が要るなら仕様を決め直すこと。
- **conditionalSchemaPlugin（src/core/plugin/conditionalSchema.ts, 130行）** — src/index.ts からも core/plugin/index.ts からも export されておらず、jsonSchemaFullFeature にも入っておらず、src と test を全て grep して定義行1件しか出てこない完全な死にコード。しかも中の evaluateSchema は type / properties の const・enum / const / enum しか見ない別実装で、経路B とさらに矛盾する4つ目の JSON Schema 解釈系になっている。
- **objectPropertyNamesPlugin / objectPatternPropertiesPlugin / arrayContainsPlugin / objectDependentSchemasPlugin が JSONSchema7 ではなく独自形（RegExp や (value)=>boolean や {validator})を要求している設計** — JSON Schema からの自動変換と噛み合わない。propertyNames に至っては JSONSchema7 を渡すと全プロパティ名が不合格になる。JSON Schema 由来のプラグインは JSON Schema の部分スキーマを直接受け取れる形にすること。
- **objectAdditionalPropertiesPlugin が options.allowedProperties（既定 []）に依存する API** — 『どのプロパティが宣言済みか』はビルダーが知っている情報なのに、呼び出し側に手で渡させている。fromJsonSchema は渡していないので additionalProperties:false が常時全滅する。宣言済みフィールド集合はフレームワーク側から供給すべき。
- **ルート直下に oneOf / anyOf / allOf があると properties の走査を打ち切って path:'' のフィールド1件だけ返す早期 return（dsl-converter.ts 23-34行）** — 結果として plugin.ts が .v() を1つも登録せず、『何も検証しないバリデータ』が黙って出来上がる。合成キーワードとプロパティ検証は共存できなければならない。
- **patternProperties を 'parent.*' というリテラルのアスタリスク文字列パスに変換する方式** — '*' が本物のプロパティ名と衝突しうるし、複数パターンがあると同じパスに複数フィールドが登録される。パターン対応は別のフィールド種別として表現すべき。
- **jsonschema-final-100-percent / jsonschema-final-assault / jsonschema-turbo-100-percent / jsonschema-surgical-100-percent / jsonschema-ultimate-final / jsonschema-final-140-lines / jsonschema-final-290-lines / jsonschema-ultra-final-266 等のカバレッジ稼ぎテスト群** — ファイル名が示す通り行数カバレッジを埋めるためだけに書かれており、内部関数（getBaseChain 等）を無理な引数で叩いていて仕様を1つも記述していない。多くはコンパイルエラーで動いてすらいない。Draft-07 の公式 JSON-Schema-Test-Suite に置き換えるべき。
- **error-generation.ts（789行）の独立したエラー生成系** — validateValueAgainstSchema と同じ判定ロジックを丸ごと書き直しており、しかも一部（format, uniqueItems）で結論が異なる。エラーコード体系（TYPE_MISMATCH, MIN_LENGTH 等）だけは資産なので引き継ぎ、実装は検証本体からエラーを返す単一パスに統合すること。

## 公開シンボル (75)

`fromJsonSchema`, `jsonSchemaPlugin`, `jsonSchemaFullFeaturePlugin`, `JsonSchemaOptions`, `LuqFieldDSL`, `LuqConstraints`, `ValidationError`, `resolveRef`, `resolveSchemaRef`, `resolveAllRefs`, `formatValidators`, `validateFormat`, `getSupportedFormats`, `isFormatSupported`, `validateValueAgainstSchema`, `validateType`, `validateMultipleTypes`, `validateStringConstraints`, `validateNumberConstraints`, `validateArrayConstraints`, `validateObjectConstraints`, `getDetailedValidationErrors`, `getSpecificValidationErrors`, `convertJsonSchemaToLuqDSL`, `convertDSLToFieldDefinition`, `applyConstraints`, `applyBaseType`, `getBaseChain`, `requiredPlugin`, `optionalPlugin`, `nullablePlugin`, `requiredIfPlugin`, `oneOfPlugin`, `literalPlugin`, `customPlugin`, `stringMinPlugin`, `stringMaxPlugin`, `stringPatternPlugin`, `stringEmailPlugin`, `stringUrlPlugin`, `uuidPlugin`, `stringDatePlugin`, `stringDatetimePlugin`, `stringIpv4Plugin`, `stringIpv6Plugin`, `stringHostnamePlugin`, `stringTimePlugin`, `stringDurationPlugin`, `stringJsonPointerPlugin`, `stringBase64Plugin`, `stringIriPlugin`, `stringIriReferencePlugin`, `stringUriTemplatePlugin`, `stringRelativeJsonPointerPlugin`, `stringContentEncodingPlugin`, `stringContentMediaTypePlugin`, `numberMinPlugin`, `numberMaxPlugin`, `numberIntegerPlugin`, `numberMultipleOfPlugin`, `arrayUniquePlugin`, `arrayMinLengthPlugin`, `arrayMaxLengthPlugin`, `arrayContainsPlugin`, `objectMinPropertiesPlugin`, `objectMaxPropertiesPlugin`, `objectAdditionalPropertiesPlugin`, `objectPropertyNamesPlugin`, `objectPatternPropertiesPlugin`, `objectDependentRequiredPlugin`, `objectDependentSchemasPlugin`, `tupleBuilderPlugin`, `readOnlyWriteOnlyPlugin`, `writeOnlyPlugin`, `conditionalSchemaPlugin`

