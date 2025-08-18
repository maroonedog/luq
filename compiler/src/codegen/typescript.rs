use crate::ast::{InterfaceDecl, Program, Statement};
use crate::codegen::generator::CodeGenerator;
use anyhow::Result;
use std::fmt::Write;

pub struct TypeScriptGenerator {
    _indent_level: usize,
    aot: bool,
}

impl TypeScriptGenerator {
    pub fn new(aot: bool) -> Self {
        Self {
            _indent_level: 0,
            aot,
        }
    }

    fn _indent(&self) -> String {
        "  ".repeat(self._indent_level)
    }

    fn generate_interface(&self, interface: &InterfaceDecl) -> Result<String> {
        let mut output = String::new();

        if self.aot {
            // Generate AOT validation function
            writeln!(
                &mut output,
                "export function validate{}(data: unknown): data is {} {{",
                interface.name, interface.name
            )?;
            
            writeln!(&mut output, "  if (typeof data !== 'object' || data === null) return false;")?;
            
            // Generate field validations based on decorators
            for member in &interface.members {
                self.generate_field_validation(&mut output, member)?;
            }
            
            writeln!(&mut output, "  return true;")?;
            writeln!(&mut output, "}}")?;
            
        } else {
            // Generate TypeScript interface
            writeln!(&mut output, "interface {} {{", interface.name)?;
            
            for member in &interface.members {
                let optional = if member.optional { "?" } else { "" };
                writeln!(
                    &mut output,
                    "  {}{}: {};",
                    member.key,
                    optional,
                    self.type_annotation_to_string(&member.type_annotation)
                )?;
            }
            
            writeln!(&mut output, "}}")?;
        }

        Ok(output)
    }

    fn generate_field_validation(
        &self,
        output: &mut String,
        member: &crate::ast::InterfaceMember,
    ) -> Result<()> {
        let field_access = format!("data.{}", member.key);
        
        // Check for @required decorator
        let is_required = member.decorators.iter().any(|d| d.name == "required");
        
        if is_required || !member.optional {
            writeln!(
                output,
                "  if ({} === undefined || {} === null) return false;",
                field_access, field_access
            )?;
        }
        
        // Type checking based on type annotation
        match &member.type_annotation {
            crate::ast::TypeAnnotation::String => {
                writeln!(
                    output,
                    "  if (typeof {} !== 'string') return false;",
                    field_access
                )?;
            }
            crate::ast::TypeAnnotation::Number => {
                writeln!(
                    output,
                    "  if (typeof {} !== 'number') return false;",
                    field_access
                )?;
            }
            crate::ast::TypeAnnotation::Boolean => {
                writeln!(
                    output,
                    "  if (typeof {} !== 'boolean') return false;",
                    field_access
                )?;
            }
            _ => {}
        }
        
        // Process validation decorators
        for decorator in &member.decorators {
            match decorator.name.as_str() {
                "min" => {
                    // TODO: Extract min value from decorator args
                    writeln!(output, "  // TODO: min validation")?;
                }
                "max" => {
                    // TODO: Extract max value from decorator args
                    writeln!(output, "  // TODO: max validation")?;
                }
                "email" => {
                    writeln!(
                        output,
                        "  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test({})) return false;",
                        field_access
                    )?;
                }
                "pattern" => {
                    // TODO: Extract pattern from decorator args
                    writeln!(output, "  // TODO: pattern validation")?;
                }
                _ => {}
            }
        }
        
        Ok(())
    }

    fn type_annotation_to_string(&self, type_ann: &crate::ast::TypeAnnotation) -> String {
        match type_ann {
            crate::ast::TypeAnnotation::String => "string".to_string(),
            crate::ast::TypeAnnotation::Number => "number".to_string(),
            crate::ast::TypeAnnotation::Boolean => "boolean".to_string(),
            crate::ast::TypeAnnotation::Array(inner) => {
                format!("{}[]", self.type_annotation_to_string(inner))
            }
            crate::ast::TypeAnnotation::Reference { name, .. } => name.clone(),
            _ => "any".to_string(),
        }
    }
}

impl CodeGenerator for TypeScriptGenerator {
    fn generate(&self, program: &Program) -> Result<String> {
        let mut output = String::new();

        for statement in &program.statements {
            match statement {
                Statement::Interface(interface) => {
                    let code = self.generate_interface(interface)?;
                    output.push_str(&code);
                    output.push('\n');
                }
                _ => {
                    // TODO: Handle other statement types
                }
            }
        }

        Ok(output)
    }
}