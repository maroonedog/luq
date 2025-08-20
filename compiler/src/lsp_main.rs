#![allow(dead_code)]
#![allow(unused_imports)]
#![allow(unused_variables)]

mod ast;
mod lexer;
mod parser;
mod codegen;
mod config;
mod parallel;
mod cli;
mod lsp;
mod dependency;

use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    // LSPサーバーを起動
    lsp::server::run_server().await;
    Ok(())
}