# リリース前チェックリスト

このファイルは「機械が答えられないこと」だけを並べる。
機械が答えられることは `npm run verify` が答える（下の §1 がその一覧）。
チェックリストに「テストが通ること」と書いてはいけない。それは CI の仕事であって、
人が目視するリストに混ぜると、人にしか判断できない項目が埋もれる。

**数字をこのファイルに転記しないこと。** すべて記録ファイルから読むこと。
1.x の README が「1.2M ops/sec」と書き、同じリポジトリのベンチページが 694,692 と
書いていたのは、数字を散文に手で打ったからである。

| 数字 | 唯一の出所 |
|---|---|
| バンドルサイズ | `config/size-budget.json` の `recordedGzipBytes` |
| 性能（ops/sec, build コスト, 1.x 比） | `config/perf-baseline.json` |
| Draft-07 適合率 | `config/json-schema-suite.json` と `docs/json-schema-conformance.md` |
| プラグイン数・公開キー | `config/plugin-catalog.lock.json` |
| プラグイン著者契約の形 | `config/contract-arity.lock.json` |

数字を測り直すコマンド:

```
npm run check:size     # バンドルサイズ（毎ビルド走る。天井超過でCIが落ちる）
npm run bench:record   # 性能。静かな、名前のあるマシンで。config/perf-baseline.json を書き換える
npx jest test/integration/json-schema-suite.test.ts   # Draft-07 適合率
npm pack --dry-run     # パッケージに入るファイル一覧
```

---

## 0. この版で公開面が変わった点（レビューの起点）

- `./field-rule` を新規に公開した。`createFieldRule` / `createPluginRegistry` /
  `useField` / `FieldRule` は 1.x ではルートから公開されていたもので、新実装では
  実装もテストも dist もあったのに **どの export キーも指していなかった**。
  公開キーは 83 → 84 になった。`docs/migration/breaking-changes.md` §1.5 を読むこと。
- 固定キーは6件から7件に増えた。`config/plugin-catalog.lock.json` と
  `scripts/catalog/plugin-source-roots.ts` の両方に出る。

---

## 1. 機械が答える部分（人は「緑だったか」だけ確認する）

```
npm run verify      # 下の全部を含む。exit 0 でなければリリースしない
npm run bench:gate  # verify には入っていない。CI の bench ジョブが回す
npm publish --dry-run
```

`npm run verify` の中身（この順に走る）:

| 段 | コマンド | 何が落ちたら何が壊れている |
|---|---|---|
| 生成物の同期 | `generate:sources` | マニフェスト／バレルが src と食い違っている |
| 整形 | `format:check` | src / test / scripts / bench の prettier 差分 |
| 静的検査 | `lint`, `lint:filenames` | `any`・禁止語・kebab-case 違反 |
| 型 | `typecheck`（src / scripts / bench）, `test:types` | 型の退行、`@ts-expect-error` の位置ずれ |
| ソース契約 | `check:contract-arity` | プラグイン著者面（マーカー語彙・ResolveArg 引数・build のメソッド宣言）が動いた |
| | `check:module-has-test` | 実行時テストがどこからも触っていない src モジュールがある |
| | `check:suite-pin` | JSON Schema スイートの SHA / digest / skip 件数が記録と食い違う |
| カタログ | `check:plugin-uniqueness`, `check:plugin-isolation`, `check:exports --mode=exact`, `check:catalog-lock` | プラグインの重複・隔離違反・exports の手編集 |
| ビルド | `build` | dist が作れない |
| 出荷物 | `check:no-dynamic-code` | 出荷物に `eval` / `new Function` が入った（CSP-safe の主張の根拠） |
| | `check:dist-layout` | 私的成果物の混入、解決できない相対指定、コアの取り込み |
| ドキュメント | `check:generated-docs`, `check:doc-examples`, `check:doc-imports` | 生成リファレンスの差分、コンパイルしない例、公開されていない import |
| 配布 | `check:size`, `check:barrel-equivalence` | サイズ予算超過、バレル経由の肥大 |
| テスト | `npm test` | 単体・統合・dist・型以外の全部 |

`prepublishOnly` は `npm run verify` を回す。つまり `npm publish` は verify を通らずには走らない。

---

## 2. 人が判断すること（リリースを止める権限があるのはここだけ）

### 2.1 性能：**新実装は 1.x より遅い**。受け入れるか直すかを決める

`config/perf-baseline.json` の `legacyComparison` を読むこと。同じマシン・同じプロセスで
1.x のソースと新実装のソースを交互に測った結果である。**平坦な形と入れ子の形で 3〜11 倍遅い。**
速いのは配列と JSON Schema の形だけ。

- これは測定の癖ではない。入力を16個回しても 1.x 側は変わらず、1.x は5つの形すべてで
  不正値を落としているので「手を抜いて速い」わけでもない（step 30 の検証記録）。
- 原因の候補として記録されているのは、1.x が持っていた `src/core/optimization/` 相当の
  特殊化された高速経路が新実装に無いこと。
- **決めること: (a) この差を受け入れて公開する / (b) 公開前に最適化する / (c) 差を README に
  明記したまま alpha として出す。** 現在の README は差を差として太字で書いてある。
- 決めた結果をこのファイルの下の「決定の記録」に書き、日付と決めた人を残すこと。

### 2.2 サイズ予算の天井が今のままでよいか

`config/size-budget.json` の `gzipCeilingBytes` は実測の追認で、余裕は 6.5〜8%（最小で 580 B）。
プラグインを1個足すと gzip で 130〜950 B 増えるので、天井は「もう1個足したら割れる」位置にある。

- 天井を上げるのはレビュー対象。**実測が天井を超えたときに天井を書き換えて通す、をやらないこと。**
- `full-feature` は「中核 + 全プラグイン」であって、現実にこの構成を import する利用者はいない。
  この数字を単独で「バンドルサイズ」として引用しないこと。

### 2.3 JSON Schema 適合率を公開値として認めるか

`docs/json-schema-conformance.md` の見出しの数字（skip は不合格として数えている）を読むこと。
自明な下限（常に true を返す検証器）との差が意味のある部分である。
skip リストを増やして率を上げることは構造的にできない（skip は不合格に数えられる）が、
**skip の増減はレビューすること**：`check:suite-pin` は件数の一致しか見ない。

### 2.4 パッケージに入るもの

```
npm publish --dry-run
```

出力のファイル一覧を見て、次を確認する。

- 入るべきもの: `dist/`、`README.md`、`LICENSE`、`package.json`
- 入ってはいけないもの: `src/` の生 `.ts`、`test/`、`scripts/`、`bench/`、`docs/`、
  `__tests__`、`*.experimental*`、`.map`
- `files: ["dist"]` がこれを担保しており、`check:dist-layout` が dist 側の混入を見ている。
  それでも**目視すること**：1.x は `dist/core/plugin/__tests__/` を公開していた。

### 2.5 バージョンと配布メタデータ

- `package.json#version` を上げたか。今は `0.1.2-alpha`。
  1.x の公開面と互換でない変更（`docs/migration/breaking-changes.md`）を含むので、
  安定版を名乗るならメジャーを上げること。
- alpha のまま出すなら `npm publish --tag alpha`。既定の `latest` に alpha を載せない。
- `repository` / `homepage` / `bugs` / `license` / `sideEffects: false` が生きているか。
- `dependencies` は空である（`@types/json-schema` への依存は新実装には無い。
  出荷される `.d.ts` が `json-schema` 型を参照していないことを確認済み）。
  ここに依存が増えたら、それは公開面の変更である。

### 2.6 ドキュメントの約束

- README とガイドの数字が §0 の表の出所から読まれているか（手打ちが混ざっていないか）。
- `docs/migration/breaking-changes.md` に、1.x から壊れる点が全部載っているか。
- 1.x が謳っていて新実装が引き継がないものを、引き継がないと書いてあるか
  （`.luq` DSL、ロードマップ、`19-23KB gzipped` という数字、Plugin Registry の第2入口）。

---

## 3. まだ残っている宿題（リリースを止めるかは人が決める）

- **リポジトリ直下の 1.x 由来の残骸**: `core-entry.ts`, `exports-config.json`,
  `rollup.dts.config.js`, `build.sh`, `run-all-tests.sh`, `lib/`, `test-build/`,
  `bundle-size-comparison/`, `jest.swc.config.js`, `scripts/benchmark-optimized.js`,
  `scripts/performance-profiler.js`。どれも `files: ["dist"]` の外なので**公開はされない**が、
  リポジトリを読む人には「生きている設定」に見える。消すなら別コミットで。
- **言語が混在している**: README とガイドと `breaking-changes.md` は英語、
  `docs/migration/plugins.md` と設計文書とコードコメントは日本語。どちらかに寄せるかを決める。
- **`test/type/contract/**` と `docs/plugin-author-contract.md` は存在しない**。
  build-order step 7 の生成物だが作られなかった。契約の凍結は
  `config/contract-arity.lock.json`（step 32 で作成）が代行している。
- **`scripts/check-test-names.ts` が無い**（test-strategy が要求している、
  final-assault / coverage / extra といった名前を禁止する検査）。
  現状その名前のテストは無いが、機械的な歯止めは無い。

---

## 4. 決定の記録

| 日付 | 決めた人 | 決めたこと |
|---|---|---|
| | | |
