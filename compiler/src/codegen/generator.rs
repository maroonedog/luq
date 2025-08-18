use crate::ast::Program;
use anyhow::Result;

pub trait CodeGenerator {
    fn generate(&self, program: &Program) -> Result<String>;
    
    fn generate_with_options(&self, program: &Program, _options: GeneratorOptions) -> Result<String> {
        // Default implementation ignores options
        self.generate(program)
    }
}

pub struct GeneratorOptions {
    pub aot: bool,
    pub include_types: bool,
    pub module_system: ModuleSystem,
}

pub enum ModuleSystem {
    CommonJS,
    ESModules,
}