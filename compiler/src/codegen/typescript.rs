#![allow(dead_code)]

use crate::ast::Program;
use crate::codegen::generator::CodeGenerator;
use anyhow::Result;

#[allow(dead_code)]
pub struct TypeScriptGenerator {
    _indent_level: usize,
    aot: bool,
}

impl TypeScriptGenerator {
    #[allow(dead_code)]
    pub fn new(aot: bool) -> Self {
        Self {
            _indent_level: 0,
            aot,
        }
    }
}

impl CodeGenerator for TypeScriptGenerator {
    fn generate(&self, _program: &Program) -> Result<String> {
        // TODO: Implement TypeScript code generation for zero-copy AST
        // This requires AstContext to access string values
        Ok("// TypeScript generation not yet implemented for zero-copy AST".to_string())
    }
}