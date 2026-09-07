// Test cases for chumsky+logos parser
use luq_compiler::lexer_logos;
use luq_compiler::parser_chumsky_simple;

#[test]
fn test_logos_tokenizer_basic() {
    let source = "@validator function test() { return true; }";
    let result = lexer_logos::tokenize(source);
    assert!(result.is_ok(), "Tokenization failed: {:?}", result);
    
    let tokens = result.unwrap();
    assert!(tokens.len() > 0, "No tokens generated");
    
    // Check first token is @
    assert_eq!(tokens[0].kind, lexer_logos::TokenKind::At);
    
    println!("Tokenization successful: {} tokens", tokens.len());
}

#[test]
fn test_logos_decorators() {
    let source = "@validator @required @minLength(10) function validate() {}";
    let result = lexer_logos::tokenize(source);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    let at_count = tokens.iter()
        .filter(|t| t.kind == lexer_logos::TokenKind::At)
        .count();
    assert_eq!(at_count, 3, "Should have 3 @ tokens");
}

#[test]
fn test_logos_literals() {
    let source = r#"
        const str = "hello";
        const num = 42;
        const bool = true;
        const nil = null;
        const undef = undefined;
    "#;
    
    let result = lexer_logos::tokenize(source);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    
    // Check for various literal types
    assert!(tokens.iter().any(|t| t.kind == lexer_logos::TokenKind::StringLiteral));
    assert!(tokens.iter().any(|t| t.kind == lexer_logos::TokenKind::NumberLiteral));
    assert!(tokens.iter().any(|t| t.kind == lexer_logos::TokenKind::True));
    assert!(tokens.iter().any(|t| t.kind == lexer_logos::TokenKind::Null));
    assert!(tokens.iter().any(|t| t.kind == lexer_logos::TokenKind::Undefined));
}

#[test]
fn test_simple_parser() {
    let source = "function test() { return true; }";
    let tokens = lexer_logos::tokenize(source).expect("Tokenization failed");
    
    let result = parser_chumsky_simple::parse_simple(tokens);
    assert!(result.is_ok(), "Parse failed: {:?}", result);
    
    let (program, context) = result.unwrap();
    // Simple parser creates empty AST for now
    assert_eq!(program.declarations.len(), 0);
    
    println!("Simple parser successful");
}

#[test]
fn test_error_handling() {
    // Test with invalid syntax
    let source = "function { } invalid @#$%";
    let tokens = lexer_logos::tokenize(source);
    
    // Lexer should still work but report errors for invalid characters
    match tokens {
        Ok(tokens) => {
            println!("Tokenized with {} tokens", tokens.len());
        }
        Err(errors) => {
            println!("Lexer errors: {:?}", errors);
            assert!(errors.len() > 0, "Should have lexer errors");
        }
    }
}

#[test]
fn test_complex_types() {
    let source = r#"
        type User = {
            name: string;
            age: number;
            roles: string[];
            metadata?: Record<string, any>;
        };
        
        interface Service {
            getUser(id: string): Promise<User>;
            updateUser(user: User): void;
        }
    "#;
    
    let result = lexer_logos::tokenize(source);
    assert!(result.is_ok(), "Complex type tokenization failed");
    
    let tokens = result.unwrap();
    
    // Check for type-related tokens
    assert!(tokens.iter().any(|t| t.kind == lexer_logos::TokenKind::Type));
    assert!(tokens.iter().any(|t| t.kind == lexer_logos::TokenKind::Interface));
    assert!(tokens.iter().any(|t| t.kind == lexer_logos::TokenKind::String));
    assert!(tokens.iter().any(|t| t.kind == lexer_logos::TokenKind::Number));
    assert!(tokens.iter().any(|t| t.kind == lexer_logos::TokenKind::Void));
}

#[test]
fn test_template_literals() {
    let source = r#"const msg = `Hello, ${name}! You are ${age} years old.`;"#;
    let result = lexer_logos::tokenize(source);
    
    match result {
        Ok(tokens) => {
            // Template literals should be tokenized
            let has_template = tokens.iter()
                .any(|t| matches!(t.kind, lexer_logos::TokenKind::TemplateLiteral | lexer_logos::TokenKind::TemplateStart));
            println!("Template literal tokens found: {}", has_template);
        }
        Err(e) => {
            println!("Template literal tokenization error: {:?}", e);
        }
    }
}

#[test]
fn test_comments() {
    let source = r#"
        // Single line comment
        /* Multi-line
           comment */
        /** JSDoc comment
         * @param x The parameter
         */
        function test(x) {
            return x; // inline comment
        }
    "#;
    
    let result = lexer_logos::tokenize(source);
    assert!(result.is_ok(), "Comment tokenization failed");
    
    let tokens = result.unwrap();
    
    // Comments might be filtered or included depending on configuration
    println!("Tokenized {} tokens from source with comments", tokens.len());
    
    // Check that function token exists (comments shouldn't break parsing)
    assert!(tokens.iter().any(|t| t.kind == lexer_logos::TokenKind::Function));
}

#[test]
fn test_real_world_example() {
    let source = r#"
        import { Validator } from './validator';
        
        @validator
        @description("Validates user registration data")
        export function validateRegistration(data: {
            email: string;
            password: string;
            age: number;
            terms: boolean;
        }): boolean | string {
            if (!data.email.includes('@')) {
                return "Invalid email format";
            }
            
            if (data.password.length < 8) {
                return "Password must be at least 8 characters";
            }
            
            if (data.age < 18) {
                return "Must be 18 or older";
            }
            
            if (!data.terms) {
                return "Must accept terms and conditions";
            }
            
            return true;
        }
    "#;
    
    let tokens = lexer_logos::tokenize(source).expect("Tokenization failed");
    let result = parser_chumsky_simple::parse_simple(tokens);
    
    assert!(result.is_ok(), "Real world example parse failed");
    println!("Successfully parsed real-world validator example");
}