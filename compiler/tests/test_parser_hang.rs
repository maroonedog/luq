use luq_compiler::lexer::Lexer;
use luq_compiler::parser::Parser;

#[tokio::test]
async fn test_parser_hanging_issue() {
    // Test with the actual file that's hanging
    let test_code = r#"import { b } from './circular-b.luq'

interface A {
    name: string
}

export { A }"#;

    println!("Starting parser test...");
    println!("Input code:\n{}", test_code);
    println!("---");
    
    // Tokenize
    println!("Starting tokenization...");
    let mut lexer = Lexer::new(test_code);
    let tokens = match lexer.tokenize().await {
        Ok(tokens) => {
            println!("Tokenization successful: {} tokens", tokens.len());
            for (i, token) in tokens.iter().enumerate() {
                println!("  Token {}: {:?}", i, token);
            }
            tokens
        }
        Err(e) => {
            panic!("Tokenization failed: {}", e);
        }
    };
    
    // Parse
    println!("\nStarting parsing...");
    let parser = Parser::new(tokens, test_code.to_string());
    
    // Add timeout to detect hanging
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        parser.parse()
    ).await;
    
    match result {
        Ok(Ok((program, _context))) => {
            println!("Parsing successful!");
            println!("Declarations: {}", program.declarations.len());
        }
        Ok(Err(e)) => {
            panic!("Parsing failed: {}", e);
        }
        Err(_) => {
            panic!("Parser timeout - hanging detected!");
        }
    }
}