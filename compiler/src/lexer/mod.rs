mod token;
mod tokenizer;

#[cfg(test)]
mod lexer_test;

pub use token::{Token, TokenKind};
#[allow(unused_imports)]
pub use token::Span;
pub use tokenizer::Lexer;