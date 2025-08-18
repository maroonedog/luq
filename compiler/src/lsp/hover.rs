use tower_lsp::lsp_types::*;
use tower_lsp::jsonrpc::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use crate::ast::Program;

pub async fn get_hover(
    params: &HoverParams,
    ast_cache: &Arc<RwLock<HashMap<Url, Program>>>,
) -> Result<Option<Hover>> {
    // デコレーターのドキュメント
    let decorator_docs = HashMap::from([
        ("required", "Ensures the field is not null, undefined, or empty string"),
        ("optional", "Marks the field as optional (can be undefined)"),
        ("min", "Sets minimum value for numbers or minimum length for strings/arrays"),
        ("max", "Sets maximum value for numbers or maximum length for strings/arrays"),
        ("email", "Validates that the string is a valid email address"),
        ("pattern", "Validates the string against a regular expression pattern"),
        ("nullable", "Allows the field to be null"),
        ("validator", "Marks an interface as a validator for code generation"),
    ]);

    // TODO: カーソル位置からトークンを特定
    // 現在は簡単な例として固定のホバー情報を返す
    
    let hover_content = MarkupContent {
        kind: MarkupKind::Markdown,
        value: "**Luq Decorator**\n\nValidation decorator for field validation".to_string(),
    };

    Ok(Some(Hover {
        contents: HoverContents::Markup(hover_content),
        range: None,
    }))
}