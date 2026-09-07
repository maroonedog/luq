// Command execution logic

use super::Commands;
use crate::config::CompilerConfig;
use anyhow::{Context, Result, bail};
use std::path::{Path, PathBuf};
use std::fs;
use std::io::Write;

pub async fn execute_command(command: Commands, config: CompilerConfig) -> Result<()> {
    match command {
        Commands::Compile { input, output, target, aot } => {
            compile_file(input, output, target, aot, config).await
        }
        Commands::Lsp { log_file, verbose } => {
            run_lsp_server(log_file, verbose).await
        }
        Commands::Check { input, recursive, verbose } => {
            check_files(input, recursive, verbose, config).await
        }
        Commands::Format { files, write, check } => {
            format_files(files, write, check).await
        }
        Commands::Deps { root, format, transitive } => {
            analyze_dependencies(root, format, transitive).await
        }
        Commands::Test { files, filter, parallel, verbose } => {
            run_tests(files, filter, parallel, verbose, config).await
        }
        Commands::Dts { files, outdir, jsdoc } => {
            generate_dts(files, outdir, jsdoc).await
        }
        Commands::Bundle { entry, output, minify, sourcemap } => {
            bundle_modules(entry, output, minify, sourcemap).await
        }
        Commands::Init { name, template, yes } => {
            init_project(name, template, yes).await
        }
        Commands::Version { verbose } => {
            show_version(verbose);
            Ok(())
        }
    }
}

async fn compile_file(
    input: PathBuf,
    output: Option<PathBuf>,
    target: String,
    aot: bool,
    config: CompilerConfig,
) -> Result<()> {
    println!("Compiling {} to {}", input.display(), target);
    
    // Read input file
    let source = fs::read_to_string(&input)
        .with_context(|| format!("Failed to read {}", input.display()))?;
    
    // Parse and compile
    let parser = crate::parser::Parser::new(source.clone());
    let (ast, context) = parser.parse(&source)
        .map_err(|e| anyhow::anyhow!("Parse error: {}", e))?;
    
    // Generate output
    let output_path = output.unwrap_or_else(|| {
        let mut path = input.clone();
        path.set_extension(match target.as_str() {
            "typescript" | "ts" => "ts",
            "javascript" | "js" => "js",
            "python" | "py" => "py",
            _ => &target,
        });
        path
    });
    
    // Write output based on target
    let code = match target.as_str() {
        "typescript" | "ts" => {
            let generator = crate::codegen::typescript::TypeScriptGenerator::new(false);
            use crate::codegen::generator::CodeGenerator;
            generator.generate(&ast)?
        }
        _ => {
            bail!("Unsupported target language: {}", target);
        }
    };
    
    fs::write(&output_path, code)
        .with_context(|| format!("Failed to write {}", output_path.display()))?;
    
    println!("✓ Compiled to {}", output_path.display());
    Ok(())
}

async fn run_lsp_server(log_file: Option<PathBuf>, verbose: bool) -> Result<()> {
    // Set up logging
    if let Some(log_path) = log_file {
        std::env::set_var("RUST_LOG", if verbose { "debug" } else { "info" });
        std::env::set_var("LUQ_LSP_LOG", log_path.to_string_lossy().to_string());
    }
    
    // Run server
    crate::lsp::run_server().await;
    Ok(())
}

async fn check_files(
    input: PathBuf,
    recursive: bool,
    verbose: bool,
    config: CompilerConfig,
) -> Result<()> {
    let files = if input.is_dir() {
        collect_luq_files(&input, recursive)?
    } else {
        vec![input]
    };
    
    let mut has_errors = false;
    
    for file in files {
        if verbose {
            println!("Checking {}", file.display());
        }
        
        let source = fs::read_to_string(&file)?;
        
        let parser = crate::parser::Parser::new(source.clone());
        match parser.parse(&source) {
            Ok((ast, context)) => {
                let validator = crate::ast::validation::AstValidator::new();
                if let Ok(errors) = validator.validate(&ast, &context) {
                    if !errors.is_empty() {
                        has_errors = true;
                        for error in errors {
                            eprintln!("{}: {}", file.display(), error);
                        }
                    }
                }
            }
            Err(e) => {
                has_errors = true;
                eprintln!("{}: Parse error: {}", file.display(), e);
            }
        }
    }
    
    if has_errors {
        bail!("Errors found during checking");
    } else {
        println!("✓ No errors found");
    }
    
    Ok(())
}

async fn format_files(files: Vec<PathBuf>, write: bool, check: bool) -> Result<()> {
    // TODO: Implement formatter
    println!("Formatting not yet implemented");
    Ok(())
}

async fn analyze_dependencies(root: PathBuf, format: String, transitive: bool) -> Result<()> {
    // TODO: Implement dependency analysis
    println!("Dependency analysis not yet implemented");
    Ok(())
}

async fn run_tests(
    files: Vec<PathBuf>,
    filter: Option<String>,
    parallel: bool,
    verbose: bool,
    config: CompilerConfig,
) -> Result<()> {
    // TODO: Implement test runner
    println!("Test runner not yet implemented");
    Ok(())
}

async fn generate_dts(files: Vec<PathBuf>, outdir: PathBuf, jsdoc: bool) -> Result<()> {
    // TODO: Implement .d.ts generator
    println!("TypeScript declaration generation not yet implemented");
    Ok(())
}

async fn bundle_modules(
    entry: PathBuf,
    output: Option<PathBuf>,
    minify: bool,
    sourcemap: bool,
) -> Result<()> {
    // TODO: Implement bundler
    println!("Bundling not yet implemented");
    Ok(())
}

async fn init_project(name: Option<String>, template: String, yes: bool) -> Result<()> {
    let project_name = name.unwrap_or_else(|| {
        if yes {
            "luq-project".to_string()
        } else {
            print!("Project name: ");
            std::io::stdout().flush().unwrap();
            let mut input = String::new();
            std::io::stdin().read_line(&mut input).unwrap();
            input.trim().to_string()
        }
    });
    
    // Create project directory
    fs::create_dir_all(&project_name)?;
    
    // Create basic files based on template
    let readme = format!("# {}\n\nA Luq project.\n", project_name);
    fs::write(Path::new(&project_name).join("README.md"), readme)?;
    
    let main_luq = match template.as_str() {
        "library" => "export type Result<T> = { ok: true, value: T } | { ok: false, error: string }\n",
        "application" => "function main() {\n    console.log(\"Hello from Luq!\")\n}\n\nmain()\n",
        _ => "// Welcome to Luq!\n",
    };
    fs::write(Path::new(&project_name).join("main.luq"), main_luq)?;
    
    println!("✓ Created project '{}'", project_name);
    Ok(())
}

fn show_version(verbose: bool) {
    if verbose {
        println!("Luq Compiler");
        println!("Version: {}", env!("CARGO_PKG_VERSION"));
        println!("Commit: {}", option_env!("GIT_HASH").unwrap_or("unknown"));
        println!("Built: {}", option_env!("BUILD_DATE").unwrap_or("unknown"));
    } else {
        println!("luqc {}", env!("CARGO_PKG_VERSION"));
    }
}

fn collect_luq_files(dir: &Path, recursive: bool) -> Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.is_file() && path.extension().map_or(false, |ext| ext == "luq") {
            files.push(path);
        } else if recursive && path.is_dir() {
            files.extend(collect_luq_files(&path, true)?);
        }
    }
    
    Ok(files)
}