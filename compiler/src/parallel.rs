#![allow(dead_code)]

use anyhow::Result;
use rayon::prelude::*;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Semaphore;
use futures::future::join_all;

use crate::ast::{Program, AstContext};
use crate::config::CompilerConfig;
use crate::lexer::Lexer;
use crate::parser::Parser;

/// Result of parallel parsing
pub struct ParallelParseResult {
    pub file_path: PathBuf,
    pub program: Result<Program>,
    pub context: Option<AstContext>,
    pub elapsed_ms: u128,
}

/// Parallel processor for multiple files
pub struct ParallelProcessor {
    config: Arc<CompilerConfig>,
    semaphore: Arc<Semaphore>,
}

impl ParallelProcessor {
    /// Create a new parallel processor
    pub fn new(config: CompilerConfig) -> Self {
        let max_concurrent = config.max_concurrent_files;
        Self {
            config: Arc::new(config),
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
        }
    }
    
    /// Parse multiple files in parallel using rayon
    pub fn parse_files_sync(&self, files: Vec<PathBuf>) -> Vec<ParallelParseResult> {
        let config = Arc::clone(&self.config);
        
        if config.parallel_parsing {
            // Use rayon for CPU-bound parallel processing
            files.par_iter()
                .map(|file| self.parse_file_sync(file.clone()))
                .collect()
        } else {
            // Sequential processing
            files.iter()
                .map(|file| self.parse_file_sync(file.clone()))
                .collect()
        }
    }
    
    /// Parse a single file synchronously
    fn parse_file_sync(&self, file_path: PathBuf) -> ParallelParseResult {
        let start = std::time::Instant::now();
        
        let (result, context) = (|| -> Result<(Program, AstContext)> {
            let source = std::fs::read_to_string(&file_path)?;
            
            // Create runtime for async operations
            let runtime = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()?;
            
            let parser = Parser::new(source.clone());
            parser.parse(&source)
                .map_err(|e| anyhow::anyhow!("Parse error: {}", e))
        })().map(|(prog, ctx)| (Ok(prog), Some(ctx))).unwrap_or_else(|e| (Err(e), None));
        
        let elapsed_ms = start.elapsed().as_millis();
        
        ParallelParseResult {
            file_path,
            program: result,
            context,
            elapsed_ms,
        }
    }
    
    /// Parse multiple files asynchronously with concurrency control
    pub async fn parse_files_async(&self, files: Vec<PathBuf>) -> Vec<ParallelParseResult> {
        let config = Arc::clone(&self.config);
        
        if config.parallel_parsing {
            // Process files with controlled concurrency
            let futures = files.into_iter().map(|file| {
                let semaphore = Arc::clone(&self.semaphore);
                let _config = Arc::clone(&config);
                
                async move {
                    // Acquire semaphore permit to limit concurrent operations
                    let _permit = semaphore.acquire().await.ok()?;
                    Some(self.parse_file_async(file).await)
                }
            });
            
            let results = join_all(futures).await;
            results.into_iter().flatten().collect()
        } else {
            // Sequential async processing
            let mut results = Vec::new();
            for file in files {
                results.push(self.parse_file_async(file).await);
            }
            results
        }
    }
    
    /// Parse a single file asynchronously
    async fn parse_file_async(&self, file_path: PathBuf) -> ParallelParseResult {
        let start = tokio::time::Instant::now();
        
        let (result, context) = match async {
            let source = tokio::fs::read_to_string(&file_path).await?;
            
            let parser = Parser::new(source.clone());
            parser.parse(&source)
                .map_err(|e| anyhow::anyhow!("Parse error: {}", e))
        }.await {
            Ok((ast, ctx)) => (Ok(ast), Some(ctx)),
            Err(e) => (Err(e), None),
        };
        
        let elapsed_ms = start.elapsed().as_millis();
        
        ParallelParseResult {
            file_path,
            program: result,
            context,
            elapsed_ms,
        }
    }
    
    /// Parse files in batches for better memory management
    pub async fn parse_files_batched(&self, files: Vec<PathBuf>) -> Vec<ParallelParseResult> {
        let batch_size = self.config.batch_size;
        let mut all_results = Vec::new();
        
        for batch in files.chunks(batch_size) {
            let batch_results = self.parse_files_async(batch.to_vec()).await;
            all_results.extend(batch_results);
            
            // Small delay between batches to prevent overwhelming the system
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        }
        
        all_results
    }
}

/// Parallel lexer for splitting large files into chunks
pub struct ParallelLexer {
    config: Arc<CompilerConfig>,
}

impl ParallelLexer {
    pub fn new(config: CompilerConfig) -> Self {
        Self {
            config: Arc::new(config),
        }
    }
    
    /// Tokenize a large source file in parallel chunks
    pub async fn tokenize_parallel(&self, source: &str) -> Result<Vec<crate::lexer::Token>> {
        if !self.config.parallel_lexing || source.len() < 10000 {
            // For small files, use regular lexing
            let mut lexer = Lexer::new(source);
            return lexer.tokenize().await;
        }
        
        // Split source into lines for parallel processing
        let lines: Vec<&str> = source.lines().collect();
        let chunk_size = (lines.len() / self.config.get_thread_count()).max(100);
        
        // Process chunks in parallel
        let chunks: Vec<Vec<&str>> = lines.chunks(chunk_size).map(|c| c.to_vec()).collect();
        
        let mut all_tokens = Vec::new();
        for chunk in chunks {
            let chunk_source = chunk.join("\n");
            let mut lexer = Lexer::new(&chunk_source);
            let tokens = lexer.tokenize().await?;
            all_tokens.extend(tokens);
        }
        
        Ok(all_tokens)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;
    
    #[tokio::test]
    async fn test_parallel_parsing() {
        let dir = tempdir().unwrap();
        let config = CompilerConfig::new().with_threads(2);
        
        // Create test files
        for i in 0..3 {
            let file_path = dir.path().join(format!("test{}.luq", i));
            fs::write(&file_path, format!("interface Test{} {{ field: string; }}", i)).unwrap();
        }
        
        let files: Vec<PathBuf> = (0..3)
            .map(|i| dir.path().join(format!("test{}.luq", i)))
            .collect();
        
        let processor = ParallelProcessor::new(config);
        let results = processor.parse_files_async(files).await;
        
        assert_eq!(results.len(), 3);
        for result in results {
            assert!(result.program.is_ok());
        }
    }
}