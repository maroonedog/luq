use tower_lsp::lsp_types::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::ast::Program;
use crate::dependency::DependencyGraph;

/// Get all available functions (both local and imported, excluding @validator functions)
pub async fn get_available_functions(
    uri: &Url,
    ast_cache: &Arc<RwLock<HashMap<Url, Program>>>,
    dependency_graph: &Arc<RwLock<DependencyGraph>>,
) -> Vec<CompletionItem> {
    let mut completions = Vec::new();
    
    // Get local functions
    completions.extend(get_local_functions(uri, ast_cache).await);
    
    // Get imported functions
    completions.extend(get_imported_functions(uri, dependency_graph).await);
    
    completions
}

/// Get non-validator functions from the current file
async fn get_local_functions(
    _uri: &Url,
    _ast_cache: &Arc<RwLock<HashMap<Url, Program>>>,
) -> Vec<CompletionItem> {
    // TODO: Implement once context_cache is available in this module
    // For now, return empty since we need AstContext to check decorators and get function names
    Vec::new()
}

/// Get imported functions from dependency graph
async fn get_imported_functions(
    uri: &Url,
    dependency_graph: &Arc<RwLock<DependencyGraph>>,
) -> Vec<CompletionItem> {
    let completions = Vec::new();
    let graph = dependency_graph.read().await;
    
    if let Some(path) = uri.to_file_path().ok() {
        if let Some(node) = graph.get_node(&path) {
            // Process each import
            for _import in &node.imports {
                // Add completion for each imported specifier
                // TODO: Process import specifiers once we have context to convert StringId
                // For now, skip processing imports as we need AstContext
            }
        }
    }
    
    completions
}

// TODO: Implement function documentation generation for new AST when needed

/// Generate function call snippet
#[allow(dead_code)]
fn generate_function_call(name: &str, param_count: usize) -> String {
    if param_count == 0 {
        format!("{}()${{0}}", name)
    } else {
        let params = (1..=param_count)
            .map(|i| format!("${{{}:arg{}}}", i, i))
            .collect::<Vec<_>>()
            .join(", ");
        format!("{}({})", name, params)
    }
}

/// Shorten import path for display
#[allow(dead_code)]
fn shorten_import_path(path: &str) -> String {
    if path.len() > 30 {
        if let Some(last_slash) = path.rfind('/') {
            return format!("...{}", &path[last_slash..]);
        }
    }
    path.to_string()
}