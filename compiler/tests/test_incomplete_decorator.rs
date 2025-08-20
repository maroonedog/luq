#[test]
fn test_incomplete_decorator_does_not_hang() {
    use luq_compiler::parser::Parser;
    use luq_compiler::lexer::Lexer;
    use luq_compiler::ast::{Arena, StringPool};
    use std::sync::Arc;
    use std::time::{Duration, Instant};
    
    let source = r#"
interface Test {
    @
    value: string
}
"#;
    
    let mut lexer = Lexer::new(source);
    let tokens = lexer.tokenize().unwrap();
    
    let arena = Arc::new(Arena::new());
    let string_pool = Arc::new(StringPool::new());
    let mut parser = Parser::new(tokens, source.to_string(), arena, string_pool);
    
    let start = Instant::now();
    let result = parser.parse();
    let elapsed = start.elapsed();
    
    // Should complete quickly (under 1 second)
    assert!(elapsed < Duration::from_secs(1), "Parser took too long: {:?}", elapsed);
    
    // Should handle the incomplete decorator gracefully
    assert!(result.is_ok(), "Parser should handle incomplete decorator");
}
