use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Compiler configuration with thread pool settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompilerConfig {
    /// Number of threads for parallel processing
    /// If None, uses the number of CPU cores
    pub thread_count: Option<usize>,
    
    /// Enable parallel lexing for multiple files
    pub parallel_lexing: bool,
    
    /// Enable parallel parsing for multiple files
    pub parallel_parsing: bool,
    
    /// Batch size for parallel processing
    pub batch_size: usize,
    
    /// Maximum number of concurrent file operations
    pub max_concurrent_files: usize,
    
    /// Enable performance metrics collection
    pub enable_metrics: bool,
    
    /// Timeout for individual operations in milliseconds
    pub operation_timeout_ms: u64,
}

impl Default for CompilerConfig {
    fn default() -> Self {
        Self {
            thread_count: None, // Use all available cores
            parallel_lexing: true,
            parallel_parsing: true,
            batch_size: 100,
            max_concurrent_files: 10,
            enable_metrics: false,
            operation_timeout_ms: 30000,
        }
    }
}

impl CompilerConfig {
    /// Create a new config with default settings
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Set the thread count
    pub fn with_threads(mut self, count: usize) -> Self {
        self.thread_count = Some(count);
        self
    }
    
    /// Get the effective thread count
    pub fn get_thread_count(&self) -> usize {
        self.thread_count.unwrap_or_else(num_cpus::get)
    }
    
    /// Create a thread pool with the configured settings
    pub fn create_thread_pool(&self) -> rayon::ThreadPool {
        rayon::ThreadPoolBuilder::new()
            .num_threads(self.get_thread_count())
            .thread_name(|i| format!("luq-worker-{}", i))
            .build()
            .expect("Failed to create thread pool")
    }
    
    /// Configure the global rayon thread pool
    pub fn configure_global_thread_pool(&self) {
        rayon::ThreadPoolBuilder::new()
            .num_threads(self.get_thread_count())
            .thread_name(|i| format!("luq-global-{}", i))
            .build_global()
            .expect("Failed to configure global thread pool");
    }
}

/// Thread-safe configuration holder
pub struct ConfigHolder {
    config: Arc<CompilerConfig>,
}

impl ConfigHolder {
    pub fn new(config: CompilerConfig) -> Self {
        Self {
            config: Arc::new(config),
        }
    }
    
    pub fn get(&self) -> Arc<CompilerConfig> {
        Arc::clone(&self.config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_default_config() {
        let config = CompilerConfig::default();
        assert_eq!(config.thread_count, None);
        assert!(config.parallel_lexing);
        assert!(config.parallel_parsing);
    }
    
    #[test]
    fn test_thread_count() {
        let config = CompilerConfig::new().with_threads(4);
        assert_eq!(config.get_thread_count(), 4);
        
        let config = CompilerConfig::new();
        assert_eq!(config.get_thread_count(), num_cpus::get());
    }
}