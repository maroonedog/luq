use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::time::SystemTime;
use crate::ast::{Program, Statement, ImportDecl, ExportDecl, ImportSpecifier};
use crate::lexer::Span;
use anyhow::Result;

#[derive(Debug, Clone)]
pub struct DependencyGraph {
    // ファイルパス -> モジュール情報
    pub nodes: HashMap<PathBuf, ModuleNode>,
    // エクスポートシンボルのグローバルインデックス
    // シンボル名 -> それをエクスポートしているファイルのリスト
    pub export_index: HashMap<String, Vec<PathBuf>>,
}

#[derive(Debug, Clone)]
pub struct ModuleNode {
    pub path: PathBuf,
    pub imports: Vec<ImportInfo>,
    pub exports: Vec<ExportInfo>,
    pub dependencies: HashSet<PathBuf>,  // このモジュールが依存するファイル
    pub dependents: HashSet<PathBuf>,    // このモジュールに依存するファイル  
    pub last_modified: SystemTime,
    pub cached_ast: Option<Program>,
}

#[derive(Debug, Clone)]
pub struct ImportInfo {
    pub source: String,  // "./user.luq"
    pub resolved_path: Option<PathBuf>,
    pub specifiers: Vec<ImportSpecifier>,
    pub span: Option<Span>,
}

#[derive(Debug, Clone)]
pub struct ExportInfo {
    pub name: String,
    pub kind: ExportKind,
    pub is_default: bool,
}

#[derive(Debug, Clone)]
pub enum ExportKind {
    Interface,
    Function,
    TypeAlias,
    Variable,
    ReExport { source: String },
}

impl DependencyGraph {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            export_index: HashMap::new(),
        }
    }

    /// ファイルをグラフに追加または更新
    pub fn add_or_update_module(&mut self, path: PathBuf, program: &Program) -> Result<()> {
        let mut imports = Vec::new();
        let mut exports = Vec::new();

        // ASTからimport/export情報を抽出
        for statement in &program.statements {
            match statement {
                Statement::Import(import_decl) => {
                    imports.push(ImportInfo {
                        source: import_decl.source.clone(),
                        resolved_path: None,
                        specifiers: import_decl.specifiers.clone(),
                        span: None,
                    });
                }
                Statement::Export(export_decl) => {
                    // エクスポート情報を収集
                    if let Some(stmt) = &export_decl.statement {
                        match stmt.as_ref() {
                            Statement::Interface(interface) => {
                                exports.push(ExportInfo {
                                    name: interface.name.clone(),
                                    kind: ExportKind::Interface,
                                    is_default: false,
                                });
                            }
                            Statement::Function(function) => {
                                exports.push(ExportInfo {
                                    name: function.name.clone(),
                                    kind: ExportKind::Function,
                                    is_default: false,
                                });
                            }
                            Statement::TypeAlias(type_alias) => {
                                exports.push(ExportInfo {
                                    name: type_alias.name.clone(),
                                    kind: ExportKind::TypeAlias,
                                    is_default: false,
                                });
                            }
                            _ => {}
                        }
                    }
                }
                Statement::Interface(interface) => {
                    // トップレベルのinterfaceは暗黙的にエクスポート
                    exports.push(ExportInfo {
                        name: interface.name.clone(),
                        kind: ExportKind::Interface,
                        is_default: false,
                    });
                }
                Statement::Function(function) => {
                    // トップレベルのfunctionは暗黙的にエクスポート
                    exports.push(ExportInfo {
                        name: function.name.clone(),
                        kind: ExportKind::Function,
                        is_default: false,
                    });
                }
                _ => {}
            }
        }

        // エクスポートインデックスを更新
        for export in &exports {
            self.export_index
                .entry(export.name.clone())
                .or_insert_with(Vec::new)
                .push(path.clone());
        }

        // ノードを作成または更新
        let node = ModuleNode {
            path: path.clone(),
            imports,
            exports,
            dependencies: HashSet::new(),
            dependents: HashSet::new(),
            last_modified: SystemTime::now(),
            cached_ast: Some(program.clone()),
        };

        self.nodes.insert(path, node);
        Ok(())
    }

    /// インポートパスを解決して依存関係を更新
    pub fn resolve_dependencies(&mut self, path: &PathBuf, resolver: &super::resolver::ImportResolver) -> Result<()> {
        // まずインポートを解決して結果を収集
        let mut resolved_imports = Vec::new();
        {
            let node = self.nodes.get_mut(path).ok_or_else(|| {
                anyhow::anyhow!("Module not found in graph: {:?}", path)
            })?;

            for import in &mut node.imports {
                // インポートパスを解決
                match resolver.resolve(path, &import.source) {
                    Ok(resolved) => {
                        import.resolved_path = Some(resolved.clone());
                        resolved_imports.push(resolved.clone());
                    }
                    Err(e) => {
                        eprintln!("Failed to resolve import '{}': {}", import.source, e);
                    }
                }
            }
        }

        // 依存関係を更新
        let mut dependencies = HashSet::new();
        for resolved in &resolved_imports {
            dependencies.insert(resolved.clone());
            // 依存先のdependentsを更新
            if let Some(target) = self.nodes.get_mut(resolved) {
                target.dependents.insert(path.clone());
            }
        }

        if let Some(node) = self.nodes.get_mut(path) {
            node.dependencies = dependencies;
        }

        Ok(())
    }

    /// 特定のファイルのモジュール情報を取得
    pub fn get_node(&self, path: &PathBuf) -> Option<&ModuleNode> {
        self.nodes.get(path)
    }

    /// エクスポートされているシンボルを検索
    pub fn find_export(&self, name: &str) -> Vec<&PathBuf> {
        self.export_index
            .get(name)
            .map(|paths| paths.iter().collect())
            .unwrap_or_default()
    }

    /// 循環依存を検出
    pub fn detect_cycles(&self) -> Vec<Vec<PathBuf>> {
        let detector = super::cycle_detector::CycleDetector::from_graph(self);
        detector.detect_cycles()
    }

    /// ファイルが変更された時の影響範囲を計算
    pub fn get_affected_files(&self, changed_file: &PathBuf) -> HashSet<PathBuf> {
        let mut affected = HashSet::new();
        affected.insert(changed_file.clone());

        // このファイルに依存している全てのファイルを収集
        if let Some(node) = self.nodes.get(changed_file) {
            for dependent in &node.dependents {
                affected.insert(dependent.clone());
                // 再帰的に依存を辿る
                self.collect_dependents_recursive(dependent, &mut affected);
            }
        }

        affected
    }

    fn collect_dependents_recursive(&self, path: &PathBuf, collected: &mut HashSet<PathBuf>) {
        if let Some(node) = self.nodes.get(path) {
            for dependent in &node.dependents {
                if collected.insert(dependent.clone()) {
                    self.collect_dependents_recursive(dependent, collected);
                }
            }
        }
    }

    /// グラフの統計情報
    pub fn stats(&self) -> GraphStats {
        GraphStats {
            total_modules: self.nodes.len(),
            total_exports: self.export_index.len(),
            total_dependencies: self.nodes.values()
                .map(|n| n.dependencies.len())
                .sum(),
            cycles: self.detect_cycles().len(),
        }
    }
}

#[derive(Debug)]
pub struct GraphStats {
    pub total_modules: usize,
    pub total_exports: usize,
    pub total_dependencies: usize,
    pub cycles: usize,
}