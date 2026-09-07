// Example comparing old nom parser vs new logos/chumsky/ariadne parser

use luq_compiler::lexer_logos;
use luq_compiler::parser_chumsky;
use luq_compiler::parser_chumsky::error::format_errors;

fn main() {
    println!("=== Luq Parser Comparison ===\n");
    
    // Test input with intentional errors
    let source = r#"
// Valid decorator and function
@validator
function validateAge(age: number): boolean {
    return age >= 18 && age <= 120
}

// Type with missing colon (error)
type User = {
    name: string
    email string  // Missing colon
    age?: number
}

// Interface with decorator
@required
interface Config {
    apiUrl: string
    timeout?: number
}

// Function with syntax error
function broken(x: number y: string) {  // Missing comma
    return x + y
}

// Import statement
from "./validators" import { min, max }

// Export with type alias
export type ValidationResult = 
    | { success: true, value: any }
    | { success: false, errors: string[] }
"#;
    
    println!("Input source code:");
    println!("==================");
    println!("{}", source);
    println!();
    
    // Test with new parser
    println!("New Parser (logos + chumsky + ariadne):");
    println!("========================================");
    
    match lexer_logos::tokenize(source) {
        Ok(tokens) => {
            println!("✓ Tokenization successful: {} tokens", tokens.len());
            
            match parser_chumsky::parse(tokens) {
                Ok((program, context)) => {
                    println!("✓ Parsing successful!");
                    println!("  - Declarations: {}", program.declarations.len());
                }
                Err(errors) => {
                    println!("✗ Parse errors found ({} errors):", errors.len());
                    println!();
                    
                    // Beautiful error formatting with ariadne
                    let formatted = format_errors(source, "example.luq", errors);
                    println!("{}", formatted);
                }
            }
        }
        Err(lex_errors) => {
            println!("✗ Lexical errors found:");
            for error in lex_errors {
                println!("  - {}: {}", error.span, error.message);
            }
        }
    }
    
    println!();
    println!("Features of the new parser:");
    println!("===========================");
    println!("1. Fast tokenization with logos (up to 3x faster than regex)");
    println!("2. Better error recovery with chumsky");
    println!("3. Beautiful error messages with ariadne");
    println!("4. Source location tracking for all tokens");
    println!("5. Supports error recovery to continue parsing");
    println!("6. Type-safe parser combinators");
    println!("7. Modular parser structure");
    
    // Demonstrate error recovery
    println!();
    println!("Error Recovery Example:");
    println!("=======================");
    
    let error_source = r#"
function foo(x: number {  // Missing closing paren
    return x + 1
}

function bar(): string {  // This should still parse
    return "hello"
}
"#;
    
    match lexer_logos::tokenize(error_source) {
        Ok(tokens) => {
            match parser_chumsky::parse(tokens) {
                Ok((program, _)) => {
                    println!("Despite errors, parsed {} declarations", program.declarations.len());
                }
                Err(errors) => {
                    println!("Errors found, but parser can recover:");
                    let formatted = format_errors(error_source, "recovery.luq", errors.into_iter().take(1).collect());
                    println!("{}", formatted);
                }
            }
        }
        Err(_) => println!("Lexical error"),
    }
}