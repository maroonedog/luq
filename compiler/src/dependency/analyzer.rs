use std::path::PathBuf;
use std::collections::{HashMap, HashSet};
use anyhow::Result;
use crate::ast::{Program, Statement, ImportSpecifier};
use super::graph::{DependencyGraph, ImportInfo, ExportInfo, ExportKind};
use super::resolver::ImportResolver;

/// 依存関係分析器
pub struct DependencyAnalyzer {
    graph: DependencyGraph,
    resolver: ImportResolver,
}

impl DependencyAnalyzer {
    pub fn new(project_root: PathBuf) -> Self {
        Self {
            graph: DependencyGraph::new(),
            resolver: ImportResolver::new(project_root),
        }
    }
    
    /// ワークスペース全体を分析
    pub async fn analyze_workspace(&mut self, root: &PathBuf) -> Result<()> {
        use tokio::fs;
        use glob::glob;
        
        // .luqファイルを全て検索
        let pattern = format!("{}/**/*.luq", root.display());
        let files: Vec<PathBuf> = glob(&pattern)?
            .filter_map(Result::ok)
            .collect();
        
        // 全ファイルをパースしてグラフに追加
        for file_path in &files {
            if let Ok(content) = fs::read_to_string(&file_path).await {
                if let Ok(program) = self.parse_file(&content).await {
                    self.graph.add_or_update_module(file_path.clone(), &program)?;
                }
            }
        }
        
        // 依存関係を解決
        for file_path in &files {
            self.graph.resolve_dependencies(&file_path, &self.resolver)?;
        }
        
        Ok(())
    }
    
    /// 単一ファイルを分析
    pub async fn analyze_file(&mut self, path: PathBuf, content: &str) -> Result<()> {
        let program = self.parse_file(content).await?;
        self.graph.add_or_update_module(path.clone(), &program)?;
        self.graph.resolve_dependencies(&path, &self.resolver)?;
        Ok(())
    }
    
    /// ファイルをパース
    async fn parse_file(&self, content: &str) -> Result<Program> {
        let mut lexer = crate::lexer::Lexer::new(content);
        let tokens = lexer.tokenize().await?;
        let mut parser = crate::parser::Parser::new(tokens);
        parser.parse().await
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
                if let Some(target_node) = self.graph.get_node(resolved) {
                    for specifier in &import.specifiers {
                        if !self.is_exported(&target_node.exports, specifier) {
                            let name = self.get_specifier_name(specifier);
                            errors.push(ImportValidationError {
                                source_file: path.clone(),
                                import_path: import.source.clone(),
                                kind: ValidationErrorKind::NamedImportNotFound,
                                message: format!(
                                    "Module '{}' has no exported member '{}'",
                                    import.source, name
                                ),
                            });
                        }
                    }
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
    
    /// 特定のシンボルがエクスポートされているか確認
    fn is_exported(&self, exports: &[ExportInfo], specifier: &ImportSpecifier) -> bool {
        match specifier {
            ImportSpecifier::Named { name, .. } => {
                exports.iter().any(|e| &e.name == name && !e.is_default)
            }
            ImportSpecifier::Default(_) => {
                exports.iter().any(|e| e.is_default)
            }
            ImportSpecifier::Namespace(_) => true, // namespace importは常に有効
        }
    }
    
    fn get_specifier_name(&self, specifier: &ImportSpecifier) -> String {
        match specifier {
            ImportSpecifier::Named { name, alias } => {
                alias.as_ref().unwrap_or(name).clone()
            }
            ImportSpecifier::Default(name) => name.clone(),
            ImportSpecifier::Namespace(name) => format!("* as {}", name),
        }
    }
    
    /// 循環依存を検出
    pub fn detect_circular_dependencies(&self) -> Vec<Vec<PathBuf>> {
        self.graph.detect_cycles()
    }
    
    /// ファイル変更の影響範囲を取得
    pub fn get_affected_files(&self, changed_file: &PathBuf) -> HashSet<PathBuf> {
        self.graph.get_affected_files(changed_file)
    }
    
    /// 未使用のエクスポートを検出
    pub fn find_unused_exports(&self) -> HashMap<PathBuf, Vec<String>> {
        let mut unused = HashMap::new();
        
        // 全エクスポートを収集
        let mut all_imports: HashSet<(PathBuf, String)> = HashSet::new();
        
        for (path, node) in &self.graph.nodes {
            for import in &node.imports {
                if let Some(resolved) = &import.resolved_path {
                    for spec in &import.specifiers {
                        let name = self.get_specifier_name(spec);
                        all_imports.insert((resolved.clone(), name));
                    }
                }
            }
        }
        
        // 使用されていないエクスポートを検出
        for (path, node) in &self.graph.nodes {
            let mut file_unused = Vec::new();
            
            for export in &node.exports {
                if !all_imports.contains(&(path.clone(), export.name.clone())) {
                    file_unused.push(export.name.clone());
                }
            }
            
            if !file_unused.is_empty() {
                unused.insert(path.clone(), file_unused);
            }
        }
        
        unused
    }
    
    /// グラフの統計情報を取得
    pub fn get_stats(&self) -> DependencyStats {
        let stats = self.graph.stats();
        let circular_deps = self.detect_circular_dependencies();
        let unused_exports = self.find_unused_exports();
        
        DependencyStats {
            total_modules: stats.total_modules,
            total_exports: stats.total_exports,
            total_dependencies: stats.total_dependencies,
            circular_dependencies: circular_deps.len(),
            unused_exports: unused_exports.values().map(|v| v.len()).sum(),
            files_with_unused_exports: unused_exports.len(),
        }
    }
}

#[derive(Debug)]
pub struct ImportValidationError {
    pub source_file: PathBuf,
    pub import_path: String,
    pub kind: ValidationErrorKind,
    pub message: String,
}

#[derive(Debug)]
pub enum ValidationErrorKind {
    UnresolvedModule,
    NamedImportNotFound,
    ModuleNotAnalyzed,
    CircularDependency,
}

#[derive(Debug)]
pub struct DependencyStats {
    pub total_modules: usize,
    pub total_exports: usize,
    pub total_dependencies: usize,
    pub circular_dependencies: usize,
    pub unused_exports: usize,
    pub files_with_unused_exports: usize,
}