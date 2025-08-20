use tower_lsp::lsp_types::*;

/// Get type completions
pub fn get_type_completions() -> Vec<CompletionItem> {
    vec![
        CompletionItem {
            label: "string".to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            detail: Some("String type".to_string()),
            ..Default::default()
        },
        CompletionItem {
            label: "number".to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            detail: Some("Number type".to_string()),
            ..Default::default()
        },
        CompletionItem {
            label: "boolean".to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            detail: Some("Boolean type".to_string()),
            ..Default::default()
        },
        CompletionItem {
            label: "null".to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            detail: Some("Null type".to_string()),
            ..Default::default()
        },
        CompletionItem {
            label: "undefined".to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            detail: Some("Undefined type".to_string()),
            ..Default::default()
        },
        CompletionItem {
            label: "any".to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            detail: Some("Any type".to_string()),
            ..Default::default()
        },
        CompletionItem {
            label: "void".to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            detail: Some("Void type".to_string()),
            ..Default::default()
        },
    ]
}