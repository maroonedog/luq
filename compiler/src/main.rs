use luq_compiler::lexer::tokenize;
use std::fs;
use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 2 {
        eprintln!("Usage: {} <file.luq>", args[0]);
        std::process::exit(1);
    }
    
    let filename = &args[1];
    let input = match fs::read_to_string(filename) {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Failed to read file {}: {}", filename, e);
            std::process::exit(1);
        }
    };
    
    match tokenize(&input) {
        Ok(tokens) => {
            println!("Successfully tokenized {} tokens", tokens.len());
            for token in tokens.iter().take(10) {
                println!("  {:?}", token);
            }
            if tokens.len() > 10 {
                println!("  ... and {} more", tokens.len() - 10);
            }
        }
        Err(errors) => {
            eprintln!("Failed to tokenize:");
            for error in errors {
                eprintln!("  Error at {:?}: {:?}", error.span(), error.reason());
            }
            std::process::exit(1);
        }
    }
}