use tower_lsp::lsp_types::*;

pub async fn get_completions(params: &CompletionParams) -> Vec<CompletionItem> {
    let mut completions = vec![];
    
    // Get context from position
    let trigger_char = params.context.as_ref()
        .and_then(|ctx| ctx.trigger_character.as_deref());
    
    match trigger_char {
        Some("@") => {
            // Decorator completions
            completions.extend(get_decorator_completions());
        }
        _ => {
            // Type completions
            completions.extend(get_type_completions());
        }
    }
    
    completions
}

fn get_decorator_completions() -> Vec<CompletionItem> {
    vec![
        CompletionItem {
            label: "required".to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            detail: Some("Mark field as required (not null/undefined)".to_string()),
            documentation: Some(Documentation::String(
                "Validates that the field has a value".to_string()
            )),
            insert_text: Some("required".to_string()),
            ..Default::default()
        },
        CompletionItem {
            label: "optional".to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            detail: Some("Mark field as optional".to_string()),
            insert_text: Some("optional".to_string()),
            ..Default::default()
        },
        CompletionItem {
            label: "min".to_string(),
            kind: Some(CompletionItemKind::FUNCTION),
            detail: Some("Set minimum value or length".to_string()),
            documentation: Some(Documentation::String(
                "For numbers: minimum value\nFor strings/arrays: minimum length".to_string()
            )),
            insert_text: Some("min(${1:value})".to_string()),
            insert_text_format: Some(InsertTextFormat::SNIPPET),
            ..Default::default()
        },
        CompletionItem {
            label: "max".to_string(),
            kind: Some(CompletionItemKind::FUNCTION),
            detail: Some("Set maximum value or length".to_string()),
            insert_text: Some("max(${1:value})".to_string()),
            insert_text_format: Some(InsertTextFormat::SNIPPET),
            ..Default::default()
        },
        CompletionItem {
            label: "email".to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            detail: Some("Validate email format".to_string()),
            insert_text: Some("email".to_string()),
            ..Default::default()
        },
        CompletionItem {
            label: "pattern".to_string(),
            kind: Some(CompletionItemKind::FUNCTION),
            detail: Some("Match against regex pattern".to_string()),
            insert_text: Some("pattern(/${1:regex}/)".to_string()),
            insert_text_format: Some(InsertTextFormat::SNIPPET),
            ..Default::default()
        },
        CompletionItem {
            label: "nullable".to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            detail: Some("Allow null value".to_string()),
            insert_text: Some("nullable".to_string()),
            ..Default::default()
        },
        CompletionItem {
            label: "arrayMin".to_string(),
            kind: Some(CompletionItemKind::FUNCTION),
            detail: Some("Set minimum array length".to_string()),
            insert_text: Some("arrayMin(${1:length})".to_string()),
            insert_text_format: Some(InsertTextFormat::SNIPPET),
            ..Default::default()
        },
        CompletionItem {
            label: "arrayMax".to_string(),
            kind: Some(CompletionItemKind::FUNCTION),
            detail: Some("Set maximum array length".to_string()),
            insert_text: Some("arrayMax(${1:length})".to_string()),
            insert_text_format: Some(InsertTextFormat::SNIPPET),
            ..Default::default()
        },
        CompletionItem {
            label: "validator".to_string(),
            kind: Some(CompletionItemKind::KEYWORD),
            detail: Some("Mark interface as validator".to_string()),
            documentation: Some(Documentation::String(
                "Applied to interfaces to generate validation code".to_string()
            )),
            insert_text: Some("validator".to_string()),
            ..Default::default()
        },
    ]
}

fn get_type_completions() -> Vec<CompletionItem> {
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
    ]
}