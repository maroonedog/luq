use tower_lsp::lsp_types::*;

/// Get decorator completions for @ trigger
/// Returns empty vector as all decorators should be imported before use
pub fn get_decorator_completions() -> Vec<CompletionItem> {
    // All decorators must be imported before use
    // No default/built-in decorators are provided
    vec![]
}