#[cfg(test)]
mod tests {
    use super::super::*;

    #[tokio::test]
    async fn test_tokenize_simple_interface() {
        let input = r#"
        @validator
        interface User {
            name: string;
            age: number;
        }
        "#;

        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize().await.unwrap();

        // Filter out whitespace tokens for easier testing
        let tokens: Vec<_> = tokens
            .into_iter()
            .filter(|t| !matches!(t.kind, TokenKind::Whitespace | TokenKind::Newline))
            .collect();

        assert_eq!(tokens.len(), 15); // @, validator, interface, User, {, name, :, string, ;, age, :, number, ;, }, EOF

        assert!(matches!(tokens[0].kind, TokenKind::At));
        assert!(matches!(&tokens[1].kind, TokenKind::Identifier(s) if s == "validator"));
        assert!(matches!(tokens[2].kind, TokenKind::Interface));
        assert!(matches!(&tokens[3].kind, TokenKind::Identifier(s) if s == "User"));
        assert!(matches!(tokens[4].kind, TokenKind::LeftBrace));
    }

    #[tokio::test]
    async fn test_tokenize_decorators_with_arguments() {
        let input = r#"
        @required
        @min(3)
        @max(50)
        @pattern(/^[A-Z]+$/)
        name: string;
        "#;

        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize().await.unwrap();

        // Filter out whitespace
        let tokens: Vec<_> = tokens
            .into_iter()
            .filter(|t| !matches!(t.kind, TokenKind::Whitespace | TokenKind::Newline))
            .collect();

        // Verify decorator tokens
        assert!(matches!(tokens[0].kind, TokenKind::At));
        assert!(matches!(&tokens[1].kind, TokenKind::Identifier(s) if s == "required"));
        
        assert!(matches!(tokens[2].kind, TokenKind::At));
        assert!(matches!(&tokens[3].kind, TokenKind::Identifier(s) if s == "min"));
        assert!(matches!(tokens[4].kind, TokenKind::LeftParen));
        assert!(matches!(&tokens[5].kind, TokenKind::NumberLiteral(n) if n == &3.0));
        assert!(matches!(tokens[6].kind, TokenKind::RightParen));
    }

    #[tokio::test]
    async fn test_tokenize_string_literals() {
        let input = r#"
        @message("This is a message")
        @pattern('single quotes')
        field: string;
        "#;

        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize().await.unwrap();

        let tokens: Vec<_> = tokens
            .into_iter()
            .filter(|t| !matches!(t.kind, TokenKind::Whitespace | TokenKind::Newline))
            .collect();

        // Check string literals
        assert!(matches!(&tokens[3].kind, TokenKind::StringLiteral(s) if s == "This is a message"));
        assert!(matches!(&tokens[8].kind, TokenKind::StringLiteral(s) if s == "single quotes"));
    }

    #[tokio::test]
    async fn test_tokenize_regex_patterns() {
        let input = r#"@pattern(/^[a-zA-Z0-9]+$/)"#;

        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize().await.unwrap();

        let tokens: Vec<_> = tokens
            .into_iter()
            .filter(|t| !matches!(t.kind, TokenKind::Whitespace))
            .collect();

        assert!(matches!(tokens[0].kind, TokenKind::At));
        assert!(matches!(&tokens[1].kind, TokenKind::Identifier(s) if s == "pattern"));
        assert!(matches!(tokens[2].kind, TokenKind::LeftParen));
        assert!(matches!(&tokens[3].kind, TokenKind::RegexLiteral(r) if r == "^[a-zA-Z0-9]+$"));
        assert!(matches!(tokens[4].kind, TokenKind::RightParen));
    }

    #[tokio::test]
    async fn test_tokenize_boolean_keywords() {
        let input = r#"
        @optional(true)
        @required(false)
        "#;

        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize().await.unwrap();

        let tokens: Vec<_> = tokens
            .into_iter()
            .filter(|t| !matches!(t.kind, TokenKind::Whitespace | TokenKind::Newline))
            .collect();

        assert!(matches!(&tokens[3].kind, TokenKind::BooleanLiteral(true)));
        assert!(matches!(&tokens[8].kind, TokenKind::BooleanLiteral(false)));
    }

    #[tokio::test]
    async fn test_tokenize_array_and_object_syntax() {
        let input = r#"
        @values([1, 2, 3])
        @config({ min: 5, max: 10 })
        "#;

        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize().await.unwrap();

        let tokens: Vec<_> = tokens
            .into_iter()
            .filter(|t| !matches!(t.kind, TokenKind::Whitespace | TokenKind::Newline))
            .collect();

        // Array tokens: @values([1, 2, 3])
        assert!(matches!(tokens[3].kind, TokenKind::LeftBracket));
        assert!(matches!(&tokens[4].kind, TokenKind::NumberLiteral(n) if n == &1.0));
        assert!(matches!(tokens[5].kind, TokenKind::Comma));
        assert!(matches!(&tokens[6].kind, TokenKind::NumberLiteral(n) if n == &2.0));
        assert!(matches!(tokens[7].kind, TokenKind::Comma));
        assert!(matches!(&tokens[8].kind, TokenKind::NumberLiteral(n) if n == &3.0));
        assert!(matches!(tokens[9].kind, TokenKind::RightBracket));

        // Object tokens: @config({ min: 5, max: 10 })
        assert!(matches!(tokens[14].kind, TokenKind::LeftBrace));
        assert!(matches!(&tokens[15].kind, TokenKind::Identifier(s) if s == "min"));
        assert!(matches!(tokens[16].kind, TokenKind::Colon));
        assert!(matches!(&tokens[17].kind, TokenKind::NumberLiteral(n) if n == &5.0));
    }

    #[tokio::test]
    async fn test_tokenize_optional_fields() {
        let input = r#"
        interface User {
            name: string;
            email?: string;
            readonly id: number;
        }
        "#;

        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize().await.unwrap();

        let tokens: Vec<_> = tokens
            .into_iter()
            .filter(|t| !matches!(t.kind, TokenKind::Whitespace | TokenKind::Newline))
            .collect();

        // Check for question mark token
        let question_idx = tokens.iter().position(|t| matches!(t.kind, TokenKind::Question));
        assert!(question_idx.is_some());

        // Check for readonly keyword
        let readonly_idx = tokens.iter().position(|t| matches!(t.kind, TokenKind::Readonly));
        assert!(readonly_idx.is_some());
    }

    #[tokio::test]
    async fn test_tokenize_type_keywords() {
        let input = r#"
        string number boolean void any unknown never
        "#;

        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize().await.unwrap();

        let tokens: Vec<_> = tokens
            .into_iter()
            .filter(|t| !matches!(t.kind, TokenKind::Whitespace | TokenKind::Newline))
            .collect();

        assert!(matches!(tokens[0].kind, TokenKind::StringType));
        assert!(matches!(tokens[1].kind, TokenKind::NumberType));
        assert!(matches!(tokens[2].kind, TokenKind::BooleanType));
        assert!(matches!(tokens[3].kind, TokenKind::VoidType));
        assert!(matches!(tokens[4].kind, TokenKind::AnyType));
        assert!(matches!(tokens[5].kind, TokenKind::UnknownType));
        assert!(matches!(tokens[6].kind, TokenKind::NeverType));
    }

    #[tokio::test]
    async fn test_tokenize_comments() {
        let input = r#"
        // This is a single line comment
        interface User { /* inline comment */ }
        /* This is a
           multi-line comment */
        "#;

        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize().await.unwrap();

        // Count comment tokens
        let comment_count = tokens
            .iter()
            .filter(|t| matches!(t.kind, TokenKind::Comment(_)))
            .count();
        
        assert_eq!(comment_count, 3);
    }

    #[tokio::test]
    async fn test_tokenize_extends_clause() {
        let input = r#"
        interface Admin extends User {
            permissions: string[];
        }
        "#;

        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize().await.unwrap();

        let tokens: Vec<_> = tokens
            .into_iter()
            .filter(|t| !matches!(t.kind, TokenKind::Whitespace | TokenKind::Newline))
            .collect();

        // Find extends keyword
        let extends_idx = tokens.iter().position(|t| matches!(t.kind, TokenKind::Extends));
        assert!(extends_idx.is_some());
    }

    #[tokio::test]
    async fn test_tokenize_union_types() {
        let input = r#"
        type Status = "active" | "inactive" | "pending";
        "#;

        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize().await.unwrap();

        let tokens: Vec<_> = tokens
            .into_iter()
            .filter(|t| !matches!(t.kind, TokenKind::Whitespace | TokenKind::Newline))
            .collect();

        // Count pipe tokens
        let pipe_count = tokens
            .iter()
            .filter(|t| matches!(t.kind, TokenKind::Pipe))
            .count();
        
        assert_eq!(pipe_count, 2);
    }

    #[tokio::test]
    async fn test_tokenize_generic_syntax() {
        let input = r#"
        interface Container<T> {
            value: T;
        }
        "#;

        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize().await.unwrap();

        let tokens: Vec<_> = tokens
            .into_iter()
            .filter(|t| !matches!(t.kind, TokenKind::Whitespace | TokenKind::Newline))
            .collect();

        assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::LessThan)));
        assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::GreaterThan)));
    }

    #[tokio::test]
    async fn test_tokenize_decimal_numbers() {
        let input = r#"
        @min(3.14)
        @max(100.0)
        @value(-42.5)
        "#;

        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize().await.unwrap();

        let tokens: Vec<_> = tokens
            .into_iter()
            .filter(|t| !matches!(t.kind, TokenKind::Whitespace | TokenKind::Newline))
            .collect();

        // Check decimal numbers
        assert!(tokens.iter().any(|t| matches!(&t.kind, TokenKind::NumberLiteral(n) if (n - 3.14).abs() < 0.001)));
        assert!(tokens.iter().any(|t| matches!(&t.kind, TokenKind::NumberLiteral(n) if (n - 100.0).abs() < 0.001)));
        assert!(tokens.iter().any(|t| matches!(&t.kind, TokenKind::NumberLiteral(n) if (n - -42.5).abs() < 0.001)));
    }
}