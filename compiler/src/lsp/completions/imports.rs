use tower_lsp::lsp_types::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::ast::Program;
use crate::dependency::DependencyGraph;

/// Check if cursor is in an import statement context
pub fn is_in_import_context(content: &str, position: &Position) -> bool {
    let lines: Vec<&str> = content.lines().collect();
    
    if let Some(line) = lines.get(position.line as usize) {
        let line_before_cursor = &line[..position.character.min(line.len() as u32) as usize];
        
        // Check if line starts with import or contains import
        line_before_cursor.trim_start().starts_with("import") ||
        line_before_cursor.contains("from ")
    } else {
        false
    }
}

/// Get import path completions
pub async fn get_import_completions(
    uri: &Url,
    dependency_graph: &Arc<RwLock<DependencyGraph>>,
) -> Vec<CompletionItem> {
    let mut completions = Vec::new();
    let graph = dependency_graph.read().await;
    
    if let Some(current_path) = uri.to_file_path().ok() {
        let current_dir = current_path.parent();
        
        // Get all available modules
        let available_modules = collect_available_modules(&graph, current_dir);
        
        for (module_path, module_info) in available_modules {
            let relative_path = make_relative_path(&current_path, &module_path);
            
            completions.push(CompletionItem {
                label: relative_path.clone(),
                kind: Some(CompletionItemKind::MODULE),
                detail: Some(format!("{} exports", module_info.export_count)),
                documentation: Some(Documentation::String(
                    format!("Module with exports: {}", module_info.exports.join(", "))
                )),
                insert_text: Some(format!("\"{}\"", relative_path)),
                insert_text_format: Some(InsertTextFormat::PLAIN_TEXT),
                ..Default::default()
            });
        }
    }
    
    completions
}

/// Get member completions after dot (e.g., "module.")
pub async fn get_import_member_completions(
    _uri: &Url,
    position: &Position,
    doc_content: &Option<String>,
    _ast_cache: &Arc<RwLock<HashMap<Url, Program>>>,
    _dependency_graph: &Arc<RwLock<DependencyGraph>>,
) -> Vec<CompletionItem> {
    let completions = Vec::new();
    
    if let Some(content) = doc_content {
        if let Some(_module_name) = extract_module_before_dot(content, position) {
            // TODO: Process imports once we have context to convert StringId
            // For now, skip processing imports as we need AstContext
        }
    }
    
    completions
}

/// Get exports from a specific module
#[allow(dead_code)]
async fn get_module_exports(
    module_path: &str,
    dependency_graph: &Arc<RwLock<DependencyGraph>>,
) -> Vec<CompletionItem> {
    let mut completions = Vec::new();
    let graph = dependency_graph.read().await;
    
    // Resolve module path to actual file
    if let Some(resolved_path) = resolve_module_path(module_path) {
        if let Some(node) = graph.get_node(&resolved_path) {
            for export in &node.exports {
                let kind = if export.name.chars().next().map_or(false, |c| c.is_uppercase()) {
                    CompletionItemKind::CLASS
                } else {
                    CompletionItemKind::FUNCTION
                };
                
                completions.push(CompletionItem {
                    label: export.name.clone(),
                    kind: Some(kind),
                    detail: Some(format!("Export from {}", module_path)),
                    insert_text: Some(export.name.clone()),
                    ..Default::default()
                });
            }
        }
    }
    
    completions
}

/// Extract module name before dot from document content
fn extract_module_before_dot(content: &str, position: &Position) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();
    
    if let Some(line) = lines.get(position.line as usize) {
        if position.character > 0 {
            let line_before_cursor = &line[..(position.character - 1) as usize];
            
            // Find the identifier before the dot
            let chars: Vec<char> = line_before_cursor.chars().collect();
            let mut end = chars.len();
            
            // Find start of identifier
            while end > 0 && (chars[end - 1].is_alphanumeric() || chars[end - 1] == '_') {
                end -= 1;
            }
            
            if end < chars.len() {
                let identifier: String = chars[end..].iter().collect();
                return Some(identifier);
            }
        }
    }
    
    None
}

/// Collect all available modules from dependency graph
fn collect_available_modules(
    graph: &DependencyGraph,
    _current_dir: Option<&std::path::Path>,
) -> HashMap<std::path::PathBuf, ModuleInfo> {
    let mut modules = HashMap::new();
    
    // Collect all modules from the dependency graph
    for path in graph.get_all_modules() {
        if let Some(node) = graph.get_node(path) {
            // Skip files that don't have exports
            if node.exports.is_empty() {
                continue;
            }
            
            // Create module info
            let export_names: Vec<String> = node.exports.iter()
                .map(|e| e.name.clone())
                .collect();
            
            let module_info = ModuleInfo {
                export_count: node.exports.len(),
                exports: export_names,
            };
            
            modules.insert(path.clone(), module_info);
        }
    }
    
    modules
}

/// Make a relative path from current file to target module
fn make_relative_path(from: &std::path::Path, to: &std::path::Path) -> String {
    use std::path::Component;
    
    let from_dir = from.parent().unwrap_or(from);
    let mut from_components: Vec<_> = from_dir.components().collect();
    let mut to_components: Vec<_> = to.components().collect();
    
    // Remove common prefix
    while !from_components.is_empty() && !to_components.is_empty() {
        if from_components[0] == to_components[0] {
            from_components.remove(0);
            to_components.remove(0);
        } else {
            break;
        }
    }
    
    // Build relative path
    let mut result = String::new();
    
    if from_components.is_empty() && to_components.is_empty() {
        result.push_str("./");
    } else {
        // Add ../ for each remaining from component
        for _ in from_components {
            result.push_str("../");
        }
        
        // Add to components
        for (i, comp) in to_components.iter().enumerate() {
            if let Component::Normal(name) = comp {
                result.push_str(&name.to_string_lossy());
                if i < to_components.len() - 1 {
                    result.push('/');
                }
            }
        }
    }
    
    // Remove .luq extension for cleaner imports
    if result.ends_with(".luq") {
        result.truncate(result.len() - 4);
    }
    
    result
}

/// Resolve module path to actual file path
#[allow(dead_code)]
fn resolve_module_path(module_path: &str) -> Option<std::path::PathBuf> {
    use std::path::PathBuf;
    
    let mut path = PathBuf::from(module_path);
    
    // Add .luq extension if not present
    if path.extension().is_none() {
        path.set_extension("luq");
    }
    
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

/// Get generic object member completions
#[allow(dead_code)]
fn get_generic_object_members() -> Vec<CompletionItem> {
    vec![
        CompletionItem {
            label: "toString".to_string(),
            kind: Some(CompletionItemKind::METHOD),
            detail: Some("() => string".to_string()),
            insert_text: Some("toString()".to_string()),
            ..Default::default()
        },
        CompletionItem {
            label: "valueOf".to_string(),
            kind: Some(CompletionItemKind::METHOD),
            detail: Some("() => any".to_string()),
            insert_text: Some("valueOf()".to_string()),
            ..Default::default()
        },
    ]
}

struct ModuleInfo {
    export_count: usize,
    exports: Vec<String>,
}