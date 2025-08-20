use std::path::PathBuf;
use std::collections::{HashMap, HashSet};
use anyhow::Result;
use crate::ast::{Program, AstContext};
use super::graph::DependencyGraph;
use super::cycle_detector::CycleDetector;
use super::resolver::ImportResolver;

/// 依存関係分析器
pub struct DependencyAnalyzer {
    graph: DependencyGraph,
    #[allow(dead_code)]
    resolver: ImportResolver,
    pub config: crate::config::CompilerConfig,
}

impl DependencyAnalyzer {
    pub fn new(project_root: PathBuf) -> Self {
        Self {
            graph: DependencyGraph::new(),
            resolver: ImportResolver::new(project_root),
            config: crate::config::CompilerConfig::default(),
        }
    }
    
    pub fn with_config(project_root: PathBuf, config: crate::config::CompilerConfig) -> Self {
        Self {
            graph: DependencyGraph::new(),
            resolver: ImportResolver::new(project_root),
            config,
        }
    }
    
    /// ワークスペース全体を分析
    pub async fn analyze_workspace(&mut self, root: &PathBuf) -> Result<()> {
        use tokio::fs;
        use glob::glob;
        use crate::parallel::ParallelProcessor;
        
        // .luqファイルを全て検索
        let pattern = format!("{}/**/*.luq", root.display());
        let files: Vec<PathBuf> = glob(&pattern)?
            .filter_map(Result::ok)
            .collect();
        
        if files.is_empty() {
            return Ok(());
        }
        
        if self.config.parallel_parsing && files.len() > 1 {
            // Use parallel processing for multiple files
            let processor = ParallelProcessor::new(self.config.clone());
            let results = processor.parse_files_async(files).await;
            
            // Add successfully parsed files to the dependency graph
            for result in results {
                if let (Ok(program), Some(context)) = (result.program, result.context) {
                    self.graph.add_or_update_module_with_context(
                        result.file_path,
                        &program,
                        &context,
                    )?;
                }
            }
        } else {
            // Sequential processing for small number of files or when parallel is disabled
            for file_path in &files {
                if let Ok(content) = fs::read_to_string(&file_path).await {
                    if let Ok((program, context)) = self.parse_file(&content).await {
                        self.graph.add_or_update_module_with_context(
                            file_path.clone(), 
                            &program,
                            &context
                        )?;
                    }
                }
            }
        }
        
        Ok(())
    }
    
    /// 単一ファイルを分析
    pub async fn analyze_file(&mut self, path: PathBuf, content: &str) -> Result<()> {
        let (program, context) = self.parse_file(content).await?;
        self.graph.add_or_update_module_with_context(path.clone(), &program, &context)?;
        Ok(())
    }
    
    /// ファイルをパース
    async fn parse_file(&self, content: &str) -> Result<(Program, AstContext)> {
        use crate::parallel::ParallelLexer;
        
        // Use parallel lexing for large files in dependency analysis
        let parser = crate::parser::Parser::new(content.to_string());
        parser.parse(content)
            .map_err(|e| anyhow::anyhow!("Parse error: {}", e))
    }
    
    /// インポートの検証
    pub fn validate_imports(&self, path: &PathBuf) -> Vec<ImportValidationError> {
        let mut errors = Vec::new();
        
        if let Some(node) = self.graph.get_node(path) {
            for import in &node.imports {
                // インポートパスが解決できているか確認
                if import.resolved_path.is_none() {
                    errors.push(ImportValidationError {
                        source_file: path.clone(),
                        import_path: import.source.clone(),
                        kind: ValidationErrorKind::UnresolvedModule,
                        message: format!("Cannot resolve module '{}'", import.source),
                    });
                    continue;
                }
                
                let resolved = import.resolved_path.as_ref().unwrap();
                
                // エクスポートされているか確認
                if let Some(_target_node) = self.graph.get_node(resolved) {
                    // For new AST, we would need context to validate specifiers
                    // For now, skip detailed validation
                } else {
                    errors.push(ImportValidationError {
                        source_file: path.clone(),
                        import_path: import.source.clone(),
                        kind: ValidationErrorKind::ModuleNotAnalyzed,
                        message: format!("Module '{}' has not been analyzed", import.source),
                    });
                }
            }
        }
        
        errors
    }
    
    /// 循環依存を検出
    pub fn detect_circular_dependencies(&self) -> Vec<Vec<PathBuf>> {
        let cycle_detector = CycleDetector::from_graph(&self.graph);
        cycle_detector.detect_cycles()
    }
    
    /// 特定のファイルが循環依存に含まれているかチェック
    pub fn is_in_cycle(&self, path: &PathBuf) -> bool {
        let cycle_detector = CycleDetector::from_graph(&self.graph);
        cycle_detector.is_in_cycle(path)
    }
    
    /// 循環依存を人間が読みやすい形式で取得
    pub fn format_cycles(&self) -> Vec<String> {
        let cycle_detector = CycleDetector::from_graph(&self.graph);
        cycle_detector.format_cycles()
    }
    
    /// ファイル変更の影響範囲を取得
    pub fn get_affected_files(&self, changed_file: &PathBuf) -> HashSet<PathBuf> {
        let mut affected = HashSet::new();
        
        // Find all modules that import from the changed file
        for (path, node) in self.graph.get_all_modules().iter().zip(
            self.graph.get_all_modules().iter().filter_map(|p| self.graph.get_node(p))
        ) {
            for import in &node.imports {
                if import.resolved_path.as_ref() == Some(changed_file) {
                    affected.insert((*path).clone());
                }
            }
        }
        
        affected
    }
    
    /// 未使用のエクスポートを検出
    pub fn find_unused_exports(&self) -> HashMap<PathBuf, Vec<String>> {
        let mut unused = HashMap::new();
        
        // Collect all imported symbols
        let mut imported_symbols: HashSet<(PathBuf, String)> = HashSet::new();
        
        for node in self.graph.get_all_modules().iter().filter_map(|p| self.graph.get_node(p)) {
            for import in &node.imports {
                if let Some(resolved) = &import.resolved_path {
                    // Would need context to extract actual import names
                    // For now, mark all as used
                    if let Some(target) = self.graph.get_node(resolved) {
                        for export in &target.exports {
                            imported_symbols.insert((resolved.clone(), export.name.clone()));
                        }
                    }
                }
            }
        }
        
        // Find exports that are not imported
        for path in self.graph.get_all_modules() {
            if let Some(node) = self.graph.get_node(path) {
                let mut file_unused = Vec::new();
                
                for export in &node.exports {
                    if !imported_symbols.contains(&(path.clone(), export.name.clone())) {
                        file_unused.push(export.name.clone());
                    }
                }
                
                if !file_unused.is_empty() {
                    unused.insert(path.clone(), file_unused);
                }
            }
        }
        
        unused
    }
    
    /// すべての検証エラーを取得（循環依存も含む）
    pub fn validate_all(&self) -> Vec<ImportValidationError> {
        let mut errors = Vec::new();
        
        // 各ファイルのインポート検証
        for path in self.graph.get_all_modules() {
            errors.extend(self.validate_imports(path));
        }
        
        // 循環依存の検証
        let cycles = self.detect_circular_dependencies();
        for cycle in cycles {
            let cycle_str = cycle.iter()
                .map(|p| p.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("?"))
                .collect::<Vec<_>>()
                .join(" -> ");
            
            for path in &cycle {
                errors.push(ImportValidationError {
                    source_file: path.clone(),
                    import_path: cycle_str.clone(),
                    kind: ValidationErrorKind::CircularDependency,
                    message: format!("Circular dependency detected: {}", cycle_str),
                });
            }
        }
        
        errors
    }
    
    /// グラフを取得（テスト用）
    pub fn get_graph(&self) -> &DependencyGraph {
        &self.graph
    }
}

/// インポート検証エラー
#[derive(Debug, Clone)]
pub struct ImportValidationError {
    pub source_file: PathBuf,
    pub import_path: String,
    pub kind: ValidationErrorKind,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ValidationErrorKind {
    UnresolvedModule,
    NamedImportNotFound,
    ModuleNotAnalyzed,
    CircularDependency,
}