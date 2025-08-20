#![allow(dead_code)]

mod decorators;
mod types;
mod validators;
mod functions;
mod imports;

use tower_lsp::lsp_types::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::ast::Program;
use crate::dependency::DependencyGraph;

pub async fn get_completions(
    params: &CompletionParams,
    ast_cache: &Arc<RwLock<HashMap<Url, Program>>>,
    context_cache: &Arc<RwLock<HashMap<Url, Arc<crate::ast::AstContext>>>>,
    dependency_graph: &Arc<RwLock<DependencyGraph>>,
    document_map: &Arc<RwLock<HashMap<Url, String>>>,
) -> Vec<CompletionItem> {
    eprintln!("=== get_completions called ===");
    let mut completions = vec![];
    
    // Get context from position
    let trigger_char = params.context.as_ref()
        .and_then(|ctx| ctx.trigger_character.as_deref());
    eprintln!("  Trigger char: {:?}", trigger_char);
    
    let uri = &params.text_document_position.text_document.uri;
    let position = &params.text_document_position.position;
    eprintln!("  URI: {:?}", uri);
    eprintln!("  Position: {:?}", position);
    
    // Get document content for context analysis
    let doc_content = document_map.read().await.get(uri).cloned();
    
    match trigger_char {
        Some("@") => {
            eprintln!("  Handling @ trigger");
            // Show only imported @validator decorated functions
            // No default decorators are provided - everything must be imported
            let graph = dependency_graph.read().await;
            eprintln!("  Got dependency graph");
            // Properly convert URI to file path
            if let Ok(path) = uri.to_file_path() {
                eprintln!("  Getting validator completions for path: {:?}", path);
                let context = context_cache.read().await.get(uri).cloned();
                let validator_completions = validators::get_validator_completions(*position, &path, &*graph, context.as_deref()).await;
                eprintln!("  Got {} validator completions", validator_completions.len());
                completions.extend(validator_completions);
            } else {
                eprintln!("  Failed to convert URI to file path: {:?}", uri);
            }
        }
        Some(".") => {
            // Member access completions (future enhancement)
            completions.extend(
                imports::get_import_member_completions(
                    uri, 
                    position, 
                    &doc_content,
                    ast_cache, 
                    dependency_graph
                ).await
            );
        }
        _ => {
            // Check if we're in an import statement
            if let Some(ref content) = doc_content {
                if imports::is_in_import_context(content, position) {
                    completions.extend(
                        imports::get_import_completions(uri, dependency_graph).await
                    );
                } else {
                    // Only show @validator decorated functions from imports
                    // Do not show local functions or non-validator functions
                    let graph = dependency_graph.read().await;
                    if let Ok(path) = uri.to_file_path() {
                        let context = context_cache.read().await.get(uri).cloned();
                        completions.extend(
                            validators::get_validator_completions(*position, &path, &*graph, context.as_deref()).await
                        );
                    }
                    // Optionally show types (but not specific local names)
                    completions.extend(types::get_type_completions());
                }
            } else {
                // Fallback - only show validator functions
                let graph = dependency_graph.read().await;
                if let Ok(path) = uri.to_file_path() {
                    let context = context_cache.read().await.get(uri).cloned();
                    completions.extend(
                        validators::get_validator_completions(*position, &path, &*graph, context.as_deref()).await
                    );
                }
                completions.extend(types::get_type_completions());
            }
        }
    }
    
    completions
}