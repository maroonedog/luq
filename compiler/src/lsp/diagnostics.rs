use tower_lsp::lsp_types::*;
use crate::ast::Program;

pub fn analyze_program(_program: &Program) -> Vec<Diagnostic> {
    // TODO: Implement diagnostics for zero-copy AST
    // This requires AstContext to access string values
    Vec::new()
}