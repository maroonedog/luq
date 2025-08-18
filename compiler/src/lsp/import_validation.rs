use tower_lsp::lsp_types::*;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::dependency::analyzer::{DependencyAnalyzer, ValidationErrorKind};

/// インポートバリデーションを実行し、診断情報を生成
pub async fn validate_imports(
    uri: Url,
    analyzer: Arc<RwLock<DependencyAnalyzer>>,
) -> Vec<Diagnostic> {
    let path = match uri.to_file_path() {
        Ok(p) => p,
        Err(_) => return vec![],
    };
    
    let analyzer = analyzer.read().await;
    let mut diagnostics = Vec::new();
    
    // インポートの検証
    let errors = analyzer.validate_imports(&path);
    for error in errors {
        let diagnostic = Diagnostic {
            range: Range {
                // TODO: 実際のインポート文の位置を取得
                start: Position { line: 0, character: 0 },
                end: Position { line: 0, character: 0 },
            },
            severity: Some(match error.kind {
                ValidationErrorKind::UnresolvedModule => DiagnosticSeverity::ERROR,
                ValidationErrorKind::NamedImportNotFound => DiagnosticSeverity::ERROR,
                ValidationErrorKind::ModuleNotAnalyzed => DiagnosticSeverity::WARNING,
                ValidationErrorKind::CircularDependency => DiagnosticSeverity::WARNING,
            }),
            code: Some(NumberOrString::String(format!("luq-import-{:?}", error.kind))),
            source: Some("luq".to_string()),
            message: error.message,
            ..Default::default()
        };
        diagnostics.push(diagnostic);
    }
    
    // 循環依存のチェック
    let cycles = analyzer.detect_circular_dependencies();
    for cycle in cycles {
        if cycle.contains(&path) {
            let cycle_str = cycle.iter()
                .map(|p| p.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("?")
                    .to_string())
                .collect::<Vec<_>>()
                .join(" -> ");
            
            diagnostics.push(Diagnostic {
                range: Range {
                    start: Position { line: 0, character: 0 },
                    end: Position { line: 0, character: 0 },
                },
                severity: Some(DiagnosticSeverity::WARNING),
                code: Some(NumberOrString::String("luq-circular-dependency".to_string())),
                source: Some("luq".to_string()),
                message: format!("Circular dependency detected: {}", cycle_str),
                ..Default::default()
            });
        }
    }
    
    diagnostics
}

/// 未使用エクスポートの診断情報を生成
pub async fn check_unused_exports(
    analyzer: Arc<RwLock<DependencyAnalyzer>>,
) -> Vec<(Url, Vec<Diagnostic>)> {
    let analyzer = analyzer.read().await;
    let unused = analyzer.find_unused_exports();
    let mut results = Vec::new();
    
    for (path, exports) in unused {
        let uri = Url::from_file_path(&path).ok();
        if let Some(uri) = uri {
            let diagnostics: Vec<Diagnostic> = exports.into_iter().map(|export_name| {
                Diagnostic {
                    range: Range {
                        // TODO: 実際のエクスポート文の位置を取得
                        start: Position { line: 0, character: 0 },
                        end: Position { line: 0, character: 0 },
                    },
                    severity: Some(DiagnosticSeverity::HINT),
                    code: Some(NumberOrString::String("luq-unused-export".to_string())),
                    source: Some("luq".to_string()),
                    message: format!("'{}' is exported but never imported", export_name),
                    tags: Some(vec![DiagnosticTag::UNNECESSARY]),
                    ..Default::default()
                }
            }).collect();
            
            results.push((uri, diagnostics));
        }
    }
    
    results
}

/// インポート補完候補を生成
pub async fn get_import_completions(
    uri: &Url,
    position: &Position,
    analyzer: Arc<RwLock<DependencyAnalyzer>>,
) -> Vec<CompletionItem> {
    let mut completions = Vec::new();
    let analyzer = analyzer.read().await;
    
    // TODO: カーソル位置のコンテキストを解析して、適切な補完候補を生成
    // 現在は全エクスポートを候補として返す
    
    for (symbol_name, paths) in &analyzer.graph.export_index {
        for path in paths {
            let relative_path = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown");
            
            completions.push(CompletionItem {
                label: symbol_name.clone(),
                kind: Some(CompletionItemKind::MODULE),
                detail: Some(format!("from {}", relative_path)),
                documentation: Some(Documentation::String(
                    format!("Import {} from {}", symbol_name, relative_path)
                )),
                insert_text: Some(format!("{{ {} }}", symbol_name)),
                ..Default::default()
            });
        }
    }
    
    completions
}