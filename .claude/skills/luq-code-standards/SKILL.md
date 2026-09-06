---
name: luq-code-standards
description: Luq リポジトリの TypeScript コード規約 — 1クラス1責務・1ファイル200行以内・厳格な命名・as any 禁止。src/ 配下の TypeScript を新規作成・リファクタリング・レビューするときに必ず読むこと。ファイル分割、責務の切り出し、型付けの判断、命名の決定をする前に参照する。
---

# Luq コード規約

`src/` 配下の TypeScript に適用する。既存コードがこれに違反していても、触った箇所は規約に合わせて直す。

## 1. 1ファイル200行以内

- コメント・空行を含めて **200行** が上限（`eslint max-lines` で強制）。
- 超えたら「分割する」のではなく「**責務が2つ以上ある**」と読む。責務の境界で切る。
- 行数を減らすために1行に詰め込むのは違反。prettier の整形結果で200行に収まる設計にする。

### 分割の型
| 症状 | 切り出し先 |
|---|---|
| 分岐の塊が特定の型だけを扱う | その型専用のモジュール（`string-length-validator.ts` 等） |
| 「準備 → 実行 → 整形」が1関数に同居 | 各ステップを別ファイルの純粋関数へ |
| 定数テーブル・エラーメッセージが混在 | `*-messages.ts` / `*-constants.ts` |
| 型定義がロジックと同居 | `*.types.ts` |

## 2. 1クラス1責務

- 1ファイルにクラスは1つまで（`max-classes-per-file: 1`）。
- クラスの説明に「〜と〜をする」が入ったら分割する。
- 状態を持つ必要がないならクラスにしない。純粋関数 + 型で表現する（Luq は関数合成が主軸のライブラリで、無用なクラスは tree-shaking を壊す）。
- 「Manager」「Handler」「Helper」「Util」「Processor」「Service」で終わるクラス名は、責務が言語化できていない印。禁止（下記の命名規約）。

## 3. 命名は厳格に、抽象名を使わない

**禁止する語**（単体でも接尾辞でも）:
`util` / `utils` / `helper` / `helpers` / `manager` / `handler` / `processor` / `service` / `common` / `misc` / `stuff` / `data` / `info` / `item` / `temp` / `tmp` / `obj` / `val` / `res` / `ret` / `foo`

**置き換え方**: 「何を」「どうする」かを名前に入れる。

| ✗ | ✓ |
|---|---|
| `FieldHelper` | `FieldPathResolver` |
| `validateData(d)` | `validateEmailFormat(email)` |
| `processItem(x)` | `compileFieldRuleToValidator(rule)` |
| `getInfo()` | `getPluginMetadata()` |
| `handleResult(r)` | `mergeIssuesIntoResult(issues, result)` |
| `utils/index.ts` | `field-path/parse-field-path.ts` |

**規則**:
- 関数 = 動詞句。boolean を返すなら `is` / `has` / `can` / `should` で始める。
- 変数 = 中身が特定できる名詞。`result` 単体は不可、`validationResult` にする。
- 型・インターフェース = 名詞句。`I` 接頭辞は付けない。
- ファイル名 = kebab-case で、export する主要シンボルと一致させる（`FieldPathResolver` → `field-path-resolver.ts`）。
- 略語は既知のもの（`json`, `url`, `id`, `uri`, `dsl`）のみ。自作の略語は禁止。

## 4. `as any` 禁止（原則）

- `as any`、`: any`、`any[]`、`Function` 型、`@ts-ignore` は使わない。
- **代替手段**（上から順に検討する）:
  1. 正しい型を書く / ジェネリクスで受ける
  2. `unknown` + 型ガード関数（`isValidationIssue(x): x is ValidationIssue`）
  3. 判別可能ユニオン（`{ kind: "string"; ... } | { kind: "number"; ... }`）
  4. 具体型への `as`（`as any` ではなく `as StringFieldBuilder`）
- **例外を使う場合**は、同じ行の直前に理由コメントと抑制を書く。理由なしの抑制はレビューで落とす。
  ```ts
  // 理由: プラグインの動的合成のため、この地点では型を静的に決定できない。
  // 呼び出し側の `use()` シグネチャで型安全性を担保している。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ```
- 型パズルを `any` で回避しない。回避したくなったら、それは型設計の破綻のサインなので設計を直す。

## 5. その他

- 1ファイル = 1つの公開概念。`index.ts` は re-export だけ置き、実装を書かない。
- 循環インポートを作らない。
- 公開 API のシグネチャと既存テストを壊さない。壊す必要があるときは先に申告する。
- 変更後は必ず以下を通す:
  ```bash
  npm run lint && npm run format:check && npm test
  ```

## 6. 設計思想（変えないこと）

Luq の核は変えない。リファクタリングは「同じ思想を、より正確な型と小さな責務で表現し直す」こと。

- **ビルダー連鎖 API**: `Builder().use(plugin).for<T>().v(field, b => ...).build()`
- **プラグイン単位の tree-shaking**: プラグインは独立モジュール、副作用なし、静的に到達可能
- **CSP-safe**: `eval` / `new Function` を絶対に使わない
- **既存の TypeScript 型をそのまま使う**: スキーマ再定義を強要しない
- **JSON Schema Draft-07 互換**
