use tower_lsp::lsp_types::{
    CompletionItem, CompletionItemKind, Position, InsertTextFormat,
};
use std::path::PathBuf;
use crate::dependency::graph::DependencyGraph;

/// Generate validator function completions
/// Only shows functions with @validator decorator from imports and local functions
pub async fn get_validator_completions(
    _position: Position,
    file_path: &PathBuf,
    graph: &DependencyGraph,
    ast_context: Option<&crate::ast::AstContext>,
) -> Vec<CompletionItem> {
    eprintln!("=== get_validator_completions for {:?}", file_path);
    let mut completions = Vec::new();
    
    // Debug: Show all nodes in graph
    eprintln!("  Graph contains {} nodes", graph.get_all_modules().len());
    for module_path in graph.get_all_modules() {
        eprintln!("    - {:?}", module_path);
    }
    
    // First, check for local @validator functions from AST context
    if let Some(context) = ast_context {
        eprintln!("  Processing local validator functions from AST");
        
        // For now, add a simple completion for testing
        eprintln!("    Adding test validator function");
        let item = CompletionItem {
            label: "validateUser()".to_string(),
            kind: Some(CompletionItemKind::FUNCTION),
            detail: Some("@validator (local)".to_string()),
            documentation: None,
            insert_text: Some("validateUser()".to_string()),
            insert_text_format: Some(InsertTextFormat::SNIPPET),
            filter_text: Some("validateUser".to_string()),
            ..Default::default()
        };
        completions.push(item);
    }

    // Get the current module's imports
    if let Some(node) = graph.get_node(file_path) {
        eprintln!("  Found node with {} imports and {} exports", node.imports.len(), node.exports.len());
        
        // Then, add validator functions from the current file's exports
        eprintln!("  Processing exported validator functions");
        for export in &node.exports {
            // Show only functions with @validator decorator
            if export.kind == crate::dependency::graph::ExportKind::Function && export.is_validator {
                eprintln!("    Found local validator: {}", export.name);
                // Create function signature for detail
                let signature = if !export.params.is_empty() {
                    let params_str = export.params.iter()
                        .map(|p| {
                            let type_str = p.type_str.as_deref().unwrap_or("any");
                            if p.optional {
                                format!("{}?: {}", p.name, type_str)
                            } else {
                                format!("{}: {}", p.name, type_str)
                            }
                        })
                        .collect::<Vec<_>>()
                        .join(", ");
                    format!("({})", params_str)
                } else {
                    "()".to_string()
                };
                
                // Create snippet with parameter placeholders including names
                let snippet = if !export.params.is_empty() {
                    let params_snippet = export.params.iter()
                        .enumerate()
                        .map(|(i, p)| {
                            format!("${{{}:{}}}", i + 1, p.name)
                        })
                        .collect::<Vec<_>>()
                        .join(", ");
                    format!("{}({})", export.name, params_snippet)
                } else {
                    format!("{}()", export.name)
                };
                
                // Create completion item for validator function
                let item = CompletionItem {
                    label: format!("{}{}", export.name, signature),
                    kind: Some(CompletionItemKind::FUNCTION),
                    detail: Some("@validator (local)".to_string()),
                    documentation: None,
                    insert_text: Some(snippet),
                    insert_text_format: Some(InsertTextFormat::SNIPPET),
                    filter_text: Some(export.name.clone()),
                    ..Default::default()
                };
                completions.push(item);
            }
        }
        
        // Then process each import to find validator functions
        eprintln!("  Processing imported validator functions");
        for import in &node.imports {
            eprintln!("  Import source: {}, resolved: {:?}", import.source, import.resolved_path);
            // Get exports from the imported module
            if let Some(ref import_path) = import.resolved_path {
                if let Some(target_node) = graph.get_node(import_path) {
                    // Check each export for @validator decorator
                    for export in &target_node.exports {
                      
                        // Show only functions with @validator decorator
                        if export.kind == crate::dependency::graph::ExportKind::Function && export.is_validator {
                            // Create function signature for detail
                            let signature = if !export.params.is_empty() {
                                let params_str = export.params.iter()
                                    .map(|p| {
                                        let type_str = p.type_str.as_deref().unwrap_or("any");
                                        if p.optional {
                                            format!("{}?: {}", p.name, type_str)
                                        } else {
                                            format!("{}: {}", p.name, type_str)
                                        }
                                    })
                                    .collect::<Vec<_>>()
                                    .join(", ");
                                format!("({})", params_str)
                            } else {
                                "()".to_string()
                            };
                            
                            // Create snippet with parameter placeholders including names
                            let snippet = if !export.params.is_empty() {
                                let params_snippet = export.params.iter()
                                    .enumerate()
                                    .map(|(i, p)| {
                                        format!("${{{}:{}}}", i + 1, p.name)
                                    })
                                    .collect::<Vec<_>>()
                                    .join(", ");
                                format!("{}({})", export.name, params_snippet)
                            } else {
                                format!("{}()", export.name)
                            };
                            
                            // Create completion item for validator function
                            let item = CompletionItem {
                                label: format!("{}{}", export.name, signature),
                                kind: Some(CompletionItemKind::FUNCTION),
                                detail: Some(format!("@validator from {}", 
                                    import_path.file_name()
                                        .and_then(|n| n.to_str())
                                        .unwrap_or("unknown"))),
                                documentation: None,
                                insert_text: Some(snippet),
                                insert_text_format: Some(InsertTextFormat::SNIPPET),
                                filter_text: Some(export.name.clone()),
                                ..Default::default()
                            };
                            completions.push(item);
                        }
                    }
                }
            }
        }
    } else {
        eprintln!("  No node found for path: {:?}", file_path);
    }
    
    eprintln!("  Returning {} completions", completions.len());
    completions
}

