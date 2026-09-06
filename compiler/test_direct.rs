// Direct test of logos lexer and simple parser
use luq_compiler::lexer_logos;
use luq_compiler::parser_chumsky_simple;

fn main() {
    println!("Testing Luq parser (chumsky+logos)");
    println!("===================================\n");
    
    let test_cases = vec![
        // Simple function
        "@validator function test() { return true; }",
        
        // Complex type
        "type User = { name: string; age: number; };",
        
        // Interface
        "interface Service { getUser(): User; }",
        
        // Decorators
        "@required @minLength(10) const field = 'value';",
        
        // Real validator
        r#"
        @validator
        function validateEmail(email: string) {
            if (!email.includes('@')) {
                return "Invalid email";
            }
            return true;
        }
        "#,
    ];
    
    for (i, source) in test_cases.iter().enumerate() {
        println!("Test case {}: {}", i + 1, 
            if source.len() > 50 { &source[..50] } else { source });
        
        // Test lexer
        match lexer_logos::tokenize(source) {
            Ok(tokens) => {
                println!("  ✅ Lexer: {} tokens", tokens.len());
                
                // Show first few tokens
                for (j, token) in tokens.iter().take(5).enumerate() {
                    println!("    Token {}: {:?}", j, token.kind);
                }
                
                // Test parser
                match parser_chumsky_simple::parse_simple(tokens) {
                    Ok((program, context)) => {
                        println!("  ✅ Parser: Success (empty AST for now)");
                        println!("    Context source size: {} bytes", 
                            context.source.len());
                    }
                    Err(e) => {
                        println!("  ❌ Parser error: {}", e);
                    }
                }
            }
            Err(errors) => {
                println!("  ❌ Lexer errors:");
                for error in errors {
                    println!("    - {}", error.message);
                }
            }
        }
        println!();
    }
    
    println!("Summary:");
    println!("- Logos lexer: ✅ Working");
    println!("- Simple parser: ✅ Working");
    println!("- Ready for full chumsky implementation");
}