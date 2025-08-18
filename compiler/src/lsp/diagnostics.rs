use tower_lsp::lsp_types::*;
use crate::ast::{Program, InterfaceDecl, InterfaceMember};

pub fn analyze_program(program: &Program) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    
    for statement in &program.statements {
        match statement {
            crate::ast::Statement::Interface(interface) => {
                diagnostics.extend(analyze_interface(interface));
            }
            _ => {}
        }
    }
    
    diagnostics
}

fn analyze_interface(interface: &InterfaceDecl) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    
    // Check for @validator decorator
    let has_validator = interface.decorators.iter()
        .any(|d| d.name == "validator");
    
    if !has_validator {
        diagnostics.push(Diagnostic {
            range: Range {
                start: Position { line: 0, character: 0 },
                end: Position { line: 0, character: 9 },
            },
            severity: Some(DiagnosticSeverity::WARNING),
            message: "Interface is missing @validator decorator".to_string(),
            ..Default::default()
        });
    }
    
    // Check members
    for member in &interface.members {
        diagnostics.extend(analyze_member(member));
    }
    
    diagnostics
}

fn analyze_member(member: &InterfaceMember) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    
    // Check for conflicting decorators
    let has_required = member.decorators.iter().any(|d| d.name == "required");
    let has_optional = member.decorators.iter().any(|d| d.name == "optional");
    
    if has_required && has_optional {
        diagnostics.push(Diagnostic {
            range: Range {
                start: Position { line: 0, character: 0 },
                end: Position { line: 0, character: 0 },
            },
            severity: Some(DiagnosticSeverity::ERROR),
            message: format!("Field '{}' cannot be both @required and @optional", member.key),
            ..Default::default()
        });
    }
    
    // Check for type-specific decorators
    match &member.type_annotation {
        crate::ast::TypeAnnotation::String => {
            // String-specific decorators are valid
        }
        crate::ast::TypeAnnotation::Number => {
            if member.decorators.iter().any(|d| d.name == "email") {
                diagnostics.push(Diagnostic {
                    range: Range {
                        start: Position { line: 0, character: 0 },
                        end: Position { line: 0, character: 0 },
                    },
                    severity: Some(DiagnosticSeverity::ERROR),
                    message: format!("@email decorator is only valid for string fields, not number"),
                    ..Default::default()
                });
            }
        }
        _ => {}
    }
    
    diagnostics
}