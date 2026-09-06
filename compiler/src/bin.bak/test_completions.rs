use luq_compiler::lsp::completions::get_completions;
use luq_compiler::ast::{Program, AstContext};
use luq_compiler::parser::Parser;
use luq_compiler::dependency::DependencyGraph;
use tower_lsp::lsp_types::*;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;

#[tokio::main]
async fn main() {
    let code = r#"
export interface User {
    id: string;
    name: string;
}

export interface Product {
    sku: string;
    price: number;
}

export interface Order {
    user: 
    product: 
}
"#;

    println!("=== Testing Completions ===");
    println!("Code:\n{}", code);
    
    // Parse the code
    let parser = Parser::new(code.to_string());
    let (program, context) = parser.parse(code).expect("Failed to parse");
    
    println!("\nParsed {} declarations", program.declarations.len());
    
    // Debug: print all declarations
    for i in 0..program.declarations.len() {
        let node_id = luq_compiler::ast::NodeId { 
            index: program.declarations.start.index + i as u32 
        };
        if let Some(node) = context.get_ast(node_id) {
            use luq_compiler::ast::nodes::AstNode;
            match node {
                AstNode::TypeDecl { name, .. } => {
                    println!("  Declaration {}: TypeDecl '{}'", i, context.get_str(*name));
                }
                AstNode::FunctionDecl { name, .. } => {
                    println!("  Declaration {}: FunctionDecl '{}'", i, context.get_str(*name));
                }
                AstNode::Import { .. } => {
                    println!("  Declaration {}: Import", i);
                }
                AstNode::Export { .. } => {
                    println!("  Declaration {}: Export", i);
                }
                AstNode::TypeAlias { name, .. } => {
                    println!("  Declaration {}: TypeAlias '{}'", i, context.get_str(*name));
                }
                _ => {
                    println!("  Declaration {}: Other", i);
                }
            }
        }
    }
    
    // Set up caches
    let uri = Url::parse("file:///test.luq").unwrap();
    let ast_cache = Arc::new(RwLock::new(HashMap::new()));
    let context_cache = Arc::new(RwLock::new(HashMap::new()));
    let document_map = Arc::new(RwLock::new(HashMap::new()));
    let dependency_graph = Arc::new(RwLock::new(DependencyGraph::new()));
    
    ast_cache.write().await.insert(uri.clone(), program);
    context_cache.write().await.insert(uri.clone(), Arc::new(context));
    document_map.write().await.insert(uri.clone(), code.to_string());
    
    // Test 1: Type completion after colon
    println!("\n=== Test 1: Type completion after 'user:' ===");
    let params = CompletionParams {
        text_document_position: TextDocumentPositionParams {
            text_document: TextDocumentIdentifier { uri: uri.clone() },
            position: Position { line: 12, character: 10 }, // After "user: "
        },
        work_done_progress_params: WorkDoneProgressParams::default(),
        partial_result_params: PartialResultParams::default(),
        context: Some(CompletionContext {
            trigger_kind: CompletionTriggerKind::TRIGGER_CHARACTER,
            trigger_character: Some(":".to_string()),
        }),
    };
    
    let completions = get_completions(
        &params,
        &ast_cache,
        &context_cache,
        &dependency_graph,
        &document_map,
    ).await;
    
    println!("Got {} completions:", completions.len());
    for (i, item) in completions.iter().enumerate() {
        println!("  {}: {} (kind: {:?})", i, item.label, item.kind);
    }
    
    // Test 2: After "@" for decorators
    println!("\n=== Test 2: Decorator completion after '@' ===");
    let code2 = r#"
@
export interface Test {
    id: string;
}
"#;
    
    let parser2 = Parser::new(code2.to_string());
    let (program2, context2) = parser2.parse(code2).expect("Failed to parse");
    
    let uri2 = Url::parse("file:///test2.luq").unwrap();
    ast_cache.write().await.insert(uri2.clone(), program2);
    context_cache.write().await.insert(uri2.clone(), Arc::new(context2));
    document_map.write().await.insert(uri2.clone(), code2.to_string());
    
    let params2 = CompletionParams {
        text_document_position: TextDocumentPositionParams {
            text_document: TextDocumentIdentifier { uri: uri2.clone() },
            position: Position { line: 1, character: 1 }, // After "@"
        },
        work_done_progress_params: WorkDoneProgressParams::default(),
        partial_result_params: PartialResultParams::default(),
        context: Some(CompletionContext {
            trigger_kind: CompletionTriggerKind::TRIGGER_CHARACTER,
            trigger_character: Some("@".to_string()),
        }),
    };
    
    let completions2 = get_completions(
        &params2,
        &ast_cache,
        &context_cache,
        &dependency_graph,
        &document_map,
    ).await;
    
    println!("Got {} decorator completions:", completions2.len());
    for (i, item) in completions2.iter().enumerate() {
        println!("  {}: {} (kind: {:?})", i, item.label, item.kind);
    }
    
    // Test 3: Without any context (general completions)
    println!("\n=== Test 3: General completions ===");
    let params3 = CompletionParams {
        text_document_position: TextDocumentPositionParams {
            text_document: TextDocumentIdentifier { uri: uri.clone() },
            position: Position { line: 5, character: 0 }, // Empty line
        },
        work_done_progress_params: WorkDoneProgressParams::default(),
        partial_result_params: PartialResultParams::default(),
        context: None,
    };
    
    let completions3 = get_completions(
        &params3,
        &ast_cache,
        &context_cache,
        &dependency_graph,
        &document_map,
    ).await;
    
    println!("Got {} general completions:", completions3.len());
    for (i, item) in completions3.iter().enumerate() {
        println!("  {}: {} (kind: {:?})", i, item.label, item.kind);
    }
}