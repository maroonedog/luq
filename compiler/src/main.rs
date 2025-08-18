#![recursion_limit = "256"]

mod ast;
mod cli;
mod codegen;
mod config;
mod lexer;
mod parallel;
mod parser;

use anyhow::Result;
use clap::Parser;
use config::CompilerConfig;

fn main() -> Result<()> {
    // Parse CLI arguments
    let cli = cli::Cli::parse();
    
    // Create config from CLI options
    let config = cli.create_config();
    
    // Configure the global rayon thread pool
    config.configure_global_thread_pool();
    
    // Build tokio runtime with configured thread count
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(config.get_thread_count())
        .thread_name("luq-tokio")
        .enable_all()
        .build()?;
    
    // Execute the CLI command
    runtime.block_on(cli.execute(config))
}