#![allow(dead_code)]
#![allow(unused_imports)]
#![allow(unused_variables)]

pub mod ast;
pub mod codegen;
pub mod lexer;
pub mod parser;
pub mod config;
pub mod parallel;
pub mod cli;
pub mod lsp;
pub mod dependency;

#[cfg(test)]
mod test_nom_parser;