#![allow(dead_code)]

use std::collections::HashMap;
use std::path::PathBuf;
use anyhow::Result;
use crate::ast::{Program, AstContext};

/// 依存関係グラフ
#[derive(Debug, Clone, Default)]
pub struct DependencyGraph {
    /// パスからモジュールノードへのマップ
    pub nodes: HashMap<PathBuf, ModuleNode>,
    /// エクスポート名からモジュールパスへのインデックス
    export_index: HashMap<String, Vec<PathBuf>>,
}

/// モジュールノード
#[derive(Debug, Clone)]
pub struct ModuleNode {
    pub path: PathBuf,
    pub imports: Vec<ImportInfo>,
    pub exports: Vec<ExportInfo>,
}

/// インポート情報
#[derive(Debug, Clone)]
pub struct ImportInfo {
    pub source: String,
    pub resolved_path: Option<PathBuf>,
    pub specifiers: Vec<crate::ast::ImportSpecifier>,
    pub span: Option<crate::ast::SourceSpan>,
}

/// エクスポート情報
#[derive(Debug, Clone)]
pub struct ParamInfo {
    pub name: String,
    pub type_str: Option<String>,
    pub optional: bool,
}

#[derive(Debug, Clone)]
pub struct ExportInfo {
    pub name: String,
    pub kind: ExportKind,
    pub is_default: bool,
    pub is_validator: bool,
    pub param_count: Option<usize>,
    pub params: Vec<ParamInfo>,
}

/// エクスポートの種類
#[derive(Debug, Clone, PartialEq)]
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

    /// Add or update a module in the graph
    pub fn add_or_update_module(&mut self, path: PathBuf, _program: &Program) -> Result<()> {
        // For the new zero-copy AST, we would need the AstContext to access actual data
        // For now, create empty node as we can't access string values without context
        let node = ModuleNode {
            path: path.clone(),
            imports: Vec::new(),
            exports: Vec::new(),
        };

        self.nodes.insert(path, node);
        Ok(())
    }

    /// Add or update a module with context
    pub fn add_or_update_module_with_context(
        &mut self, 
        path: PathBuf, 
        program: &Program,
        context: &AstContext
    ) -> Result<()> {
        eprintln!("=== add_or_update_module_with_context for {:?}", path);
        let mut imports = Vec::new();
        let mut exports = Vec::new();

        // Iterate through declarations in the new AST structure
        for i in 0..program.declarations.len() {
            let node_id = crate::ast::NodeId { 
                index: program.declarations.start.index + i as u32 
            };
            
            if let Some(node) = context.get_ast(node_id) {
                match node {
                    crate::ast::nodes::AstNode::Import { source, specifiers: _, .. } => {
                        // Process imports - need to convert StringIds
                        let source_str = context.get_str(*source).to_string();
                        
                        // Convert specifiers - this would need proper conversion logic
                        let import_specs = Vec::new(); // Placeholder
                        
                        imports.push(ImportInfo {
                            source: source_str,
                            resolved_path: None,
                            specifiers: import_specs,
                            span: None,
                        });
                    }
                    crate::ast::nodes::AstNode::Export { .. } => {
                        // Process exports - would need to extract nested declarations
                    }
                    crate::ast::nodes::AstNode::FunctionDecl { name, decorators, params, .. } => {
                        let name_str = context.get_str(*name).to_string();
                        
                        // Check for validator decorator
                        let is_validator = has_validator_decorator(decorators, context);
                        
                        // Extract parameter information
                        let mut param_infos = Vec::new();
                        for i in 0..params.len() {
                            let param_id = crate::ast::NodeId { 
                                index: params.start.index + i as u32 
                            };
                            if let Some(param) = context.get_param(param_id) {
                                let param_name = context.get_str(param.name).to_string();
                                let type_str = if let Some(type_id) = param.type_node {
                                    // Get type as string - simplified for now
                                    Some(format_type_node(type_id, context))
                                } else {
                                    None
                                };
                                param_infos.push(ParamInfo {
                                    name: param_name,
                                    type_str,
                                    optional: param.optional,
                                });
                            }
                        }
                        
                        exports.push(ExportInfo {
                            name: name_str.clone(),
                            kind: ExportKind::Function,
                            is_default: false,
                            is_validator,
                            param_count: Some(params.len()),
                            params: param_infos,
                        });
                    }
                    crate::ast::nodes::AstNode::TypeDecl { name, .. } => {
                        let name_str = context.get_str(*name).to_string();
                        
                        exports.push(ExportInfo {
                            name: name_str.clone(),
                            kind: ExportKind::Interface,
                            is_default: false,
                            is_validator: false,
                            param_count: None,
                            params: Vec::new(),
                        });
                    }
                    crate::ast::nodes::AstNode::TypeAlias { name, .. } => {
                        let name_str = context.get_str(*name).to_string();
                        
                        exports.push(ExportInfo {
                            name: name_str.clone(),
                            kind: ExportKind::TypeAlias,
                            is_default: false,
                            is_validator: false,
                            param_count: None,
                            params: Vec::new(),
                        });
                    }
                    _ => {}
                }
            }
        }

        // Update export index
        for export in &exports {
            self.export_index
                .entry(export.name.clone())
                .or_insert_with(Vec::new)
                .push(path.clone());
        }

        // Create or update node
        let node = ModuleNode {
            path: path.clone(),
            imports,
            exports,
        };

        eprintln!("  Added {} imports and {} exports", node.imports.len(), node.exports.len());
        for import in &node.imports {
            eprintln!("    Import: {}", import.source);
        }
        for export in &node.exports {
            eprintln!("    Export: {} (validator: {})", export.name, export.is_validator);
        }

        self.nodes.insert(path, node);
        Ok(())
    }
    
    /// Resolve imports for a module using the ImportResolver
    pub fn resolve_imports(&mut self, module_path: &PathBuf, resolver: &crate::dependency::ImportResolver) -> Result<()> {
        eprintln!("=== resolve_imports for {:?}", module_path);
        if let Some(node) = self.nodes.get_mut(module_path) {
            eprintln!("  Found {} imports to resolve", node.imports.len());
            for import in &mut node.imports {
                eprintln!("  Resolving import: {}", import.source);
                // Try to resolve the import path
                match resolver.resolve(module_path, &import.source) {
                    Ok(resolved) => {
                        eprintln!("    Resolved to: {:?}", resolved);
                        import.resolved_path = Some(resolved);
                    }
                    Err(e) => {
                        eprintln!("    Failed to resolve: {}", e);
                        // Continue even if resolution fails
                    }
                }
            }
        } else {
            eprintln!("  No node found for module path");
        }
        
        Ok(())
    }

    /// Get a module node by path
    pub fn get_node(&self, path: &PathBuf) -> Option<&ModuleNode> {
        self.nodes.get(path)
    }

    /// Find modules that export a given symbol
    pub fn find_exporters(&self, symbol: &str) -> Vec<&PathBuf> {
        self.export_index
            .get(symbol)
            .map(|paths| paths.iter().collect())
            .unwrap_or_default()
    }

    /// Get all module paths in the graph
    pub fn get_all_modules(&self) -> Vec<&PathBuf> {
        self.nodes.keys().collect()
    }

    /// Check if a module is in the graph
    pub fn contains_module(&self, path: &PathBuf) -> bool {
        self.nodes.contains_key(path)
    }

    /// Remove a module from the graph
    pub fn remove_module(&mut self, path: &PathBuf) -> Option<ModuleNode> {
        // Also remove from export index
        if let Some(node) = self.nodes.remove(path) {
            for export in &node.exports {
                if let Some(paths) = self.export_index.get_mut(&export.name) {
                    paths.retain(|p| p != path);
                    if paths.is_empty() {
                        self.export_index.remove(&export.name);
                    }
                }
            }
            Some(node)
        } else {
            None
        }
    }

    /// Clear the entire graph
    pub fn clear(&mut self) {
        self.nodes.clear();
        self.export_index.clear();
    }
}

/// Check if a decorator list contains @validator decorator
fn has_validator_decorator(decorators: &crate::ast::nodes::NodeList, _context: &crate::ast::AstContext) -> bool {
    // For now, return true for any function with decorators
    // The excluded_names list in validators.rs will filter out unwanted functions
    // This is a temporary workaround until decorator parsing is fully implemented
    
    // Check if the decorator list has the special marker
    if decorators.count > 0 && decorators.start.index == u32::MAX {
        return true;
    }
    
    // If there are any decorators, assume it might be @validator
    // The filtering is done by name in validators.rs
    decorators.count > 0
}

/// Format a type node as a string
fn format_type_node(type_id: crate::ast::NodeId, context: &crate::ast::AstContext) -> String {
    use crate::ast::nodes::TypeNode;
    
    if let Some(type_node) = context.get_type(type_id) {
        match type_node {
            TypeNode::String { .. } => "string".to_string(),
            TypeNode::Number { .. } => "number".to_string(),
            TypeNode::Boolean { .. } => "boolean".to_string(),
            TypeNode::Array { elem, .. } => {
                format!("{}[]", format_type_node(*elem, context))
            }
            TypeNode::Ref { target, .. } => {
                context.get_str(*target).to_string()
            }
            TypeNode::Union { variants, .. } => {
                let mut types = Vec::new();
                for i in 0..variants.len() {
                    let variant_id = crate::ast::NodeId { 
                        index: variants.start.index + i as u32 
                    };
                    types.push(format_type_node(variant_id, context));
                }
                types.join(" | ")
            }
            TypeNode::Optional { inner, .. } => {
                format!("{}?", format_type_node(*inner, context))
            }
            TypeNode::Literal { value, .. } => {
                use crate::ast::nodes::LiteralValue;
                match value {
                    LiteralValue::String(s) => format!("\"{}\"", context.get_str(*s)),
                    LiteralValue::Number(n) => n.to_string(),
                    LiteralValue::Boolean(b) => b.to_string(),
                    LiteralValue::Regex(r) => format!("/{}/", context.get_str(*r)),
                    LiteralValue::Null => "null".to_string(),
                    LiteralValue::Undefined => "undefined".to_string(),
                }
            }
            _ => "unknown".to_string(),
        }
    } else {
        "any".to_string()
    }
}