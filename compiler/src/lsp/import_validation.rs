use tower_lsp::lsp_types::*;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::ast::Program;
use crate::dependency::{DependencyGraph, ImportResolver};
use crate::dependency::analyzer::{DependencyAnalyzer, ValidationErrorKind};

/// インポートバリデーションを実行し、診断情報を生成
pub async fn validate_imports(
    path: &Path,
    _program: &Program,
    _dependency_graph: &Arc<RwLock<DependencyGraph>>,
    _import_resolver: &Arc<ImportResolver>,
) -> Vec<Diagnostic> {
    // Create analyzer with project root (use parent directory as project root)
    let project_root = path.parent().unwrap_or(Path::new("/")).to_path_buf();
    let analyzer = DependencyAnalyzer::new(project_root);
    let mut diagnostics = Vec::new();
    
    // インポートの検証
    let errors = analyzer.validate_imports(&path.to_path_buf());
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
        if cycle.contains(&path.to_path_buf()) {
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
    path: &Path,
    _program: &Program,
    _dependency_graph: &Arc<RwLock<DependencyGraph>>,
) -> Vec<Diagnostic> {
    let project_root = path.parent().unwrap_or(Path::new("/")).to_path_buf();
    let analyzer = DependencyAnalyzer::new(project_root);
    let unused = analyzer.find_unused_exports();
    let mut diagnostics = Vec::new();
    
    // 現在のファイルの未使用エクスポートのみ取得
    if let Some(exports) = unused.get(path) {
        for export_name in exports {
            diagnostics.push(Diagnostic {
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
            });
        }
    }
    
    diagnostics
}

/// インポート補完候補を生成
pub async fn get_import_completions(
    _uri: &Url,
    _position: &Position,
    _analyzer: Arc<RwLock<DependencyAnalyzer>>,
) -> Vec<CompletionItem> {
    // TODO: Implement import completions properly
    // Currently returning empty list until we have public access to export index
    Vec::new()
}