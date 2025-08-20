#![allow(dead_code)]

use crate::ast::Program;
use anyhow::Result;

#[allow(dead_code)]
pub trait CodeGenerator {
    fn generate(&self, program: &Program) -> Result<String>;
    
    fn generate_with_options(&self, program: &Program, _options: GeneratorOptions) -> Result<String> {
        // Default implementation ignores options
        self.generate(program)
    }
}

#[allow(dead_code)]
pub struct GeneratorOptions {
    pub aot: bool,
    pub include_types: bool,
    pub module_system: ModuleSystem,
}

#[allow(dead_code)]
pub enum ModuleSystem {
    CommonJS,
    ESModules,
}