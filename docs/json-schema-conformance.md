# JSON Schema Draft-07 適合率（実測）

このファイルの数値はすべて実行して数えたものである。目標に合わせて作った数は無い。
すべての数値は `test/integration/json-schema-suite.test.ts` が
`config/json-schema-suite.json` に対して**両方向に**表明している
（退行も、記録されていない改善も、同じようにビルドを落とす）。

最終測定日: 2026-09-08 / ブランチ `feature/standard-schema`

---

## 1. 見出しの数字

**855 / 929 = 92.03%**

公式 [JSON-Schema-Test-Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite)
draft7、必須テストのみ（`tests/draft7/optional/` は含まない）。

**skip したケースは合格ではなく「不合格」として数えている。**
74件の skip はすべて上の 74件の失敗と同一集合であり、
「skip して率を上げる」ことは構造的にできない。

| | 件数 |
|---|---|
| 総ケース数 | 929 |
| 合格 | **855** |
| 不合格 | 74 |
| うち skip リストに載っているもの | 74 |
| skip リストに無い不合格 | **0** |

### 自明な下限との比較

このコーパスの期待値は「有効 551 / 無効 378」なので、
**何を渡しても true を返すだけの検証器が 551 / 929 = 59.31% を取る。**
適合率はこの下限と比べて初めて意味を持つ。

| | 有効と判定すべき 551件 | 無効と判定すべき 378件 | 合計 |
|---|---|---|---|
| 常に true を返すだけの検証器 | 551 (100%) | 0 (0%) | 551 (59.31%) |
| **新実装** | **523 (94.92%)** | **332 (87.83%)** | **855 (92.03%)** |

## 2. 固定したコーパス

| 項目 | 値 |
|---|---|
| submodule | `test/fixtures/json-schema-suite` |
| commit | `f6fd52a0a95472e079cbfc6ef7f089702b80e045` |
| ディレクトリ | `tests/draft7`（`optional/` は除外） |
| ファイル数 | 37 |
| グループ数 | 258 |
| ケース数 | 929 |
| コーパスの sha256 | `9b13470f746d823ec1644d4ece291973d27f52a09bc4c06580a1037bb2d82d47` |

submodule が動けば sha256 が変わり、`config/json-schema-suite.json`
を測り直すまでビルドが落ちる。適合率の変更が必ずレビュー対象のコミットになる仕組み。

## 3. どの入口で測ったか（重要）

Luq には JSON Schema からの入口が **2つ** あり、コーパスは**チェーンメソッド**で測っている。

- `b.any.jsonSchemaFullFeature(document)` — 測定に使った経路。
  コーパスのスキーマはほぼ全部ドキュメント**ルート**に制約を置くので、
  ルートを「そのフィールド自身」として扱えるこの経路だけが全ケースを判定できる。
  インスタンスがスカラー（数値・文字列・null）のケースも判定できる。
- `fromJsonSchema(document)` — 関数の入口。利用者が書く形は
  `import { fromJsonSchema } from "@maroonedog/luq/plugins/jsonSchemaFullFeature";`
  からの `fromJsonSchema<T>(schema, config?)` である
  （bag を第1引数に取る3引数版は `src/json-schema/build-from-schema.ts` の
  内部シグネチャで、公開されていない）。`Validator<T extends object>` を返すので
  **オブジェクトを検証する用途に限られる**。

両者を同一部分集合で比べた実測値（インスタンスがプレーンオブジェクトの 289 ケース）:

| 入口 | 合格 / 289 | 率 |
|---|---|---|
| `b.any.jsonSchemaFullFeature(document)` | 238 | 82.35% |
| `fromJsonSchema(document)` | 229 | 79.24% |

差の 9件は `fromJsonSchema` 側の build 時失敗 49件のうち、
メソッド経路なら判定できるもの。関数経路は「ゼロに近い」状態ではない
（ルートキーワードは `ROOT_PATH` 対応で宣言できるようになった）。

### 測定に使ったグルー（隠さず書く）

ハーネス `test/json-schema/build-suite-validator.ts` は、
ドキュメントが null を許さないとき対象フィールドに `.optional()` を付ける。
`src/runtime/decide-presence.ts` が null を「どのルールより先に」決めるため、
null の可否はルールではなく**存在ポリシー**で表現するしかないからである。
判定は変換器と同じ `permitsNull` を使うので、ハーネスが変換器から乖離することはない。
これは実際の呼び出し側も書く必要がある3行であり、
「プラグインが1つのルールしか返せない」という制約の帰結である（§7 参照）。

## 4. 落ちている 101件の内訳（実測）

### 失敗のしかた

| 失敗のしかた | 件数 |
|---|---|
| 検証器の構築自体が例外を投げる（判定に到達しない） | 57 |
| 構築はできたが判定が誤り | 17 |
| `validate()` の実行時例外 | **0** |

### 原因別

数え方は `test/json-schema/report-skip-causes.ts` を実行したもので、手では数えない。

| 原因 | 件数 | 解消に必要なもの |
|---|---|---|
| `external-ref` — `http://localhost:1234/...` などの外部・リモート `$ref` | 57 | `feature:external-ref-loader` |
| `tuple-items` — 配列形の `items` と `additionalItems` の組み合わせ | 6 | `feature:tuple-items-and-additional-items` |
| `null-not-observable` — null がルールに届かない（§3 のグルーと同根） | 5 | `feature:document-driven-presence` |
| `ref-identifier-scope` — `$id` によるベース URI と `#anchor` | 3 | `feature:ref-identifier-scope` |
| `ref-chain` — 2ホップ目の `$ref` のルールが集められない | 2 | `feature:ref-chain-resolution` |
| `boolean-sub-schema` — `true` / `false` そのものが部分スキーマである形 | 1 | `feature:boolean-sub-schema` |
| **合計** | **74** | |

解消済みで表から消えた原因が4つある: `reserved-path-segment` (14件、
`__proto__` を宣言できるようにした)、`ref-pointer-escaping` (9件)、
`sibling-keyword-interaction` (3件)、`code-point-string-length` (2件)。
消えた原因の名前は `SuiteSkipCause` からも消してあるので、復活させるには
型を足す必要がある。

外部 `$ref` の 57件（全体の 6.1%）はスイートが `localhost:1234` でスキーマを配信して
取りに行かせるもので、Luq にはネットワークローダーが無い。
これを除いた 872 ケースに対する合格率は **855 / 872 = 98.05%**。

### skip リスト

`test/json-schema/suite-skip-list.ts` の **44 エントリ**が上の 74 ケースを覆う。
エントリは型付きデータで、`cause` と `expiresWith` は閉じた文字列ユニオン、
`reason` は必須プロパティなので、書き忘れは型エラーになる。

**skip したケースも必ず実行される。** skip されたケースが合格したらビルドが落ちる
（`findStaleSkips`）。skip は「まだ落ちる」という表明であって、退行の隠し場所ではない。

## 5. 旧実装との比較（同一コーパスで再実測）

旧実装（`master` ブランチ、`git worktree` に取り出して実行）を
**同じ 929 ケース**に通した実測値。

```
Builder().use(jsonSchemaFullFeaturePlugin).fromJsonSchema(schema).build()
```

| | 旧実装 | 新実装 | 差 |
|---|---|---|---|
| 合格 / 929 | **536 (57.70%)** | **855 (92.03%)** | +319 (+34.33pt) |
| 有効と判定すべき 551件 | 512 (92.92%) | **523 (94.92%)** | +11 |
| **無効と判定すべき 378件** | **24 (6.35%)** | **332 (87.83%)** | **+308 (+81.48pt)** |
| 構築が失敗したケース | 41 | 79 | |
| 判定が誤ったケース | 352 | 22 | |

**旧実装の 57.70% は、常に true を返すだけの検証器の 59.31% を下回る。**
無効な文書を 378件中 24件しか弾けていないためで、
「JSON Schema 対応」と書かれていたものが実質的に何も検証していなかったことを示す。
新実装が有効文書側でわずかに落ちる（−4）のは、外部 `$ref` を
「黙って通す」のではなく構築時に拒否するためである。

オブジェクトを検証する用途（インスタンスがプレーンオブジェクトの 289 ケース）に
限った、関数入口どうしの比較:

| | 旧 `fromJsonSchema` | 新 `fromJsonSchema` |
|---|---|---|
| 合格 / 289 | 155 (53.63%) | **229 (79.24%)** |
| 構築失敗 | 31 | 49 |

なお `docs/legacy-spec/json-schema-mapping.md` が記録している
「旧実装の fromJsonSchema 統合テストは 42 スイート中 32 が失敗（10 合格）」は
旧テストを再実行したものではなく、記録された値である。
新実装の対応範囲（`test/unit/json-schema/**`、`test/integration/json-schema-*.test.ts`、
および 4つの新 format プラグインのテスト）は **23 スイート / 437 テストが全て合格**する。

## 6. 語彙のカバレッジ（実測）

| | 総数 | bind | structural | 対象外 |
|---|---|---|---|---|
| Draft-07 キーワード | 46 | 18 | 19 | 9（すべて注釈のみのキーワード） |
| format 名 | 20 | 20 | 0 | **0** |

- 46 は draft-07 メタスキーマの `properties` キーと完全一致することをテストが照合している。
- format 20 = Draft-07 §7.3 の 17 + 1.x が公開していた `url` / `uuid` / `duration` の 3。
- **format の「対象外」は 0 になった。** ステップ24〜26の時点では
  `idn-email` / `idn-hostname` / `uri-reference` / `regex` の4つがプラグイン不在で
  **構築時に例外**を投げており、コーパスの 24 ケースが検証器を作ることすらできなかった。
  ステップ27でその4プラグイン（`stringIdnEmail` / `stringIdnHostname` /
  `stringUriReference` / `stringRegex`）を追加して束縛した。
  各プラグインの見出しには**何を検査し、何を検査しないか**が書いてある
  （たとえば `string-idn-hostname` は IDNA2008 の派生プロパティ表と Bidi 規則を
  検査しない、と明記している）。
  この4つの追加が 804 → 828（86.54% → 89.13%）の全部である。
- キーワード束縛が名指すプラグイン: 35。`jsonSchemaFullFeature` が同梱するプラグイン: 49。
- プラグインカタログ: 76 ディレクトリ（isolated 74 / extension 2）、
  `package.json#/exports` は 84 キー
  （固定 7 + `./plugins/` 配下 77 = カタログの 76 サブパス + 非推奨の別名1）。
  「プラグインの数」は数え方が2つある: **ディレクトリ / サブパスは 76**、
  **export されるプラグインオブジェクトは 77**（`objectAdditionalProperties` が
  2つ export する）。バンドル予算の "all 76 plugins" は前者、
  docs-site の「77 plugin objects across 76 subpaths」は両方を明示した形である。
  1.x が公開していた 58 サブパスは 1つも失われていない
  （`test/type/public-surface/json-schema.type-test.ts` が型で、
  `test/integration/public-subpath-resolution.test.ts` が実行時で表明する）。

## 7. 既知の限界（率に直接効くもの）

- **外部・リモート `$ref` を解決しない。** 57 ケース。ネットワークを踏むローダーは
  ライブラリの既定機能としては入れていない。
- **`__proto__` を宣言パスの区間として受け付けない。** 14 ケース。
  プロトタイプ汚染を防ぐための意図的な拒否であり、`decision:` 付きで記録してある。
- **ドキュメント由来の存在ポリシーを表現する場所が無い。** プラグインの `build()` は
  ルートを1つしか返せないため、`.jsonSchemaFullFeature(doc)` は
  「ドキュメントが null を許すか」を表現できない。呼び出し側が `.optional()` を
  書く必要がある（§3）。直接 5 ケース。
- **`additionalProperties` が `patternProperties` を知らない。** 3 ケース。過剰に拒否する。
- **再帰 `$ref` は最初の反復で止まる。** コーパスの必須テストには現れないが、
  `tree.child.name` のような深さは検証されない。

## 8. 再現手順

```bash
git submodule update --init --recursive
npm ci
npx jest test/integration/json-schema-suite.test.ts
```

CI は submodule を取得する必要がある（`submodules: true`）。
コーパスが無い場合、このスイートは**緑にならず**、
「コーパスが checkout されていない」という1本のテストが明示的に落ちる。
測っていないのに数字が出る事故を防ぐための設計である。
