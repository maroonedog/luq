use crate::parser::Parser;
use std::fs;

pub fn test_nom_parser() {
    let source = fs::read_to_string("/mnt/c/projects/luq/test-validator-detection.luq")
        .expect("Failed to read test file");
    
    println!("Testing nom parser on test-validator-detection.luq");
    println!("Source length: {} bytes", source.len());
    
    let parser = Parser::new(source.clone());
    
    match parser.parse(&source) {
        Ok((program, context)) => {
            println!("Parse successful!");
            println!("Program has {} declarations", program.declarations.count);
        }
        Err(e) => {
            println!("Parse error: {}", e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_simple_arrow_function() {
        let source = r#"
@validator
function min(minValue: number) {
    return (value: number) => value >= minValue
}
"#;
        let parser = Parser::new(source.to_string());
        let result = parser.parse(source);
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_interface_with_comment() {
        let source = r#"
interface User {
    name: string
    // Type here to test autocomplete:
    
}
"#;
        let parser = Parser::new(source.to_string());
        let result = parser.parse(source);
        if let Err(ref e) = result {
            eprintln!("Parse error: {}", e);
        }
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_method_call() {
        let source = r#"
function helperFunction(str: string): string {
    return str.trim()
}
"#;
        let parser = Parser::new(source.to_string());
        let result = parser.parse(source);
        if let Err(ref e) = result {
            eprintln!("Parse error: {}", e);
        }
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_any_type() {
        let source = r#"
@validator
function arrayMin(minLength: number) {
    return (arr: any[]) => arr.length >= minLength
}
"#;
        let parser = Parser::new(source.to_string());
        let result = parser.parse(source);
        if let Err(ref e) = result {
            eprintln!("Parse error: {}", e);
        }
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_multiple_functions() {
        let source = r#"
@validator
function validateEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

@validator
function min(minValue: number) {
    return (value: number) => value >= minValue
}
"#;
        let parser = Parser::new(source.to_string());
        let result = parser.parse(source);
        if let Err(ref e) = result {
            eprintln!("Parse error: {}", e);
        }
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_simple_interface() {
        let source = r#"
interface User {
    name: string
    age: number
}
"#;
        let parser = Parser::new(source.to_string());
        let result = parser.parse(source);
        if let Err(ref e) = result {
            println!("Parse error: {}", e);
        }
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_function_with_decorator() {
        let source = r#"
@validator
function validateEmail(value: string): boolean {
    return true
}
"#;
        let parser = Parser::new(source.to_string());
        let result = parser.parse(source);
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_full_validator_file() {
        let source = std::fs::read_to_string("/mnt/c/projects/luq/test-validator-detection.luq")
            .expect("Failed to read test file");
        
        let parser = Parser::new(source.clone());
        let result = parser.parse(&source);
        
        match &result {
            Ok((program, _)) => {
                println!("Successfully parsed {} declarations", program.declarations.count);
                assert!(program.declarations.count > 0);
            }
            Err(e) => {
                println!("Parse error: {}", e);
            }
        }
        
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_regex_literal() {
        let source = r#"
@validator
function validateEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
"#;
        let parser = Parser::new(source.to_string());
        let result = parser.parse(source);
        match &result {
            Ok(_) => println!("Regex literal parsed successfully"),
            Err(e) => println!("Failed to parse regex literal: {}", e),
        }
        assert!(result.is_ok());
    }
}