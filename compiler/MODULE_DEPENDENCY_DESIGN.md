# Luq モジュール依存グラフシステム設計

## 概要

Luqファイル間の依存関係を追跡し、import/exportの検証とインテリセンスを提供するシステム。

## 新しい構文サポート

### Import文
```luq
// Named imports
import { UserValidator, validateEmail } from "./validators/user.luq";
import { type User } from "./types/user.ts";  // TypeScriptからの型インポート

// Default import
import defaultValidator from "./default.luq";

// Namespace import
import * as validators from "./validators/index.luq";
```

### Export文
```luq
// Named exports
export interface UserValidator {
    @required
    name: string;
}

export function validatePhone(value: string): boolean {
    return /^\+?[1-9]\d{1,14}$/.test(value);
}

// Default export
export default interface MainValidator {
    // ...
}

// Re-export
export { UserValidator } from "./user.luq";
export * from "./common.luq";
```

## アーキテクチャ

### 1. 依存グラフ構造

```rust
// src/dependency/graph.rs
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct DependencyGraph {
    // ファイルパス -> 依存情報
    nodes: HashMap<PathBuf, ModuleNode>,
    // エクスポートシンボルのグローバルインデックス
    export_index: HashMap<String, Vec<PathBuf>>,
}

#[derive(Debug, Clone)]
pub struct ModuleNode {
    pub path: PathBuf,
    pub imports: Vec<ImportInfo>,
    pub exports: Vec<ExportInfo>,
    pub dependencies: HashSet<PathBuf>,  // このモジュールが依存するファイル
    pub dependents: HashSet<PathBuf>,    // このモジュールに依存するファイル
    pub last_modified: SystemTime,
    pub cached_ast: Option<Program>,
}

#[derive(Debug, Clone)]
pub struct ImportInfo {
    pub source: String,  // "./user.luq"
    pub resolved_path: Option<PathBuf>,
    pub specifiers: Vec<ImportSpecifier>,
    pub span: Span,
}

#[derive(Debug, Clone)]
pub enum ImportSpecifier {
    Named { name: String, alias: Option<String> },
    Default(String),
    Namespace(String),
}

#[derive(Debug, Clone)]
pub struct ExportInfo {
    pub name: String,
    pub kind: ExportKind,
    pub type_annotation: Option<TypeAnnotation>,
}

#[derive(Debug, Clone)]
pub enum ExportKind {
    Interface,
    Function,
    TypeAlias,
    Variable,
    ReExport(String),  // source path
}
```

### 2. インポート解決器

```rust
// src/dependency/resolver.rs
use std::path::{Path, PathBuf};

pub struct ImportResolver {
    // プロジェクトルート
    root: PathBuf,
    // node_modules パス
    node_modules: Vec<PathBuf>,
    // パスエイリアス (tsconfig.jsonのpaths相当)
    path_aliases: HashMap<String, Vec<String>>,
}

impl ImportResolver {
    pub async fn resolve(&self, from: &Path, import_path: &str) -> Result<PathBuf> {
        // 相対パスの解決
        if import_path.starts_with("./") || import_path.starts_with("../") {
            return self.resolve_relative(from, import_path);
        }
        
        // エイリアスの解決
        if let Some(alias_paths) = self.resolve_alias(import_path) {
            return Ok(alias_paths[0].clone());
        }
        
        // node_modulesからの解決
        self.resolve_from_node_modules(import_path)
    }
    
    fn resolve_relative(&self, from: &Path, import_path: &str) -> Result<PathBuf> {
        let base_dir = from.parent().unwrap();
        let mut resolved = base_dir.join(import_path);
        
        // 拡張子の補完
        if !resolved.exists() {
            for ext in &[".luq", ".ts", ".js", "/index.luq"] {
                let with_ext = format!("{}{}", resolved.display(), ext);
                let path = PathBuf::from(with_ext);
                if path.exists() {
                    return Ok(path);
                }
            }
        }
        
        Ok(resolved)
    }
}
```

### 3. 循環依存検出

```rust
// src/dependency/cycle_detector.rs
use petgraph::graph::DiGraph;
use petgraph::algo::kosaraju_scc;

pub struct CycleDetector {
    graph: DiGraph<PathBuf, ()>,
    path_to_node: HashMap<PathBuf, NodeIndex>,
}

impl CycleDetector {
    pub fn detect_cycles(&self) -> Vec<Vec<PathBuf>> {
        // Kosaraju's algorithmで強連結成分を検出
        let sccs = kosaraju_scc(&self.graph);
        
        // サイズ2以上の強連結成分が循環依存
        sccs.into_iter()
            .filter(|scc| scc.len() > 1)
            .map(|scc| {
                scc.into_iter()
                    .map(|idx| self.graph[idx].clone())
                    .collect()
            })
            .collect()
    }
    
    pub fn add_dependency(&mut self, from: PathBuf, to: PathBuf) {
        let from_idx = self.get_or_create_node(from);
        let to_idx = self.get_or_create_node(to);
        self.graph.add_edge(from_idx, to_idx, ());
    }
}
```

### 4. LSPでのデバウンス実装

```rust
// src/lsp/debouncer.rs
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration, Instant};
use std::sync::Arc;

pub struct Debouncer {
    delay: Duration,
    last_trigger: Arc<Mutex<Option<Instant>>>,
    pending_task: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl Debouncer {
    pub fn new(delay_ms: u64) -> Self {
        Self {
            delay: Duration::from_millis(delay_ms),
            last_trigger: Arc::new(Mutex::new(None)),
            pending_task: Arc::new(Mutex::new(None)),
        }
    }
    
    pub async fn debounce<F, Fut>(&self, f: F)
    where
        F: FnOnce() -> Fut + Send + 'static,
        Fut: Future<Output = ()> + Send,
    {
        let now = Instant::now();
        
        // 既存のタスクをキャンセル
        let mut pending = self.pending_task.lock().await;
        if let Some(handle) = pending.take() {
            handle.abort();
        }
        
        // 新しいタスクをスケジュール
        let delay = self.delay;
        let task = tokio::spawn(async move {
            sleep(delay).await;
            f().await;
        });
        
        *pending = Some(task);
        *self.last_trigger.lock().await = Some(now);
    }
}
```

### 5. LSPサーバーの更新

```rust
// src/lsp/server.rs の更新
pub struct LuqLanguageServer {
    client: Client,
    ast_cache: Arc<RwLock<HashMap<Url, Program>>>,
    document_map: Arc<RwLock<HashMap<Url, String>>>,
    dependency_graph: Arc<RwLock<DependencyGraph>>,  // 追加
    import_resolver: Arc<ImportResolver>,             // 追加
    validation_debouncer: Debouncer,                  // 追加
}

impl LuqLanguageServer {
    async fn did_change(&self, params: DidChangeTextDocumentParams) {
        let uri = params.text_document.uri.clone();
        
        // デバウンス処理（500ms待機）
        let graph = Arc::clone(&self.dependency_graph);
        let resolver = Arc::clone(&self.import_resolver);
        let client = self.client.clone();
        
        self.validation_debouncer.debounce(move || async move {
            // バリデーション実行
            validate_imports(uri, graph, resolver, client).await;
        }).await;
    }
    
    async fn did_save(&self, params: DidSaveTextDocumentParams) {
        // 保存時は即座に完全なバリデーション実行
        self.validate_full(params.text_document.uri).await;
    }
}

async fn validate_imports(
    uri: Url,
    graph: Arc<RwLock<DependencyGraph>>,
    resolver: Arc<ImportResolver>,
    client: Client,
) {
    let path = uri.to_file_path().unwrap();
    let mut diagnostics = Vec::new();
    
    // インポートの解決と検証
    let graph = graph.read().await;
    if let Some(node) = graph.get_node(&path) {
        for import in &node.imports {
            // インポートパスの解決
            match resolver.resolve(&path, &import.source).await {
                Ok(resolved) => {
                    // エクスポートされているか確認
                    if let Some(target_node) = graph.get_node(&resolved) {
                        for spec in &import.specifiers {
                            if !validate_import_specifier(spec, target_node) {
                                diagnostics.push(Diagnostic {
                                    range: to_lsp_range(import.span),
                                    severity: Some(DiagnosticSeverity::ERROR),
                                    message: format!("Cannot find '{}' in '{}'", 
                                        spec.name(), import.source),
                                    ..Default::default()
                                });
                            }
                        }
                    }
                }
                Err(e) => {
                    diagnostics.push(Diagnostic {
                        range: to_lsp_range(import.span),
                        severity: Some(DiagnosticSeverity::ERROR),
                        message: format!("Cannot resolve module '{}'", import.source),
                        ..Default::default()
                    });
                }
            }
        }
    }
    
    // 循環依存チェック
    let cycles = graph.detect_cycles();
    for cycle in cycles {
        if cycle.contains(&path) {
            diagnostics.push(Diagnostic {
                range: Range::default(),
                severity: Some(DiagnosticSeverity::WARNING),
                message: format!("Circular dependency detected: {}", 
                    cycle.iter().map(|p| p.display().to_string()).collect::<Vec<_>>().join(" -> ")),
                ..Default::default()
            });
        }
    }
    
    client.publish_diagnostics(uri, diagnostics, None).await;
}
```

## パフォーマンス最適化

### 1. インクリメンタル更新
- ファイル変更時は、そのファイルと依存するファイルのみ再解析
- 依存グラフの差分更新

### 2. キャッシュ戦略
```rust
pub struct ModuleCache {
    // パース済みAST
    ast_cache: LruCache<PathBuf, (SystemTime, Program)>,
    // 解決済みインポートパス
    resolution_cache: LruCache<(PathBuf, String), PathBuf>,
    // エクスポートシンボル
    export_cache: LruCache<PathBuf, Vec<ExportInfo>>,
}
```

### 3. 並列処理
```rust
// 複数ファイルの依存解析を並列実行
pub async fn analyze_workspace(root: PathBuf) -> Result<DependencyGraph> {
    let files = glob::glob(&format!("{}/**/*.luq", root.display()))?;
    
    let tasks: Vec<_> = files
        .map(|path| {
            tokio::spawn(async move {
                parse_and_analyze_file(path).await
            })
        })
        .collect();
    
    let results = futures::future::join_all(tasks).await;
    build_dependency_graph(results)
}
```

## 利用例

### 1. 未定義インポートの検出
```luq
// user.luq
import { NonExistent } from "./types.luq";  // Error: Cannot find 'NonExistent'
```

### 2. 循環依存の警告
```luq
// a.luq
import { B } from "./b.luq";

// b.luq
import { A } from "./a.luq";  // Warning: Circular dependency detected
```

### 3. オートコンプリート
```luq
import { | } from "./validators.luq";
         ↑ 利用可能なエクスポートを提案
```

### 4. Go to Definition
```luq
import { UserValidator } from "./types.luq";
         ~~~~~~~~~~~~~ Ctrl+Click で定義元へジャンプ
```

## 実装優先順位

1. **Phase 1**: 基本的なimport/export文のパース
2. **Phase 2**: 依存グラフ構築とインポート解決
3. **Phase 3**: LSPでのデバウンス実装
4. **Phase 4**: 循環依存検出
5. **Phase 5**: オートコンプリートとGo to Definition

これにより、大規模なLuqプロジェクトでも効率的にモジュール間の依存関係を管理できます。