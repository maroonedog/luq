# Luq (旧FormTailor) - TypeScript向け軽量バリデーションライブラリ

## 最近の実験結果（2024年8月）

### Columnar最適化の改善

配列バリデーションのパフォーマンスを改善するため、Columnar最適化の実証実験を実施しました。

**問題**: 初期のColumnar実装（行→列変換）は、変換オーバーヘッドにより逆に性能が低下

**解決策**: 「取り出すときに、あわせてValidationする」アプローチ

- データ変換とバリデーションを1パスで実行
- メモリアクセスパターンを最適化

**結果**:

- 小規模配列（10要素）: 60%の性能向上
- 中規模配列（1000要素）: 31%の性能向上
- 大規模配列（10000要素）: 20%の性能向上

詳細は以下のドキュメントを参照：

- `columnar-optimization-analysis.md`: 初期実験の分析
- `columnar-optimization-v2-analysis.md`: 改善版の実験結果
- `columnar-optimization-summary.md`: 総括と推奨事項

---

## モチベーション

### 既存のバリデーションライブラリの特徴

現在のJavaScript/TypeScriptエコシステムには多くのバリデーションライブラリが存在します。これらのライブラリの一般的な特徴：

#### 1. スキーマベースアプローチ

従来のバリデーションライブラリは原則として**スキーマベース**であり、スキーマを宣言すると同時にフィールド固有のバリデーションを記載する方式を採用しています。

```typescript
// 従来のスキーマベースアプローチ
const UserSchema = schema.object({
  name: schema.string().min(3),
  age: schema.number().min(18),
  email: schema.string().email(),
});

type User = InferType<typeof UserSchema>; // 型は後から推論
```

この方式の特徴：

- **スキーマから型を生成**: 型定義はスキーマから推論される
- **型定義とバリデーションの一体化**: スキーマが型定義とバリデーションルールを兼ねる
- **既存の型定義との統合**: 既存のTypeScript型定義がある場合、スキーマへの書き換えが発生する

#### 2. バンドルサイズ

- 全機能を含むライブラリは、使用しない機能もバンドルに含まれる
- フロントエンドアプリケーションでは初期ロード時のサイズが増加
- Tree-shakingのサポート状況はライブラリによって異なる

#### 3. 拡張性

- カスタムバリデーションルールの追加方法はライブラリごとに異なる
- プラグインシステムの有無や実装方法に差がある

#### 4. ドキュメンテーションの違い

TypeScriptの型定義とスキーマベースのアプローチでは、ドキュメンテーションの方法に違いがあります：

```typescript
// TypeScript型定義：JSDocコメントがIDEで表示される
type Order = {
  /** 注文の一意識別子 (UUID形式) */
  id: string;
  /** 顧客情報 */
  customer: {
    /** 顧客の氏名 */
    name: string;
    /** 連絡先メールアドレス */
    email: string;
  };
  /** 注文商品リスト */
  items: Product[];
  /** 合計金額（税込） */
  total: number;
};

// スキーマベース：専用メソッドでドキュメントを追加
const OrderSchema = schema
  .object({
    id: schema.string().uuid().describe("注文の一意識別子 (UUID形式)"),
    customer: schema
      .object({
        name: schema.string().min(1).max(100).describe("顧客の氏名"),
        email: schema.string().email().describe("連絡先メールアドレス"),
      })
      .describe("顧客情報"),
    items: schema.array(ProductSchema).min(1).describe("注文商品リスト"),
    total: schema.number().positive().describe("合計金額（税込）"),
  })
  .describe("注文情報");
```

**主な違い：**

- **TypeScript + JSDoc**: IDEでホバー時に自動表示、エディタのネイティブサポート
- **スキーマベースのdescribe**: ランタイムメタデータとして保存、プログラムでの取得が可能

### 開発の背景

バリデーションライブラリには様々なアプローチが存在します：

- **包括的なライブラリ**: 多機能だが、全体のサイズが大きくなる傾向
- **モジュラーなライブラリ**: 必要な機能を選択できるが、設定が複雑になる場合がある

また、以下のような状況が観察されます：

- **型ファーストアプローチ**: 既存の型定義を起点とするライブラリは比較的少数
- **スキーマファーストアプローチ**: スキーマから型を生成するライブラリが主流

開発現場では様々なニーズがあり、プロジェクトの特性に応じて異なるアプローチが求められます。Luqは、既存の選択肢に加えて、新たなアプローチを提供することを目的として開発されました。

### Luqのアプローチ

Luqは**既存の型定義を活用する**アプローチを採用しています：

```typescript
// 既存の型定義をそのまま使用
type UserProfile = {
  name: string;
  age: number;
  email: string;
};

// Luqのアプローチ：型定義とバリデーションロジックを分離
const validator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(numberMinPlugin)
  .use(stringEmailPlugin)
  .for<UserProfile>() // 既存の型を指定
  .v("name", (b) => b.string.required().min(3))
  .v("age", (b) => b.number.required().min(18))
  .v("email", (b) => b.string.required().email())
  .build();
```

この実装の特徴：

- **型定義とバリデーションロジックの分離**: TypeScript型定義とバリデーションルールは別々に定義される
- **既存の型定義の再利用**: 新たな型定義を作成する必要がない
- **型推論の活用**: フィールド名と型は自動的に推論される

### Luqの設計原則

1. **型ファースト**
   - 既存のTypeScript型定義を基準にバリデーションを構築
   - 型定義の変更時にバリデーターの型も自動的に更新される
   - 既存の型定義をそのまま使用可能

2. **プラグインアーキテクチャ**
   - 各バリデーションルールは独立したプラグインとして実装
   - 使用するプラグインのみをインポート
   - Tree-shakingに対応
   - **型安全なカスタムプラグイン**: 独自のビジネスロジックを型安全なプラグインとして実装可能

   ```typescript
   // 一般的なライブラリ：custom関数内でビジネスロジックを実装
   const schema = z
     .string()
     .refine((val) => val.startsWith("PROD-") && val.length === 10, {
       message: "Invalid product code",
     });

   // Luq：ビジネスロジックを再利用可能な型安全プラグインとして定義
   export const productCodePlugin = createPlugin({
     name: "productCode",
     validate: (value: string) => ({
       valid: value.startsWith("PROD-") && value.length === 10,
       message: "Invalid product code format (must be PROD-XXXXXX)",
     }),
     // 型情報を保持
     type: (input: string) => input as string & { __brand: "ProductCode" },
   });

   // 使用時：IDEで productCode メソッドが補完される
   builder.v("code", (b) => b.string.required().productCode());
   ```

   この実装により：
   - ビジネスロジックの一元管理
   - 型安全性の保証（プラグインメソッドとして利用可能）
   - チーム全体での統一的な使用方法の強制

3. **ゼロ依存**
   - 外部ライブラリへの依存なし
   - package.jsonのdependenciesは空
   - ライブラリサイズは予測可能

4. **API設計のアプローチ**

   バリデーションライブラリのAPI設計には、主に2つのアプローチがあります：

   ```typescript
   // 関数型アプローチ（pipe関数合成）
   const validator = pipe(
     string(),
     required(),
     minLength(3),
     maxLength(50),
     email(),
     transform(toLowerCase)
   );
   ```

   ```typescript
   // メソッドチェーンアプローチ（Luqが採用）
   const validator = builder.v("email", (b) =>
     b.string
       .required()
       .min(3)
       .max(50)
       .email()
       .transform((v) => v.toLowerCase())
   );
   ```

   **それぞれの特徴：**

   関数合成：
   - 関数型プログラミングのパラダイムを使用
   - 各関数は独立した単位として存在
   - 左から右（または右から左）への順次実行
   - **高い自由度**: 任意の関数を引数として渡すことが可能

   メソッドチェーン：
   - オブジェクト指向のパラダイムを使用
   - メソッドはオブジェクトのコンテキストで実行
   - ドット記法による連続的な呼び出し
   - **制約による保護**: 利用可能なメソッドが型システムによって制限される

   **本質的な違い：**

   ```typescript
   // 関数型：任意のバリデーション関数を渡せる（自由度が高い）
   const validator = pipe(
     string(),
     custom((val) => someExternalValidation(val)), // 任意の関数を使用可能
     custom((val) => anotherValidation(val)) // 統一性の保証なし
   );

   // Luq：利用可能なメソッドが明確に定義される（制約による保護）
   const validator = builder.v(
     "code",
     (b) =>
       b.string
         .productCode() // プラグインとして定義されたメソッドのみ使用可能
         .customRule() // 存在しないメソッドはコンパイルエラー
   );
   ```

   この違いは環境やチームの特性によって選択すべきアプローチが異なります：
   - **柔軟性重視**: 関数型アプローチ（研究開発、プロトタイプ）
   - **統一性重視**: メソッドチェーン＋プラグイン（大規模チーム、エンタープライズ）

   Luqはメソッドチェーンアプローチを採用しています。

### 目標

- **段階的な導入**: 既存の型定義を維持したままバリデーション機能を追加
- **バンドルサイズ**: gzip後10KB未満（ベンチマーク結果：シンプル7.7KB、複雑8.3KB）
- **型安全性**: TypeScriptの型推論機能をフル活用
- **拡張性**: カスタムプラグインの作成をサポート
- **エコシステムの多様性**: JavaScript/TypeScriptエコシステムにおける選択肢の一つとして

---

## Validator の構築例

```typescript
type UserProfile = {
  name: string;
  age: number;
  mailAddress: {
    main: string;
    sub?: string;
  };
  roles: ["admin", "secretariat"];
};

const values: UserProfile = {
  name: "test",
  age: 18,
  mailAddress: {
    main: "mail@example.com",
  },
  roles: ["admin"],
};

const pluginBuilder = Builder()
  .use(requirePlugin)
  .use(optionalPlugin)
  .use(stringMinPlugin)
  .use(numberMinPlugin)
  .use(objectPlugin)
  .use(arrayIncludesPlugin)
  .for<UserProfile>();

const luq = pluginBuilder
  .v("name", (builder) => builder.string.required().min(3))
  .v("age", (builder) =>
    builder.number
      .required()
      .min(2)
      .transform((v) => String(v))
  )
  .v("mailAddress.main", (builder) => builder.string.required().min(2))
  .v("mailAddress.sub", (builder) => builder.string.optional().min(2))
  .v("roles", (builder) => builder.array.includes("admin"))
  .build();

luq.validate();
```

---

## ドキュメントサイト（docs-site）のUX特徴

### デザイン哲学

Luqのドキュメントサイトは、ライブラリの哲学である「シンプルで実用的」を体現しています。

### ビジュアルアイデンティティ

- **ロゴデザイン**: 紫とティール（青緑）のグラデーションを使用し、「Luq」の文字にウサギの耳のアクセント
- **カラーパレット**:
  - プライマリ：インディゴ系（#6366F1）
  - アクセント：紫・ティールのグラデーション
  - 高コントラスト（WCAG AA準拠）

### インタラクティブ要素

1. **CodePlayground**
   - Monaco Editor統合によるフル機能のコードエディタ
   - リアルタイムバリデーション実行
   - 複数のサンプルコード切替
   - 実行結果の即座表示

2. **アニメーション**
   - Framer Motion使用の滑らかなトランジション
   - スクロール連動アニメーション（ScrollReveal）
   - 数値カウントアップ（統計情報表示）
   - ホバーエフェクト（スケール、グラデーション）

3. **ナビゲーション**
   - 固定ヘッダーによる常時アクセス
   - モバイル対応のレスポンシブメニュー
   - 現在位置を示すアクティブ状態表示
   - 検索機能（Fuse.js）

### アクセシビリティ機能

- **キーボードナビゲーション**: 全機能をキーボードで操作可能
- **スクリーンリーダー対応**: 適切なARIAラベル
- **タッチターゲット**: 最小44pxの操作領域確保
- **カラーコントラスト**: WCAG AA基準を満たす配色

### パフォーマンス最適化

1. **遅延読み込み**
   - Monaco Editorの動的インポート
   - 画像の遅延読み込み
   - コンポーネントの必要時ロード

2. **静的サイト生成**
   - Next.jsの`output: 'export'`による完全静的化
   - Service Worker対応（PWA）
   - キャッシュ戦略の最適化

3. **バンドル最適化**
   - 大きなライブラリの分離（Monaco、Framer Motion）
   - Tree-shaking対応
   - CSS最適化

### 開発者体験（DX）向上機能

1. **コード例の充実**
   - 基本的な使い方
   - 条件付きバリデーション
   - カスタムプラグイン作成
   - 各例にコピーボタン付き

2. **プラグインカタログ**
   - カテゴリ別整理
   - バンドルサイズ表示
   - インポート文のワンクリックコピー
   - 使用例の展開表示

3. **比較表**
   - 他ライブラリとの機能比較
   - Luqの優位性を視覚的に表現
   - レスポンシブテーブルデザイン

### 国際化（i18n）

- 多言語対応の基盤実装
- 言語切替UI
- RTL言語への対応準備

### テーマシステム

- ライト/ダークモード自動切替
- システム設定連動
- FOUC（Flash of Unstyled Content）防止
- CSS変数による一貫したテーマ管理

### モバイル最適化

- タッチフレンドリーなUI
- スワイプ対応のコードブロック
- 適切なフォントサイズとタップ領域
- ボトムナビゲーション（モバイル時）

### 特徴的なUI要素

1. **ヒーローセクション**
   - グラデーション背景
   - アニメーションエフェクト
   - 明確なCTA（Call to Action）

2. **統計表示**
   - バンドルサイズ「< 10KB」
   - 「100% Type Safe」
   - 「40+ Built-in Plugins」
   - 「0 Dependencies」

3. **インタラクティブカード**
   - ホバー時の浮き上がりエフェクト
   - グラデーションアクセント
   - 情報の段階的表示

これらのUX特徴により、Luqのドキュメントサイトは単なる技術文書を超えて、開発者が楽しみながら学べる体験を提供しています。

---

## プラグインドキュメント生成システム

### 概要

LuqのプラグインドキュメントはJSDocコメントとスクリプトによって自動生成されます。プラグインソースファイルにJSDocコメントを記載し、スクリプトを実行することでドキュメントサイト用のデータファイルが生成されます。

### JSDocコメント仕様

プラグインファイルに以下の形式でJSDocコメントを記載します：

````typescript
/**
 * @luq-plugin
 * @name required
 * @category standard
 * @description Validates that a field is required (not null, undefined, or empty string)
 * @allowedTypes ["string", "number", "boolean", "date", "array", "object", "tuple", "union"]
 * @example
 * ```typescript
 * // Basic usage
 * const validator = Builder()
 *   .use(requiredPlugin)
 *   .for<UserProfile>()
 *   .v("name", (b) => b.string.required())
 *   .v("age", (b) => b.number.required())
 *   .build();
 *
 * // Custom error message
 * builder.v("email", b => b.string.required({
 *   messageFactory: ({ path }) => `${path} is required`
 * }))
 * ```
 * @params
 * - messageFactory?: (context: IssueContext) => string - Custom error message factory
 * @returns Validation function that returns true if value exists (not null/undefined/empty string)
 * @customError
 * ```typescript
 * .required({
 *   messageFactory: ({ path, value }) =>
 *     `${path} field is required (current value: ${value})`
 * })
 * ```
 * @since 0.1.0-alpha
 */
````

### 利用可能なJSDocタグ

- `@luq-plugin` - プラグインであることを示す必須タグ
- `@name` - プラグイン名（例：required, stringMin）
- `@category` - カテゴリ（standard, string, number, boolean, array, object, transform, fieldReference等）
- `@description` - プラグインの説明文
- `@allowedTypes` - 使用可能な型の配列
- `@example` - 使用例のコードブロック（複数可）
- `@params` - パラメータの説明（リスト形式）
- `@returns` - 戻り値の説明
- `@customError` - カスタムエラーメッセージの例
- `@since` - バージョン情報

### ドキュメント生成スクリプト

#### 現在の実装状況

`docs-site/scripts/generate-plugin-docs-from-source.js`スクリプトは以下の処理を行います：

1. `src/core/plugin/index.ts`からエクスポートされているプラグインを検出
2. プラグイン名に基づいてハードコードされたメタデータを参照
3. TypeScriptファイル（`docs-site/src/data/plugins.ts`）とJSONファイル（`docs-site/src/data/plugins.json`）を生成

**注意**: 現在のスクリプトはJSDocコメントを実際にパースしていません。代わりにハードコードされたメタデータオブジェクトを使用しています。

#### 実行方法

```bash
# docs-siteディレクトリで実行
cd docs-site

# 既存のスクリプト（ハードコードされたメタデータを使用）
npm run generate-plugin-docs-from-source

# 新しいスクリプト（JSDocコメントをパース）
npm run generate-plugin-docs-from-jsdoc
```

#### 生成されるファイル

1. **docs-site/src/data/plugins.ts**
   - TypeScript型定義とプラグインデータ
   - ドキュメントサイトのコンポーネントで使用

2. **docs-site/src/data/plugins.json**
   - プラグイン情報のJSONデータ
   - ビルダージェネレーターやその他のツールで使用

### 改善提案

現在のスクリプトを改善し、実際にJSDocコメントをパースするようにすることで、以下のメリットが得られます：

1. **単一の情報源**: プラグインファイルのJSDocコメントが唯一の情報源となる
2. **メンテナンス性向上**: ハードコードされたメタデータの更新が不要
3. **一貫性**: コードとドキュメントの乖離を防ぐ
4. **開発効率**: 新しいプラグイン追加時にスクリプトの更新が不要

改善されたスクリプトは以下の処理を行うべきです：

1. 各プラグインファイルを読み込む
2. JSDocコメントをパース（`@luq-plugin`タグを持つコメントブロックを検索）
3. タグから情報を抽出
4. 抽出した情報を元にドキュメントファイルを生成

これにより、プラグイン開発者はJSDocコメントを記載するだけで、自動的にドキュメントサイトに反映されるようになります。
