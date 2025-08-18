use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use crate::config::CompilerConfig;

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

#[derive(Subcommand)]
enum Commands {
    /// Compile a .luq file to target language
    Compile {
        /// Input .luq file
        input: PathBuf,

        /// Output file (defaults to input name with target extension)
        #[arg(short, long)]
        output: Option<PathBuf>,

        /// Target language
        #[arg(short, long, default_value = "typescript")]
        target: String,

        /// Generate runtime-free AOT compiled code
        #[arg(long)]
        aot: bool,
    },

    /// Parse and print AST (for debugging)
    Parse {
        /// Input .luq file
        input: PathBuf,

        /// Pretty print the AST
        #[arg(long)]
        pretty: bool,
    },

    /// Check syntax without generating code
    Check {
        /// Input .luq file
        input: PathBuf,
    },
    
    /// Parse multiple files in parallel
    Batch {
        /// Input .luq files or directory
        #[arg(required = true)]
        inputs: Vec<PathBuf>,
        
        /// Show timing information
        #[arg(long)]
        timing: bool,
        
        /// Output format (json, summary)
        #[arg(short, long, default_value = "summary")]
        format: String,
    },
}

impl Cli {
    /// Create a CompilerConfig from CLI arguments
    pub fn create_config(&self) -> CompilerConfig {
        let mut config = CompilerConfig::new();
        
        if let Some(threads) = self.threads {
            config.thread_count = Some(threads);
        }
        
        if self.no_parallel {
            config.parallel_lexing = false;
            config.parallel_parsing = false;
        }
        
        config.enable_metrics = self.metrics;
        config.operation_timeout_ms = self.timeout;
        
        config
    }
    
    pub async fn execute(self, config: CompilerConfig) -> Result<()> {
        match self.command {
            Commands::Compile {
                input,
                output,
                target,
                aot,
            } => {
                // TODO: Implement compilation
                println!("Compiling {} to {}", input.display(), target);
                if aot {
                    println!("Using AOT compilation mode");
                }
                Ok(())
            }
            Commands::Parse { input, pretty } => {
                use tokio::fs;
                use crate::lexer::Lexer;
                use crate::parser::Parser;
                use crate::ast::ToJson;
                
                // Read the input file asynchronously
                let source = fs::read_to_string(&input).await
                    .context(format!("Failed to read file: {}", input.display()))?;
                
                // Parse the source asynchronously
                let mut lexer = Lexer::new(&source);
                let tokens = lexer.tokenize().await
                    .context("Failed to tokenize source")?;
                
                let mut parser = Parser::new(tokens);
                let ast = parser.parse().await
                    .context("Failed to parse source")?;
                
                // Output as JSON using custom serialization
                let json_value = ast.to_json();
                if pretty {
                    let json_str = serde_json::to_string_pretty(&json_value)
                        .context("Failed to serialize JSON")?;
                    println!("{}", json_str);
                } else {
                    let json_str = serde_json::to_string(&json_value)
                        .context("Failed to serialize JSON")?;
                    println!("{}", json_str);
                }
                
                Ok(())
            }
            Commands::Check { input } => {
                // TODO: Implement checking
                println!("Checking {}", input.display());
                Ok(())
            }
            Commands::Batch { inputs, timing, format } => {
                use crate::parallel::ParallelProcessor;
                use std::time::Instant;
                
                let start = Instant::now();
                
                // Collect all .luq files
                let mut files = Vec::new();
                for input in inputs {
                    if input.is_dir() {
                        // Recursively find .luq files in directory
                        for entry in std::fs::read_dir(&input)? {
                            let entry = entry?;
                            let path = entry.path();
                            if path.extension().and_then(|s| s.to_str()) == Some("luq") {
                                files.push(path);
                            }
                        }
                    } else {
                        files.push(input);
                    }
                }
                
                if files.is_empty() {
                    println!("No .luq files found");
                    return Ok(());
                }
                
                println!("Processing {} files with {} threads...", 
                    files.len(), 
                    config.get_thread_count());
                
                // Process files in parallel
                let processor = ParallelProcessor::new(config);
                let results = processor.parse_files_async(files.clone()).await;
                
                // Output results
                match format.as_str() {
                    "json" => {
                        let json_results: Vec<_> = results.iter().map(|r| {
                            serde_json::json!({
                                "file": r.file_path.display().to_string(),
                                "success": r.program.is_ok(),
                                "elapsed_ms": r.elapsed_ms,
                                "error": r.program.as_ref().err().map(|e| e.to_string()),
                            })
                        }).collect();
                        
                        println!("{}", serde_json::to_string_pretty(&json_results)?);
                    }
                    _ => {
                        // Summary format
                        let successful = results.iter().filter(|r| r.program.is_ok()).count();
                        let failed = results.len() - successful;
                        
                        println!("\n=== Results ===");
                        println!("Total files: {}", results.len());
                        println!("Successful: {}", successful);
                        println!("Failed: {}", failed);
                        
                        if timing {
                            let total_time = start.elapsed();
                            let avg_time = results.iter().map(|r| r.elapsed_ms).sum::<u128>() / results.len() as u128;
                            
                            println!("\n=== Timing ===");
                            println!("Total time: {:?}", total_time);
                            println!("Average per file: {}ms", avg_time);
                            println!("Files per second: {:.2}", 
                                results.len() as f64 / total_time.as_secs_f64());
                        }
                        
                        // Show errors if any
                        for result in results.iter().filter(|r| r.program.is_err()) {
                            println!("\nError in {}:", result.file_path.display());
                            if let Err(e) = &result.program {
                                println!("  {}", e);
                            }
                        }
                    }
                }
                
                Ok(())
            }
        }
    }
}