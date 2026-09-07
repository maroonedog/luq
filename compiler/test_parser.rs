use luq_compiler::lexer_logos;
use luq_compiler::parser_chumsky_simple;

fn main() {
    let source = std::fs::read_to_string("test_lexer.luq").unwrap();
    match lexer_logos::tokenize(&source) {
        Ok(tokens) => {
            match parser_chumsky_simple::parse_simple(tokens) {
                Ok((program, context)) => {
                    println!("Parser SUCCESS: Empty AST created");
                }
                Err(err) => {
                    println!("Parser FAILED: {}", err);
                }
            }
        }
        Err(errors) => {
            println!("Lexer FAILED: {:?}", errors);
        }
    }
}
