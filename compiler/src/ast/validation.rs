// AST validation module

use super::*;
use anyhow::Result;

/// AST validator stub
pub struct AstValidator;

impl AstValidator {
    pub fn new() -> Self {
        AstValidator
    }

    pub fn validate(&self, _program: &Program, _context: &AstContext) -> Result<Vec<String>> {
        // Validation not yet implemented for zero-copy AST
        Ok(Vec::new())
    }
}

impl Default for AstValidator {
    fn default() -> Self {
        Self::new()
    }
}