use luq_compiler::lexer::{Lexer, TokenKind};

#[tokio::test]
async fn test_tokenize_decorator() {
    let input = "@required @min(3)";
    let mut lexer = Lexer::new(input);
    let tokens = lexer.tokenize().await.unwrap();
    
    // Filter out whitespace tokens for easier testing
    let tokens: Vec<_> = tokens
        .into_iter()
        .filter(|t| !matches!(t.kind, TokenKind::Whitespace | TokenKind::Newline))
        .collect();
    
    assert_eq!(tokens.len(), 8); // @, required, @, min, (, 3, ), EOF
    assert_eq!(tokens[0].kind, TokenKind::At);
    assert_eq!(tokens[1].kind, TokenKind::Identifier("required".to_string()));
    assert_eq!(tokens[2].kind, TokenKind::At);
    assert_eq!(tokens[3].kind, TokenKind::Identifier("min".to_string()));
    assert_eq!(tokens[4].kind, TokenKind::LeftParen);
    assert_eq!(tokens[5].kind, TokenKind::NumberLiteral(3.0));
}

#[tokio::test]
async fn test_tokenize_interface() {
    let input = "interface User { name: string; }";
    let mut lexer = Lexer::new(input);
    let tokens = lexer.tokenize().await.unwrap();
    
    let tokens: Vec<_> = tokens
        .into_iter()
        .filter(|t| !matches!(t.kind, TokenKind::Whitespace | TokenKind::Newline))
        .collect();
    
    assert_eq!(tokens[0].kind, TokenKind::Interface);
    assert_eq!(tokens[1].kind, TokenKind::Identifier("User".to_string()));
    assert_eq!(tokens[2].kind, TokenKind::LeftBrace);
    assert_eq!(tokens[3].kind, TokenKind::Identifier("name".to_string()));
    assert_eq!(tokens[4].kind, TokenKind::Colon);
    assert_eq!(tokens[5].kind, TokenKind::StringType);
    assert_eq!(tokens[6].kind, TokenKind::Semicolon);
    assert_eq!(tokens[7].kind, TokenKind::RightBrace);
}