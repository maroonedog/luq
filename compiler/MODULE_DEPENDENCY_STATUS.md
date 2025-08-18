# モジュール依存グラフシステム - 実装状況

## ✅ 実装済み機能

### 1. 依存グラフ構造 (`src/dependency/graph.rs`)
- ✅ モジュールノードの管理
- ✅ インポート/エクスポート情報の追跡
- ✅ 双方向の依存関係（dependencies/dependents）
- ✅ エクスポートシンボルのグローバルインデックス
- ✅ 影響範囲の計算（ファイル変更時）

### 2. インポート解決器 (`src/dependency/resolver.rs`)
- ✅ 相対パスの解決（`./`, `../`）
- ✅ エイリアスの解決（`@`, `~`）
- ✅ node_modulesからの解決
- ✅ 拡張子の自動補完（`.luq`, `.ts`, `.js`）
- ✅ indexファイルの解決
- ✅ package.jsonのmain/typesフィールド対応

### 3. 循環依存検出 (`src/dependency/cycle_detector.rs`)
- ✅ Tarjanのアルゴリズムによる強連結成分検出
- ✅ 循環依存パスの可視化
- ✅ 特定ファイルの循環依存チェック

### 4. デバウンス処理 (`src/lsp/debouncer.rs`)
- ✅ 連続した変更を遅延実行
- ✅ ファイル保存時の即座実行
- ✅ ファイルごとの独立したデバウンサー管理
- ✅ 設定可能な遅延時間（デフォルト500ms）

### 5. 包括的な分析機能 (`src/dependency/analyzer.rs`)
- ✅ ワークスペース全体の分析
- ✅ インポート検証
- ✅ 未使用エクスポートの検出
- ✅ 統計情報の収集

### 6. AST拡張
- ✅ Function宣言のサポート (`src/ast/function.rs`)
- ✅ Import/Export文の構造定義
- ✅ 関数パラメータと本体の表現

### 7. LSP統合 (`src/lsp/import_validation.rs`)
- ✅ インポートエラーの診断
- ✅ 循環依存の警告
- ✅ 未使用エクスポートのヒント
- ✅ インポート補完候補の生成

## ✅ パーサーへの統合（実装済み）

import/export文と関数宣言のパース機能が実装されました。

### 実装済み機能:

1. **import文のパース** (`parse_import`)
   - ✅ Named imports: `import { a, b } from "./file"`
   - ✅ Default imports: `import Foo from "./file"`
   - ✅ Type-only imports: `import { type User } from "./file"`
   - ✅ エイリアス: `import { a as b } from "./file"`
   - ✅ Namespace imports: `import * as ns from "./file"`
   - ✅ Dynamic imports: `import("./file")` in expressions

2. **export文のパース** (`parse_export`)
   - ✅ Named exports: `export interface Foo {}`
   - ✅ Function exports: `export function bar() {}`
   - ✅ Default exports: `export default interface {}`
   - ✅ Re-exports: `export { a, b as c } from "./file"`
   - ✅ Namespace exports: `export * from "./file"`

3. **関数宣言のパース** (`parse_function`)
   - ✅ 関数名とパラメータ
   - ✅ 戻り値の型注釈
   - ✅ オプショナルパラメータ
   - ✅ 完全な関数本体パース（式、return文、二項演算）
   - ✅ 関数呼び出し、メンバーアクセス
   - ✅ 動的インポート式の処理

4. **extends句のパース**
   - ✅ Interface extends: `interface A extends B {}`

5. **式パース** (`parse_expression`)
   - ✅ 二項演算（+, -, *, /, ==, <, >, &&, ||）
   - ✅ 関数呼び出し: `func(arg1, arg2)`
   - ✅ メンバーアクセス: `obj.property`
   - ✅ 括弧でのグループ化: `(expression)`
   - ✅ リテラル（文字列、数値、真偽値、null、undefined）
   - ✅ 識別子の参照

6. **エラー診断の改善**
   - ✅ 正確な行・列番号の表示
   - ✅ コンテキストに応じたエラーメッセージ
   - ✅ トークン位置情報の活用

## 📝 使用例

### 依存分析の実行

```rust
use luq_compiler::dependency::analyzer::DependencyAnalyzer;

#[tokio::main]
async fn main() {
    let mut analyzer = DependencyAnalyzer::new("/project/root".into());
    
    // ワークスペース全体を分析
    analyzer.analyze_workspace(&"/project/root".into()).await.unwrap();
    
    // インポートの検証
    let errors = analyzer.validate_imports(&"user-service.luq".into());
    for error in errors {
        println!("Import error: {}", error.message);
    }
    
    // 循環依存の検出
    let cycles = analyzer.detect_circular_dependencies();
    for cycle in cycles {
        println!("Circular dependency: {:?}", cycle);
    }
    
    // 未使用エクスポートの検出
    let unused = analyzer.find_unused_exports();
    for (file, exports) in unused {
        println!("{:?} has unused exports: {:?}", file, exports);
    }
}
```

### LSPサーバーでの利用

```rust
// ファイル変更時（デバウンス）
async fn did_change(&self, params: DidChangeTextDocumentParams) {
    let uri = params.text_document.uri.clone();
    
    self.file_debouncer.debounce_file_change(
        uri.to_file_path().unwrap(),
        move || async move {
            // 500ms後に実行
            let diagnostics = validate_imports(uri, analyzer).await;
            client.publish_diagnostics(uri, diagnostics, None).await;
        }
    ).await;
}

// ファイル保存時（即座に実行）
async fn did_save(&self, params: DidSaveTextDocumentParams) {
    let uri = params.text_document.uri.clone();
    
    self.file_debouncer.on_file_save(
        uri.to_file_path().unwrap(),
        move || async move {
            // 即座に完全な検証を実行
            let diagnostics = validate_imports(uri, analyzer).await;
            client.publish_diagnostics(uri, diagnostics, None).await;
        }
    ).await;
}
```

## 🎯 パフォーマンス最適化

### 1. デバウンス戦略
- **変更時**: 500ms待機してから検証（タイピング中の無駄な処理を回避）
- **保存時**: 即座に検証実行
- **ファイルごと**: 独立したデバウンサーで他ファイルの編集に影響なし

### 2. インクリメンタル更新
- 変更されたファイルとその依存先のみ再解析
- キャッシュされたASTを活用
- 影響範囲の計算で最小限の再検証

### 3. 並列処理
- 複数ファイルの解析を並列実行（rayonライブラリ使用）
- 非同期処理でI/Oブロッキングを回避

## 🔍 テストケース

`test-imports/`ディレクトリに以下のテストファイルを用意:

1. **validators.luq**: エクスポートのテスト
   - Named export（関数、インターフェース）
   - Default export

2. **user-service.luq**: インポートのテスト
   - Named import
   - Default import
   - Re-export

3. **circular-a.luq, circular-b.luq**: 循環依存のテスト
   - お互いをインポートする構造

## ✅ すべての制限事項解決済み

以下の制限事項がすべて実装され、解決されました：

1. ✅ **Re-export文**: `export { a } from "./file"` 完全対応
2. ✅ **関数本体**: 完全な関数実装のパース（式、return文）
3. ✅ **位置情報**: 正確な行・列番号エラー診断
4. ✅ **動的インポート**: `import("./file")` 式レベル対応
5. ✅ **名前空間インポート**: `import * as ns from "./file"` 対応

## 🚀 次のステップ

基本的なパースと依存グラフ機能がすべて実装されたため、以下のステップに進むことができます：

1. **LSPサーバーへの依存グラフ統合**
   - リアルタイムの依存関係検証
   - エラー診断の統合
   - 自動補完とホバー情報

2. **VS Code拡張機能での実際の統合テスト**
   - シンタックスハイライト
   - エラー表示
   - 依存関係の可視化

3. **パフォーマンスベンチマーク**
   - 大規模プロジェクトでの性能測定
   - メモリ使用量の最適化
   - インクリメンタル更新の改善

4. **高度な言語機能**
   - ジェネリック型のサポート
   - 条件付き型
   - テンプレートリテラル型

これにより、大規模なLuqプロジェクトでも効率的にモジュール間の依存関係を管理し、開発時の即座のフィードバックを提供できます。