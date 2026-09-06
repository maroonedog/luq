use luq_compiler::lexer::{tokenize, TokenKind};
use std::fs;

fn main() {
    // Read a Luq file
    let filename = "examples/user.luq";
    
    let input = match fs::read_to_string(filename) {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Failed to read file {}: {}", filename, e);
            return;
        }
    };
    
    println!("=== Tokenizing {} ===\n", filename);
    println!("Input:\n{}\n", input);
    println!("=== Tokens ===\n");
    
    match tokenize(&input) {
        Ok(tokens) => {
            for (i, token) in tokens.iter().enumerate() {
                // Skip EOF token in display
                if matches!(token.kind, TokenKind::Eof) {
                    continue;
                }
                
                println!(
                    "{:4}: {:20} {:20} [{:3}..{:3}] \"{}\"",
                    i,
                    format!("{:?}", token.kind).split('(').next().unwrap_or(""),
                    format!("{}", token.kind),
                    token.span.start,
                    token.span.end,
                    token.text
                );
            }
            
            println!("\n=== Summary ===");
            println!("Total tokens: {}", tokens.len());
            
            // Count token types
            let mut interface_count = 0;
            let mut decorator_count = 0;
            let mut comment_count = 0;
            let mut string_literal_count = 0;
            let mut number_literal_count = 0;
            
            for token in &tokens {
                match &token.kind {
                    TokenKind::Interface => interface_count += 1,
                    TokenKind::At => decorator_count += 1,
                    TokenKind::SingleLineComment(_) | 
                    TokenKind::DocComment(_) | 
                    TokenKind::MultiLineComment(_) => comment_count += 1,
                    TokenKind::StringLiteral(_) => string_literal_count += 1,
                    TokenKind::NumberLiteral(_) => number_literal_count += 1,
                    _ => {}
                }
            }
            
            println!("Interfaces: {}", interface_count);
            println!("Decorators (@): {}", decorator_count);
            println!("Comments: {}", comment_count);
            println!("String literals: {}", string_literal_count);
            println!("Number literals: {}", number_literal_count);
        }
        Err(errors) => {
            eprintln!("Failed to tokenize:");
            for error in errors {
                eprintln!("  Error at {:?}: {:?}", error.span(), error.reason());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_example_file() {
        let input = r#"
            @validator
            interface User {
                @required
                name: string;
                age?: number;
            }
        "#;
        
        let result = tokenize(input);
        assert!(result.is_ok());
        
        let tokens = result.unwrap();
        
        // Check we have the expected tokens
        assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::At)));
        assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Interface)));
        assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::StringType)));
        assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::NumberType)));
        assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Question)));
    }
}