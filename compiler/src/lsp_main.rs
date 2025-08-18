mod ast;
mod lexer;
mod parser;
mod codegen;
mod config;
mod parallel;
mod cli;
mod lsp;

use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    // LSPサーバーを起動
    lsp::server::run_server().await;
    Ok(())
}