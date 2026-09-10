use luq_compiler::parser::Parser;
use luq_compiler::ast::validation::AstValidator;
use luq_compiler::lsp::diagnostics::analyze_program;

#[test]
fn test_undefined_decorator_should_error() {
    let source = r#"
interface User {
    @nonExistentDecorator
    id: string;
    
    @required
    name: string;
}
"#;

    let parser = Parser::new(source.to_string());
    let (program, context) = parser.parse(source).expect("Should parse");
    
    // Run the decorator validation
    let diagnostics = analyze_program(&program);
    
    // An undefined decorator should be reported as an error
    assert!(diagnostics.iter().any(|d| 
        d.message.contains("nonExistentDecorator") && 
        d.message.contains("not defined")
    ), "Should detect undefined decorator 'nonExistentDecorator'");
    
    assert!(diagnostics.iter().any(|d| 
        d.message.contains("required") && 
        d.message.contains("not defined")
    ), "Should detect undefined decorator 'required'");
}

#[test]
fn test_imported_decorator_should_not_error() {
    let source = r#"
import { validateUser } from "./validators.luq";

interface User {
    @validateUser
    id: string;
}
"#;

    let parser = Parser::new(source.to_string());
    let (program, context) = parser.parse(source).expect("Should parse");
    
    // An imported decorator should not be an error
    let diagnostics = analyze_program(&program);
    
    assert!(!diagnostics.iter().any(|d| 
        d.message.contains("validateUser") && 
        d.message.contains("not defined")
    ), "Should not error on imported decorator 'validateUser'");
}

#[test]
fn test_validator_decorated_function_should_be_usable() {
    let source = r#"
@validator
function checkLength(value: string): boolean {
    return value.length > 0;
}

interface User {
    @checkLength
    name: string;
}
"#;

    let parser = Parser::new(source.to_string());
    let (program, context) = parser.parse(source).expect("Should parse");
    
    // A function decorated with @validator should be usable
    let diagnostics = analyze_program(&program);
    
    assert!(!diagnostics.iter().any(|d| 
        d.message.contains("checkLength") && 
        d.message.contains("not defined")
    ), "@validator decorated function should be usable as decorator");
}

#[test]
fn test_non_validator_function_should_not_be_usable_as_decorator() {
    let source = r#"
function normalFunction(value: string): boolean {
    return value.length > 0;
}

interface User {
    @normalFunction
    name: string;
}
"#;

    let parser = Parser::new(source.to_string());
    let (program, context) = parser.parse(source).expect("Should parse");
    
    // A function not decorated with @validator cannot be used as a decorator
    let diagnostics = analyze_program(&program);
    
    assert!(diagnostics.iter().any(|d| 
        d.message.contains("normalFunction") && 
        (d.message.contains("not a validator") || d.message.contains("cannot be used as decorator"))
    ), "Non-validator function should not be usable as decorator");
}