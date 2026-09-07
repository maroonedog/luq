// CLI module for Luq compiler

#![allow(dead_code)]

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use crate::config::CompilerConfig;

mod commands;
mod executor;

pub use commands::*;
use executor::*;

#[derive(Parser)]
#[command(name = "luqc")]
#[command(about = "Luq compiler for .luq files", long_about = None)]
pub struct Cli {
    /// Number of threads to use for parallel processing (default: number of CPU cores)
    #[arg(short = 'j', long, global = true)]
    threads: Option<usize>,
    
    /// Disable parallel processing
    #[arg(long, global = true)]
    no_parallel: bool,
    
    /// Enable performance metrics
    #[arg(long, global = true)]
    metrics: bool,
    
    /// Operation timeout in milliseconds
    #[arg(long, global = true, default_value = "30000")]
    timeout: u64,
    
    #[command(subcommand)]
    command: Commands,
}

impl Cli {
    pub async fn run() -> Result<()> {
        let cli = Cli::parse();
        
        // Set up configuration
        let mut config = CompilerConfig::default();
        if let Some(threads) = cli.threads {
            config.thread_count = Some(threads);
        }
        if cli.no_parallel {
            config.parallel_parsing = false;
            config.parallel_lexing = false;
        }
        config.enable_metrics = cli.metrics;
        config.operation_timeout_ms = cli.timeout;
        
        // Execute command
        execute_command(cli.command, config).await
    }
}