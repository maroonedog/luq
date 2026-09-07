# プラグイン移行ガイド (1.x → 2.x)

このファイルはプラグインカタログの確定時点 (build-order ステップ23) の事実を書いたもの。
数字はすべて `config/plugin-catalog.lock.json` と `package.json#/exports` から読める。
どこにも数をハードコードしていないので、ここに書いた数と実体がずれたら
`npm run check:catalog-lock` が落ちる。

## 1. カタログの規模

| 数えるもの | 値 | 出どころ |
|---|---:|---|
| プラグインディレクトリ (isolated) | 70 | `src/plugins/<kebab>/` |
| プラグインオブジェクト (isolated) | 71 | 各 `index.ts` の `*Plugin` export |
| プラグイン公開サブパス | 71 | 70 ディレクトリ + 互換エイリアス1 |
| 固定 export キー | 6 | `.` `./package.json` `./result` `./plugin-kit` `./async` `./plugins` |
| `package.json#/exports` のキー総数 | 77 | 71 + 6 |

ディレクトリ70に対してプラグインが71あるのは、`object-additional-properties/` が
**2つ**の plugin を出すため (下の 4.3)。

`./plugins/jsonSchema` と `./plugins/jsonSchemaFullFeature` はまだ無い。
この2つは extension 段 (ステップ26) のバンドルで、`src/json-schema/extensions/` に
できたときに同じ生成機構から exports に入る。

### 設計文書との差

`docs/design/build-order.md` はステップ18〜22の producesPaths に
11 + 25 + 10 + 17 + 6 = **69** ディレクトリを列挙し、ステップ27の受け入れ条件に
「71 plugins / 72 plugin subpaths / 78 total export keys」と書いている。
`docs/design/verification.md:16` の内訳は
「71 = 旧実装の73シンボル − stitch 3実装の統合2」、
「78 = 固定6 + サブパス71 + 互換1」で、**1プラグイン = 1ディレクトリ = 1サブパス**
を前提にしている。

実体は **70 ディレクトリ / 71 プラグイン (isolated 段)** で、差は次の2点。
数合わせのために何かを作ったり消したりはしていない。事実として記録する。

1. **`src/plugins/array-each/` が producesPaths に無い。** それどころか
   `docs/design/verification.md:34` は「`.each()` / arrayEach は存在しないし
   追加もしない。同じ4件の否定は arrayContains (`.contains()`) で表現でき、
   プラグイン数は71のままである」と明記している。**それでもカタログには入って
   いる。** 判断の根拠は3つで、決着は人が付けるべき論点として残す:

   - `.contains()` は**存在量化** (min/max 個がマッチすればよい)、`.each()` は
     **全称量化**。Draft-07 の `items` は全称で、`.contains()` では表現できない。
     verification.md が「同じ否定を表現できる」と書いているのは型テストの
     反例4件の話で、実行時の意味論の話ではない。
   - サブチェーンの中では `items[*]` というパス宣言が使えないので、
     `patternProperties` や `dependentSchemas` の内側で配列要素を全称的に
     縛る手段が `.each()` 以外に無い。
   - コア段のコードが既に依存している。`src/json-schema/json-schema-bag.types.ts`
     (L8) は `arrayEachPlugin` を import してバッグの member に置いており、
     `src/json-schema/draft07-keywords.ts` の `items` の注記も
     「one sub-chain per element via `.each()`」と書いている。

   落とすなら、ディレクトリ削除に加えてこの2ファイルと
   `test/unit/plugins/array-each/**` の修正が要る。逆に残すなら
   verification.md:34 を撤回する必要がある。今は**残す**側に倒してある
   (利用者は「切り捨て無し」を選んでいる)。
2. **`objectAdditionalPropertiesSchema` がディレクトリを持たない。**
   1.x の `objectAdditionalProperties` は boolean 形とスキーマ形を1つの
   プラグインで抱えていた。boolean 形をマーカーフリーに切り出したのはコア段の
   決定 (`src/json-schema/draft07-bindings.ts` の注記) で、これが無いと
   Draft-07 の `additionalProperties` を型検査付きで束縛できない。
   一方 `docs/legacy-public-surface.md` は `./plugins/objectAdditionalProperties`
   を1サブパスとして凍結しているので、2つのプラグインが1ディレクトリを共有して
   いる。**「1プラグイン = 1サブパス」という設計の前提はここで既に崩れている。**
   tree-shaking の単位が1つになるのが代償。2サブパスに割るなら
   `legacy-public-surface` の凍結を1つ増やす判断が要る。

したがってステップ26で extension 段の2つが入ると
**72 ディレクトリ / 73 プラグイン / 73 プラグインサブパス / 79 export キー**になる。
ステップ27の受け入れ条件の数字はいずれも +1 されるべきもの。

### 派生物の作り方

4つの派生物は全部 `npm run generate` が作る。手で書き換えるものは1つも無い。

| 派生物 | 追跡 | 生成 | 検査 |
|---|---|---|---|
| `src/plugins/manifest.generated.ts` | いいえ (gitignore) | `npm run generate:sources` | — |
| `src/plugins/index.generated.ts` (`./plugins` の実体) | いいえ (gitignore) | `npm run generate:sources` | — |
| `package.json#/exports` | **はい** | `npm run generate:exports` | `npm run check:exports` (`--mode=exact`) |
| `config/plugin-catalog.lock.json` | **はい** | `npm run generate:lock` | `npm run check:catalog-lock` |

`npm run verify` は最初に `generate:sources` を走らせる (追跡していない2つは
ビルド入力なので、クローン直後でも型検査が通る) が、追跡している2つは
**生成せず検査するだけ**にしてある。生成してしまうと、ロックとの突き合わせが
自分自身との突き合わせになって意味を失うため。プラグインを足したら
`npm run generate` を明示的に走らせ、`package.json` と lock の差分をレビューに
乗せる。

## 2. 1.x のプラグインはすべて行き先がある

`docs/legacy-public-surface.md` が機械抽出した 1.x のプラグインモジュールから、
プラグインでないもの (`message-factories` `shared` `shared-constants` `testUtils`
`transform-type-restrictions`) と extension 段の2つを除くと **69個**の概念が残る。
その69は全部このカタログにある。切り捨てはゼロ。

移行で名前・形が変わったものだけを挙げる。

| 1.x | 2.x | 何が起きたか |
|---|---|---|
| `stitch` / `stitch-typed` / `stitchSimple` | `stitch` | 3実装を1つに統合。未型付けの呼び出し形も引き続き受ける |
| `readOnlyWriteOnly` (`readOnlyWriteOnlyPlugin` + `writeOnlyPlugin`) | `readOnly` + `writeOnly` | 2ディレクトリ・2シンボル・2サブパス。1.x では `writeOnlyPlugin` が export されず到達不能だった。旧サブパス `./plugins/readOnlyWriteOnly` は両方を出す互換エイリアスとして存続 |
| `objectAdditionalProperties` (boolean 形とスキーマ形が1つ) | `objectAdditionalProperties` + `objectAdditionalPropertiesSchema` | boolean 形をマーカーフリーに切り出したので Draft-07 の `additionalProperties` が型検査付きで束縛できる |
| `RECURSIVE_SELF` / `RECURSIVE_ELEMENT` | `"self"` / `"element"` | 再帰対象は閉じた語彙 (`RecursionTarget`)。二重アンダースコアは不要になった |
| registry 名 `stringUuid` | `uuid` | 1.x は export 名 `uuidPlugin` / registry 名 `stringUuid` / メソッド `uuid` の三つ名だった。1つに統一。ディレクトリは `uuid/`、サブパスは `./plugins/uuid` |

1.x で `src/core/plugin/index.ts` からは re-export されていたのに
サブパス公開されていなかった13個 —
`fromContext` `conditionalSchema` `numberFinite` `numberRange` `objectRecursively`
`optionalIf` `orFail` `stitch` `stringAlphanumeric` `stringEndsWith`
`stringExactLength` `stringStartsWith` `unionGuard` — は全部サブパスを持った。
「barrel 72 / exports 57」の乖離は、両方を1つのカタログから生成することで消えている。

## 3. 全プラグイン共通の変更

### 3.1 型が合わない値は素通りする

`stringIpv4` など 1.x の 15 個の `FORMAT_*` / `CONTENT_*` プラグインは
非文字列に対して `false` を返していた。今はカタログ全体で例外なく、
**スロットガードが型を持ち、presence 修飾子が null/undefined を持ち、
値ルールはそのどちらも再判定しない**。`null` を nullable なフィールドに入れても
フォーマットエラーは出ない。

### 3.2 既定のエラーコードはプラグイン名

`CUSTOM_VALIDATION_FAILED` `validation_error` `not_in_range` `not_multiple`
`FORMAT_IPV4` `CONTENT_ENCODING` `ARRAY_CONTAINS` `PROPERTY_NAMES`
`PATTERN_PROPERTIES` `DEPENDENT_REQUIRED` `TUPLE_LENGTH_MISMATCH`
`type_mismatch` `equals` `stitch_validation_failed` `READ_ONLY` `WRITE_ONLY`
`uuidVersion` `stringAlphanumeric_with_spaces` … これらは全部消えた。
既定コードは `plugin.name` で、`options.code` でいつでも上書きできる。
1.x の文字列に戻したいなら `options.code` に書く。

### 3.3 メッセージ経路は1本

`options.messageFactory` だけ。`orFail` の生 `message` オプションや
`readOnly` / `writeOnly` の `errorMessage` は無い。定数メッセージは
`{ messageFactory: () => "..." }`。既定メッセージはパスを埋め込まない
(`Value must be a valid IPv4 address`)。パスは `ValidationIssue.path` にある。

### 3.4 引数の不正は build() 時に落ちる

負の長さ、`NaN`、`min > max`、`multipleOf(0)`、`uuid(2)`、未知の
`contentEncoding` などは `PluginArgumentError` を **`.build()` で**投げる。
1.x は実行時に毎回 false を返し、開発者の設定ミスをエンドユーザーに
バリデーションエラーとして見せていた。

### 3.5 プラグイン固有オプションは先頭の引数へ

末尾のオプションバッグは `RuleOptions` (`code` / `messageFactory` / `severity`)
だけと決まっているので、プラグイン固有の設定は宣言された引数に移った。

| 1.x | 2.x |
|---|---|
| `.min(10, { exclusive: true })` | `.min(10, true)` (numberMin / numberMax) |
| `.email({ allowedDomains })` | `.email({ allowedDomains })` — 位置が第1引数になった。`RuleOptions` は第2引数 |
| `.alphanumeric({ allowSpaces: true })` | `.alphanumeric(true)` |
| `.base64({ urlSafe: true })` | `.base64({ urlSafe: true })` (第1引数) |
| `.datetime({ strict: true })` | `.datetime({ strict: true })` (第1引数) |

`numberMin` / `numberMax` は引数が2つになったので、
`.min(5, { code })` は **`.min(5, false, { code })`** と書く。

## 4. カテゴリ別の非互換

### 4.1 presence とゲート

- `required()` は `{ allowNull }` を取らない。`.required().nullable()` と書く
  (presence の合成は順序非依存なので `.nullable().required()` も同じ)。
- `validateIf` / `skip` はチェーン上のどこに書いても同じ。1.x はバリデータ
  ループを break していたので、前に書いたルールは既に走っていた。
- `requiredIf` / `optionalIf` は **CheckRule** で、値が欠損 (undefined/null) の
  ときには発火しない。条件付き presence をエンジンが持たないため
  (下の「積み残し」)。欠損を捕まえたいときは `.required().requiredIf(...)`。
- `orFail` は値が存在するときだけ走る。1.x は欠損でも走った。
- `custom` のコールバックは値だけを受け取る (`(value, rootData)` ではない)。
  他フィールドを見るなら `compareField` か `stitch`。
- `custom` の述語は1値につき1回しか呼ばれない。1.x は判定用とメッセージ用で
  2回呼び、前の値のメッセージが次の検証に漏れることがあった。

### 4.2 文字列

- `.pattern()` は **RegExp のみ**。文字列を渡すのはコンパイルエラーで、
  `.build()` でも `PluginArgumentError`。1.x の `new RegExp(s)` はフラグを
  黙って落としていた。`/g` や `/y` は複製時に外されるので、同じ値を何度
  検証しても結果が変わらない (1.x は `lastIndex` を持ち回っていた)。
- `.contentEncoding()` は閉じたユニオン
  (`"base64" | "base32" | "binary" | "7bit" | "8bit" | "quoted-printable"`)。
  未知の名前は build 時エラー。1.x は未知なら何でも通していた。
- `.contentMediaType()` は検査できないメディアタイプ
  (`application/octet-stream`, `image/png` …) を build 時に拒否する。
  マジックバイト判定と base64 デコードは削除。base64 は
  `string-content-encoding` の1箇所だけが扱う。
- `uuid` のコードは版指定の有無にかかわらず `"uuid"`。
- `stringIpv4` は先行ゼロ (`01.2.3.4`) を拒否するようになった (JSON Schema
  draft7 の ipv4 スイートの要求。1.x の JSDoc も拒否すると書いていた)。
- `stringIpv6` の JSON Schema 側テーブルは `"::"` を含む値を無条件 true に
  していた。構造判定に置き換え、`:::` `gg::1` `hello::world` は落ちる。
- `format` テーブルはもう存在しない。各フォーマットは自分のプラグインを持ち、
  Draft-07 の `format` キーワードはステップ24のフォーマットマップが束縛する。
  呼び出し側がテーブルを渡す `stringFormat` プラグインは削除した。

### 4.3 数値・真偽値

- `.multipleOf(0.1)` が `0.3` を通す。1.x は浮動小数の剰余で `0.3 % 0.1` が
  `0.09999999999999998` になり弾いていた。スケール整数比較に置き換え、
  `0.35` は引き続き弾く。
- `numberRange` は `min > max` / `NaN` を build 時に落とす。1.x は毎回の検証で
  `Plugin configuration error: ...` というメッセージをエンドユーザーに返していた。
- `booleanTruthy` / `booleanFalsy` は厳密な `=== true` / `=== false`。
  名前とメッセージは 1.x のまま残した (変えると既存スキーマの受理範囲が
  黙って変わるため) が、実態は「truthy」ではない。

### 4.4 配列・オブジェクト・タプル

- `arrayUnique` の等価判定は長さに関係なく1つ。1.x は要素11個を境に
  `===` の二重ループと `Set` を切り替えていたので、`[NaN, NaN]` が長い配列では
  重複、短い配列では非重複という状態だった。オブジェクトはキー順に依存しない
  構造比較 (1.x は `JSON.stringify` キーで、`{a:1,b:2}` と `{b:2,a:1}` が別物だった)。
- `objectPatternProperties` は **マッチした全パターン**を適用する。1.x は最初の
  1つで break していて Draft-07 非準拠だった。
- `objectAdditionalProperties` の既知キーは既定で `ctx.declaredSiblingKeys`。
  `.v()` で宣言したキーを `allowedProperties` に書き写す必要はない
  (明示した場合はそちらが勝つ)。
- `objectMinProperties` / `objectMaxProperties` は配列をオブジェクトとして
  数えない。1.x は配列のインデックスをプロパティとして数えていた。
- `objectRecursively` は `maxDepth` 超過を**報告する**。1.x は成功扱いにして
  深い部分のルールを黙って飛ばしていた。循環は今も静かに打ち切る (正しい)。
- `tupleBuilder` は長さを強制する (rest 無しなら厳密一致、rest ありなら最小長)。
  1.x の `tupleBuilder` は `.build()` で `TypeError` を投げ、1行も走らなかった。
  引数の形も変わった: `builder([要素チェーンの配列], rest?)`。
- `objectDependentRequired` は `Record<string, readonly string[]>` だけを取る。
  1.x の `{ required, message }` 形は廃止 (メッセージは `options.messageFactory`)。
- `arrayContains` / `objectPropertyNames` / `objectPatternProperties` は
  対象型でない値を素通しする。1.x はこの3つだけ `false` を返していた。
- composite (`each` / `contains` / `guard` / `patternProperties` /
  `conditionalSchema` / `builder` / `dependentSchemas` / `recursively`) は
  **自分のコードとパスで1件**報告する。要素ごとの issue が欲しいときは
  `items[*].field` を `.v()` で宣言する。

### 4.5 関係・文脈・変換

- `compareField` の比較関数は第2引数 (位置引数)。1.x はオプションバッグの
  `compareFn` で、しかも `as any` を通っていたので呼び出し側の型に出ていなかった。
- `stitch` は宣言したパスをモデルに照らして検査する (存在しないパスは
  コンパイルエラー)。ただし `fieldValues` は呼び出し側で
  `StitchFieldsOf<TRoot, TFields>` に絞り込む。チェーンの契約 (ステップ7で凍結)
  が非ジェネリックなので、宣言パスごとの型付けは今の契約では表現できない。
- `stitch` のチェックは1値につき1回しか呼ばれない (1.x はメッセージ生成で
  もう1回呼んでいた)。
- `fromContext` の `required: true` が実際に効くようになった。1.x はこの分岐に
  到達する実行経路が無く、常に失敗していた。
- `transform` は `parse()` にだけ効き、`validate()` では map が呼ばれない。
  1.x はメインラインとプラグインレジストリのフォールバックで順序が逆だった。
- `readOnly` / `writeOnly` は `RuleContext.external` の
  `{ operation: "read" | "write", isUpdate?: boolean }` を読む。1.x が想定していた
  第3引数 `context` は、どの実行経路からも渡されていなかった。
- `stitch` / `fromContext` のメッセージ優先順位が逆になった。`options.messageFactory`
  が勝ち、チェックが返したメッセージはその factory に `message` として渡る。
  factory を渡さなければチェックのメッセージがそのまま issue に載る。

## 5. import パスの移行

プラグインは1つずつサブパスから取る。

```ts
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";
```

全部まとめて欲しいときは `@maroonedog/luq/plugins`。
このバレルは 1.x では `exports` に無く、README の Quick Start がそのまま
解決に失敗していた。今は生成された export キーの1つ。

カスタムプラグインを書くときの入口は `@maroonedog/luq/plugin-kit`。
1.x の `@maroonedog/luq/core/builder/plugins/plugin-creator` は
`exports` に存在しないパスだった (README のもう1つの壊れた例)。

## 6. カタログ整備で消えたもの (コア段の足場)

以下は core 段が「機構が動くこと」を示すために置いた足場で、公開面ではない。
カタログ確定時に消し、利用者が触れる名前は本物のプラグインに向け直した。

| 消したもの | 行き先 |
|---|---|
| `src/plugins/check-plugins.ts` | `string-min` / `number-min` / `compare-field` / `transform` |
| `src/plugins/gate-plugins.ts` | `validate-if` / `stitch` / (compareToRoot は fixture へ) |
| `src/plugins/presence-plugins.ts` | `required` / `optional` / `nullable` |
| `src/plugins/value-plugins.ts` | `literal` |
| `src/plugins/value/one-of.ts` | `one-of` |
| `src/plugins/number/max.ts` | `number-max` |
| `src/plugins/string/max-length.ts` `pattern.ts` | `string-max` / `string-pattern` |
| `src/plugins/string/format.ts` | 削除。フォーマットは各プラグインが持つ |
| `src/plugins/composition/one-of-schema.ts` | `test/support/probe-marker-plugins.ts` (NarrowedChain のマーカー実証。JSON Schema の `oneOf` は structural で、ステップ25が create-rule から直接組む) |
| `src/plugins/config-plugins.ts` | `test/support/probe-config-plugins.ts` (config と external context の読み手の実証) |

これで `src/plugins/` の直下はプラグインディレクトリと生成物2つだけになり、
その不変条件は `test/integration/plugin-catalog.test.ts` が検査している。

## 7. 積み残し (このカタログでは直せなかったもの)

1. **条件付き presence がエンジンに無い。** `src/runtime/run-field.ts` は
   presence を最初に決め、値が undefined / null ならそこで戻る。したがって
   `PresenceRule` 以外のルールは欠損値を観測できず、`requiredIf` は
   「ルートが言うときだけ必須」を表現できない。修正は `PresenceRule` に
   `appliesWhen(root, item)` を足して `run-field` に相談させることだが、
   これは L2/L4 の契約変更でプラグイン段の範囲を超える。
   `test/unit/plugins/presence/required-if.test.ts` の2件がこの限界を
   明示していて、エンジンが直った瞬間に落ちる (意図的)。
2. **要素値のマーカーが無い。** `arrayIncludes(element)` の `element` は
   `unknown` なので `b.array.includes(42)` が `string[]` でも通る。
   マーカー登録簿は閉じているので、`ElementValue` を足せるのは
   plugin-kit/chain の持ち主だけ。1.x も `any` だったので退行ではない。
3. **`stitch` の `fieldValues` が宣言パスごとに型付かない。** 5節のとおり、
   チェーン契約が非ジェネリックなことによる。`StitchFieldsOf` で呼び出し側が
   絞る形が現状の答え。
4. **`regex` と `uri-reference` フォーマットに担当プラグインが無い。**
   ステップ24のフォーマットマップで決めること。`uri-reference` は
   `stringIriReference` に束ねられる (すべての URI-reference は
   IRI-reference)。`regex` はプラグインが無いので、注釈として扱うか
   後の段でディレクトリを立てるかの判断が要る。
5. **`scripts/check-module-has-test.ts` が 59 件の違反を報告する。**
   ステップ18/19 は producesPaths の指定どおり
   `test/unit/plugins/{presence,string}/**` にテストを置き、
   ステップ20/21/22 は兄弟パス `test/unit/plugins/<kebab>/<kebab>.test.ts` に
   置いた。このゲートは後者しか認めない。テストが無いのではなく置き場所が
   2通りあるだけなので、どちらに寄せるかを決める必要がある
   (`npm run verify` にはまだ入れていない)。
