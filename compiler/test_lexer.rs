use luq_compiler::lexer_logos;

fn main() {
    let source = std::fs::read_to_string("test_lexer.luq").unwrap();
    match lexer_logos::tokenize(&source) {
        Ok(tokens) => {
            println!("Lexer SUCCESS: {} tokens", tokens.len());
            for (i, token) in tokens.iter().enumerate().take(10) {
                println!("  Token {}: {:?}", i, token.kind);
            }
        }
        Err(errors) => {
            println!("Lexer FAILED: {:?}", errors);
        }
    }
}
