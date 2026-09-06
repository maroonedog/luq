// Command definitions for CLI

use clap::Subcommand;
use std::path::PathBuf;

#[derive(Subcommand)]
pub enum Commands {
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

    /// Start the language server
    Lsp {
        /// Log file path for debugging
        #[arg(long)]
        log_file: Option<PathBuf>,
        
        /// Enable verbose logging
        #[arg(long)]
        verbose: bool,
    },

    /// Check a .luq file for errors without compiling
    Check {
        /// Input .luq file or directory
        input: PathBuf,

        /// Check all .luq files recursively
        #[arg(short, long)]
        recursive: bool,
        
        /// Show detailed error information
        #[arg(long)]
        verbose: bool,
    },

    /// Format .luq files
    Format {
        /// Input files or directories
        files: Vec<PathBuf>,

        /// Write formatted output back to files
        #[arg(short, long)]
        write: bool,

        /// Check if files are formatted without changing them
        #[arg(long)]
        check: bool,
    },

    /// Analyze dependencies and imports
    Deps {
        /// Root directory to analyze
        #[arg(default_value = ".")]
        root: PathBuf,

        /// Output format (text, json, dot)
        #[arg(short, long, default_value = "text")]
        format: String,

        /// Include transitive dependencies
        #[arg(long)]
        transitive: bool,
    },

    /// Run tests defined in .luq files
    Test {
        /// Test files or directories
        files: Vec<PathBuf>,

        /// Filter tests by pattern
        #[arg(short, long)]
        filter: Option<String>,

        /// Run tests in parallel
        #[arg(long)]
        parallel: bool,

        /// Show verbose output
        #[arg(short, long)]
        verbose: bool,
    },

    /// Generate TypeScript declaration files
    Dts {
        /// Input .luq files
        files: Vec<PathBuf>,

        /// Output directory
        #[arg(short, long, default_value = ".")]
        outdir: PathBuf,

        /// Include JSDoc comments
        #[arg(long)]
        jsdoc: bool,
    },

    /// Package .luq modules into a single file
    Bundle {
        /// Entry point file
        entry: PathBuf,

        /// Output bundle file
        #[arg(short, long)]
        output: Option<PathBuf>,

        /// Minify output
        #[arg(long)]
        minify: bool,

        /// Generate source maps
        #[arg(long)]
        sourcemap: bool,
    },

    /// Initialize a new Luq project
    Init {
        /// Project name
        name: Option<String>,

        /// Project template (basic, library, application)
        #[arg(long, default_value = "basic")]
        template: String,

        /// Skip interactive prompts
        #[arg(long)]
        yes: bool,
    },

    /// Display version information
    Version {
        /// Show detailed version info
        #[arg(long)]
        verbose: bool,
    },
}