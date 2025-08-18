use serde::{Serialize, Deserialize};
use super::interface::InterfaceDecl;
use super::function::FunctionDecl;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Program {
    pub statements: Vec<Statement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Statement {
    Interface(InterfaceDecl),
    Function(FunctionDecl),
    TypeAlias(TypeAlias),
    Import(ImportDecl),
    Export(ExportDecl),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeAlias {
    pub name: String,
    pub type_params: Option<Vec<super::types::TypeParam>>,
    pub type_annotation: super::types::TypeAnnotation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportDecl {
    pub specifiers: Vec<ImportSpecifier>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum ImportSpecifier {
    Named { name: String, alias: Option<String> },
    Default(String),
    Namespace(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportDecl {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub statement: Option<Box<Statement>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub specifiers: Option<Vec<ExportSpecifier>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default)]
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum ExportSpecifier {
    Named { name: String, alias: Option<String> },
    Default(String),
    Namespace(String),
}