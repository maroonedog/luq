use crate::ast::{DecoratorArg, InterfaceDecl, InterfaceMember, Program, Statement};
use anyhow::{bail, Result};
use std::collections::HashSet;

/// Validates an AST program for semantic correctness
pub struct AstValidator {
    /// Known validator decorator names
    known_decorators: HashSet<String>,
}

impl AstValidator {
    pub fn new() -> Self {
        let mut known_decorators = HashSet::new();
        
        // Common validation decorators
        known_decorators.insert("validator".to_string());
        known_decorators.insert("required".to_string());
        known_decorators.insert("optional".to_string());
        known_decorators.insert("min".to_string());
        known_decorators.insert("max".to_string());
        known_decorators.insert("minLength".to_string());
        known_decorators.insert("maxLength".to_string());
        known_decorators.insert("arrayMin".to_string());
        known_decorators.insert("arrayMax".to_string());
        known_decorators.insert("pattern".to_string());
        known_decorators.insert("email".to_string());
        known_decorators.insert("url".to_string());
        known_decorators.insert("uuid".to_string());
        known_decorators.insert("trim".to_string());
        known_decorators.insert("lowercase".to_string());
        known_decorators.insert("uppercase".to_string());
        known_decorators.insert("transform".to_string());
        known_decorators.insert("nested".to_string());
        known_decorators.insert("each".to_string());
        known_decorators.insert("oneOf".to_string());
        known_decorators.insert("range".to_string());
        known_decorators.insert("precision".to_string());
        known_decorators.insert("conditional".to_string());
        known_decorators.insert("custom".to_string());
        known_decorators.insert("validate".to_string());
        known_decorators.insert("rules".to_string());
        known_decorators.insert("messages".to_string());
        known_decorators.insert("array".to_string());
        known_decorators.insert("generateSchema".to_string());
        known_decorators.insert("controller".to_string());
        known_decorators.insert("authenticated".to_string());
        known_decorators.insert("get".to_string());
        known_decorators.insert("post".to_string());
        known_decorators.insert("put".to_string());
        known_decorators.insert("delete".to_string());
        known_decorators.insert("cache".to_string());
        known_decorators.insert("authorize".to_string());
        known_decorators.insert("config".to_string());
        known_decorators.insert("values".to_string());
        known_decorators.insert("message".to_string());
        
        Self { known_decorators }
    }
    
    /// Validate a complete program
    pub fn validate_program(&self, program: &Program) -> Result<()> {
        // Check for duplicate interface names
        let mut interface_names = HashSet::new();
        
        for statement in &program.statements {
            match statement {
                Statement::Interface(interface) => {
                    if !interface_names.insert(&interface.name) {
                        bail!("Duplicate interface name: {}", interface.name);
                    }
                    
                    self.validate_interface(interface)?;
                }
                _ => {
                    // Other statement types not yet implemented
                }
            }
        }
        
        Ok(())
    }
    
    /// Validate an interface declaration
    pub fn validate_interface(&self, interface: &InterfaceDecl) -> Result<()> {
        // Validate interface decorators
        for decorator in &interface.decorators {
            self.validate_decorator_usage(&decorator.name, &decorator.args, DecoratorContext::Interface)?;
        }
        
        // Check for duplicate member names
        let mut member_names = HashSet::new();
        
        for member in &interface.members {
            if !member_names.insert(&member.key) {
                bail!("Duplicate member name in interface {}: {}", interface.name, member.key);
            }
            
            self.validate_interface_member(member)?;
        }
        
        Ok(())
    }
    
    /// Validate an interface member
    pub fn validate_interface_member(&self, member: &InterfaceMember) -> Result<()> {
        // Validate member decorators
        for decorator in &member.decorators {
            self.validate_decorator_usage(&decorator.name, &decorator.args, DecoratorContext::Field)?;
        }
        
        // Check for conflicting decorators
        self.check_decorator_conflicts(member)?;
        
        Ok(())
    }
    
    /// Check for conflicting decorators on a member
    fn check_decorator_conflicts(&self, member: &InterfaceMember) -> Result<()> {
        let decorator_names: Vec<_> = member.decorators.iter().map(|d| d.name.as_str()).collect();
        
        // Check for both required and optional
        if decorator_names.contains(&"required") && decorator_names.contains(&"optional") {
            bail!("Field {} cannot be both @required and @optional", member.key);
        }
        
        // Check for multiple transform decorators (they should be chained properly)
        let transform_count = decorator_names.iter().filter(|&&n| n == "transform").count();
        if transform_count > 2 {
            // Allow up to 2 transforms for chaining, but warn on more
            bail!("Field {} has {} @transform decorators, consider consolidating", member.key, transform_count);
        }
        
        Ok(())
    }
    
    /// Validate decorator usage and arguments
    fn validate_decorator_usage(
        &self,
        name: &str,
        args: &[DecoratorArg],
        context: DecoratorContext,
    ) -> Result<()> {
        // Warn about unknown decorators (but don't fail)
        if !self.known_decorators.contains(name) {
            // This is just a warning, custom decorators are allowed
            eprintln!("Warning: Unknown decorator @{}", name);
        }
        
        // Validate specific decorator arguments
        match name {
            "min" | "max" | "minLength" | "maxLength" | "arrayMin" | "arrayMax" => {
                if args.len() != 1 {
                    bail!("@{} expects exactly 1 argument, got {}", name, args.len());
                }
                match &args[0] {
                    DecoratorArg::Number(_) => Ok(()),
                    _ => bail!("@{} expects a number argument", name),
                }
            }
            "pattern" => {
                if args.len() != 1 {
                    bail!("@pattern expects exactly 1 argument, got {}", args.len());
                }
                match &args[0] {
                    DecoratorArg::Regex(_) => Ok(()),
                    _ => bail!("@pattern expects a regex argument"),
                }
            }
            "email" | "url" | "uuid" | "required" | "optional" | "trim" | 
            "lowercase" | "uppercase" | "nested" => {
                if !args.is_empty() {
                    bail!("@{} does not accept arguments", name);
                }
                Ok(())
            }
            "transform" => {
                if args.len() != 1 {
                    bail!("@transform expects exactly 1 argument, got {}", args.len());
                }
                match &args[0] {
                    DecoratorArg::String(_) | DecoratorArg::Identifier(_) => Ok(()),
                    _ => bail!("@transform expects a string or identifier argument"),
                }
            }
            "oneOf" => {
                if args.len() != 1 {
                    bail!("@oneOf expects exactly 1 argument, got {}", args.len());
                }
                match &args[0] {
                    DecoratorArg::Array(_) => Ok(()),
                    _ => bail!("@oneOf expects an array argument"),
                }
            }
            "range" => {
                if args.len() < 2 || args.len() > 3 {
                    bail!("@range expects 2 or 3 arguments, got {}", args.len());
                }
                // First two args should be numbers
                for i in 0..2 {
                    match &args[i] {
                        DecoratorArg::Number(_) => {},
                        _ => bail!("@range expects number arguments for min and max"),
                    }
                }
                // Optional third arg should be string (error message)
                if args.len() == 3 {
                    match &args[2] {
                        DecoratorArg::String(_) => {},
                        _ => bail!("@range third argument (message) should be a string"),
                    }
                }
                Ok(())
            }
            "validator" => {
                if context != DecoratorContext::Interface {
                    bail!("@validator can only be applied to interfaces");
                }
                if !args.is_empty() {
                    bail!("@validator does not accept arguments");
                }
                Ok(())
            }
            _ => {
                // Unknown decorator, allow it (for extensibility)
                Ok(())
            }
        }
    }
}

#[derive(Debug, PartialEq)]
enum DecoratorContext {
    Interface,
    Field,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ast::{Decorator, TypeAnnotation};
    
    #[test]
    fn test_validate_empty_program() {
        let program = Program {
            statements: vec![],
        };
        
        let validator = AstValidator::new();
        assert!(validator.validate_program(&program).is_ok());
    }
    
    #[test]
    fn test_validate_simple_interface() {
        let interface = InterfaceDecl {
            decorators: vec![Decorator {
                name: "validator".to_string(),
                args: vec![],
            }],
            name: "User".to_string(),
            type_params: None,
            extends: vec![],
            members: vec![
                InterfaceMember {
                    decorators: vec![Decorator {
                        name: "required".to_string(),
                        args: vec![],
                    }],
                    key: "name".to_string(),
                    optional: false,
                    readonly: false,
                    type_annotation: TypeAnnotation::String,
                },
            ],
        };
        
        let program = Program {
            statements: vec![Statement::Interface(interface)],
        };
        
        let validator = AstValidator::new();
        assert!(validator.validate_program(&program).is_ok());
    }
    
    #[test]
    fn test_detect_duplicate_interface_names() {
        let interface1 = InterfaceDecl {
            decorators: vec![],
            name: "User".to_string(),
            type_params: None,
            extends: vec![],
            members: vec![],
        };
        
        let interface2 = InterfaceDecl {
            decorators: vec![],
            name: "User".to_string(),
            type_params: None,
            extends: vec![],
            members: vec![],
        };
        
        let program = Program {
            statements: vec![
                Statement::Interface(interface1),
                Statement::Interface(interface2),
            ],
        };
        
        let validator = AstValidator::new();
        let result = validator.validate_program(&program);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Duplicate interface name"));
    }
    
    #[test]
    fn test_detect_duplicate_member_names() {
        let interface = InterfaceDecl {
            decorators: vec![],
            name: "User".to_string(),
            type_params: None,
            extends: vec![],
            members: vec![
                InterfaceMember {
                    decorators: vec![],
                    key: "email".to_string(),
                    optional: false,
                    readonly: false,
                    type_annotation: TypeAnnotation::String,
                },
                InterfaceMember {
                    decorators: vec![],
                    key: "email".to_string(),
                    optional: true,
                    readonly: false,
                    type_annotation: TypeAnnotation::String,
                },
            ],
        };
        
        let program = Program {
            statements: vec![Statement::Interface(interface)],
        };
        
        let validator = AstValidator::new();
        let result = validator.validate_program(&program);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Duplicate member name"));
    }
    
    #[test]
    fn test_detect_conflicting_decorators() {
        let interface = InterfaceDecl {
            decorators: vec![],
            name: "User".to_string(),
            type_params: None,
            extends: vec![],
            members: vec![
                InterfaceMember {
                    decorators: vec![
                        Decorator {
                            name: "required".to_string(),
                            args: vec![],
                        },
                        Decorator {
                            name: "optional".to_string(),
                            args: vec![],
                        },
                    ],
                    key: "email".to_string(),
                    optional: false,
                    readonly: false,
                    type_annotation: TypeAnnotation::String,
                },
            ],
        };
        
        let program = Program {
            statements: vec![Statement::Interface(interface)],
        };
        
        let validator = AstValidator::new();
        let result = validator.validate_program(&program);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("cannot be both @required and @optional"));
    }
    
    #[test]
    fn test_validate_decorator_arguments() {
        // Test @min with correct argument
        let member1 = InterfaceMember {
            decorators: vec![Decorator {
                name: "min".to_string(),
                args: vec![DecoratorArg::Number(5.0)],
            }],
            key: "age".to_string(),
            optional: false,
            readonly: false,
            type_annotation: TypeAnnotation::Number,
        };
        
        let validator = AstValidator::new();
        assert!(validator.validate_interface_member(&member1).is_ok());
        
        // Test @min with wrong argument type
        let member2 = InterfaceMember {
            decorators: vec![Decorator {
                name: "min".to_string(),
                args: vec![DecoratorArg::String("5".to_string())],
            }],
            key: "age".to_string(),
            optional: false,
            readonly: false,
            type_annotation: TypeAnnotation::Number,
        };
        
        let result = validator.validate_interface_member(&member2);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("expects a number argument"));
        
        // Test @pattern with regex
        let member3 = InterfaceMember {
            decorators: vec![Decorator {
                name: "pattern".to_string(),
                args: vec![DecoratorArg::Regex("^[A-Z]+$".to_string())],
            }],
            key: "code".to_string(),
            optional: false,
            readonly: false,
            type_annotation: TypeAnnotation::String,
        };
        
        assert!(validator.validate_interface_member(&member3).is_ok());
        
        // Test @email with no arguments
        let member4 = InterfaceMember {
            decorators: vec![Decorator {
                name: "email".to_string(),
                args: vec![],
            }],
            key: "email".to_string(),
            optional: false,
            readonly: false,
            type_annotation: TypeAnnotation::String,
        };
        
        assert!(validator.validate_interface_member(&member4).is_ok());
        
        // Test @email with unexpected arguments
        let member5 = InterfaceMember {
            decorators: vec![Decorator {
                name: "email".to_string(),
                args: vec![DecoratorArg::String("extra".to_string())],
            }],
            key: "email".to_string(),
            optional: false,
            readonly: false,
            type_annotation: TypeAnnotation::String,
        };
        
        let result = validator.validate_interface_member(&member5);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("does not accept arguments"));
    }
    
    #[test]
    fn test_validate_range_decorator() {
        // Valid range with 2 arguments
        let member1 = InterfaceMember {
            decorators: vec![Decorator {
                name: "range".to_string(),
                args: vec![
                    DecoratorArg::Number(0.0),
                    DecoratorArg::Number(100.0),
                ],
            }],
            key: "score".to_string(),
            optional: false,
            readonly: false,
            type_annotation: TypeAnnotation::Number,
        };
        
        let validator = AstValidator::new();
        assert!(validator.validate_interface_member(&member1).is_ok());
        
        // Valid range with 3 arguments (including message)
        let member2 = InterfaceMember {
            decorators: vec![Decorator {
                name: "range".to_string(),
                args: vec![
                    DecoratorArg::Number(0.0),
                    DecoratorArg::Number(100.0),
                    DecoratorArg::String("Score must be between 0 and 100".to_string()),
                ],
            }],
            key: "score".to_string(),
            optional: false,
            readonly: false,
            type_annotation: TypeAnnotation::Number,
        };
        
        assert!(validator.validate_interface_member(&member2).is_ok());
        
        // Invalid range with 1 argument
        let member3 = InterfaceMember {
            decorators: vec![Decorator {
                name: "range".to_string(),
                args: vec![DecoratorArg::Number(0.0)],
            }],
            key: "score".to_string(),
            optional: false,
            readonly: false,
            type_annotation: TypeAnnotation::Number,
        };
        
        let result = validator.validate_interface_member(&member3);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("expects 2 or 3 arguments"));
    }
    
    #[test]
    fn test_validator_decorator_on_interface_only() {
        // Valid: @validator on interface
        let interface = InterfaceDecl {
            decorators: vec![Decorator {
                name: "validator".to_string(),
                args: vec![],
            }],
            name: "User".to_string(),
            type_params: None,
            extends: vec![],
            members: vec![],
        };
        
        let validator = AstValidator::new();
        assert!(validator.validate_interface(&interface).is_ok());
        
        // Invalid: @validator on field
        let member = InterfaceMember {
            decorators: vec![Decorator {
                name: "validator".to_string(),
                args: vec![],
            }],
            key: "field".to_string(),
            optional: false,
            readonly: false,
            type_annotation: TypeAnnotation::String,
        };
        
        let result = validator.validate_interface_member(&member);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("can only be applied to interfaces"));
    }
}