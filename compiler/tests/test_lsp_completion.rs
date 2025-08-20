use luq_compiler::lsp::completions;
use luq_compiler::dependency::DependencyGraph;
use luq_compiler::parser::Parser;
use luq_compiler::lexer::Lexer;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_lsp::lsp_types::*;
use std::path::PathBuf;

#[tokio::test]
async fn test_validator_completion() {
    println!("Testing LSP completion functionality...\n");
    
    // Create test files content
    let validator_code = r#"// Test file to verify @validator detection

// Functions WITH @validator decorator - should show in autocomplete
@validator
function validateEmail(value: string): boolean {
    return true;
}

@validator
function min(minValue: number): boolean {
    return true;
}

@validator
function max(maxValue: number): boolean {
    return true;
}

@validator
function arrayMin(minLength: number): boolean {
    return true;
}

@validator
function arrayMax(maxLength: number): boolean {
    return true;
}

// Functions WITHOUT @validator decorator - should NOT show in autocomplete
function regularFunction(x: number): number {
    return 42;
}

function helperFunction(str: string): string {
    return "hello";
}
"#;

    let import_code = r#"// Test file WITH imports - should show ONLY imported validator functions

import { validateEmail, min, max } from './test-validator-detection.luq'

interface User {
    name: string
    // Type here - should see ONLY validateEmail, min, max in autocomplete:
    
}
"#;

    // Parse validator file
    println!("1. Parsing validator file...");
    let mut lexer = Lexer::new(validator_code);
    let tokens = lexer.tokenize().await.expect("Failed to tokenize validator file");
    let mut parser = Parser::new(tokens, validator_code.to_string());
    let (validator_ast, validator_context) = parser.parse().await.expect("Failed to parse validator file");
    
    // Parse import file
    println!("2. Parsing import file...");
    let mut lexer = Lexer::new(import_code);
    let tokens = lexer.tokenize().await.expect("Failed to tokenize import file");
    let mut parser = Parser::new(tokens, import_code.to_string());
    let (import_ast, import_context) = parser.parse().await.expect("Failed to parse import file");
    
    // Create dependency graph
    println!("3. Building dependency graph...");
    let mut graph = DependencyGraph::new();
    
    // Add validator file to graph
    let validator_path = PathBuf::from("/test/test-validator-detection.luq");
    graph.add_or_update_module_with_context(
        validator_path.clone(), 
        &validator_ast, 
        &validator_context
    ).expect("Failed to add validator module");
    
    // Add import file to graph
    let import_path = PathBuf::from("/test/test-with-imports.luq");
    graph.add_or_update_module_with_context(
        import_path.clone(), 
        &import_ast, 
        &import_context
    ).expect("Failed to add import module");
    
    // Manually resolve imports (normally done by import resolver)
    if let Some(node) = graph.nodes.get_mut(&import_path) {
        for import in &mut node.imports {
            if import.source == "./test-validator-detection.luq" {
                import.resolved_path = Some(validator_path.clone());
            }
        }
    }
    
    // Print graph state
    println!("\n4. Dependency graph state:");
    if let Some(validator_node) = graph.get_node(&validator_path) {
        println!("   Validator file exports: {:?}", 
            validator_node.exports.iter().map(|e| &e.name).collect::<Vec<_>>());
    }
    if let Some(import_node) = graph.get_node(&import_path) {
        println!("   Import file imports: {:?}", 
            import_node.imports.iter().map(|i| &i.source).collect::<Vec<_>>());
    }
    
    // Create completion context
    let ast_cache = Arc::new(RwLock::new(HashMap::new()));
    ast_cache.write().await.insert(
        Url::parse("file:///test/test-with-imports.luq").unwrap(),
        import_ast
    );
    
    let dependency_graph = Arc::new(RwLock::new(graph));
    let document_map = Arc::new(RwLock::new(HashMap::new()));
    document_map.write().await.insert(
        Url::parse("file:///test/test-with-imports.luq").unwrap(),
        import_code.to_string()
    );
    
    // Test completion
    println!("\n5. Testing completion at '@' position...");
    let params = CompletionParams {
        text_document_position: TextDocumentPositionParams {
            text_document: TextDocumentIdentifier {
                uri: Url::parse("file:///test/test-with-imports.luq").unwrap(),
            },
            position: Position { line: 7, character: 4 },
        },
        context: Some(CompletionContext {
            trigger_kind: CompletionTriggerKind::TRIGGER_CHARACTER,
            trigger_character: Some("@".to_string()),
        }),
        work_done_progress_params: WorkDoneProgressParams::default(),
        partial_result_params: PartialResultParams::default(),
    };
    
    let completions = completions::get_completions(
        &params,
        &ast_cache,
        &dependency_graph,
        &document_map
    ).await;
    
    // Print results
    println!("\n6. Completion results:");
    println!("   Total completions: {}", completions.len());
    
    for item in &completions {
        println!("   - {} (kind: {:?})", item.label, item.kind);
    }
    
    // Verify results
    let function_names: Vec<String> = completions.iter()
        .map(|c| c.label.split('(').next().unwrap_or("").to_string())
        .collect();
    
    let expected = vec!["validateEmail", "min", "max"];
    let excluded = vec!["arrayMin", "arrayMax"];
    
    println!("\n7. Verification:");
    for name in &expected {
        if function_names.contains(&name.to_string()) {
            println!("   ✓ Found expected function: {}", name);
        } else {
            println!("   ✗ Missing expected function: {}", name);
            panic!("Missing expected function: {}", name);
        }
    }
    
    for name in &excluded {
        if function_names.contains(&name.to_string()) {
            println!("   ✗ Found excluded function: {}", name);
            panic!("Found excluded function: {}", name);
        } else {
            println!("   ✓ Correctly excluded: {}", name);
        }
    }
    
    println!("\n✓ Test passed!");
}