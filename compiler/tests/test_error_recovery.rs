use luq_compiler::lexer::{tokenize, TokenKind};

#[test]
fn test_incomplete_decorator() {
    // The user has typed nothing but "@"
    let input = "@";
    let result = tokenize(input);
    
    println!("Input: {:?}", input);
    println!("Result: {:?}", result);
    
    // The current implementation is likely to error here
    // Ideally it should return at least the "@" token
    match result {
        Ok(tokens) => {
            println!("Success! Tokens: {:?}", tokens);
            assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::At)));
        }
        Err(errors) => {
            println!("Failed with errors: {:?}", errors);
            // Even on an error, autocomplete needs a partial result
        }
    }
}

#[test]
fn test_incomplete_interface() {
    // The user is halfway through typing "interface"
    let inputs = vec![
        "inter",
        "interface",
        "interface U",
        "interface User {",
        "interface User { n",
        "interface User { name:",
    ];
    
    for input in inputs {
        println!("\n=== Testing: {:?} ===", input);
        let result = tokenize(input);
        
        match result {
            Ok(tokens) => {
                println!("Success! Token count: {}", tokens.len());
                // Check that tokens come back even when partial
                assert!(tokens.len() > 0);
            }
            Err(errors) => {
                println!("Failed with {} errors", errors.len());
                // Even on an error, the tokens up to this point are needed
            }
        }
    }
}

#[test]
fn test_consecutive_autocomplete_calls() {
    // Simulates calling autocomplete repeatedly
    let base_input = "interface User {\n  @";
    
    // The user keeps asking for candidates
    let completions = vec![
        format!("{}", base_input),
        format!("{}r", base_input),
        format!("{}re", base_input),
        format!("{}req", base_input),
        format!("{}required", base_input),
    ];
    
    for (i, input) in completions.iter().enumerate() {
        println!("\n=== Call {} ===", i + 1);
        let result = tokenize(input);
        
        match result {
            Ok(tokens) => {
                println!("Success! Last few tokens:");
                for token in tokens.iter().rev().take(3) {
                    println!("  {:?}", token.kind);
                }
            }
            Err(errors) => {
                println!("Failed! First error: {:?}", errors.first());
                // Autocomplete stops working here
            }
        }
    }
}

#[test]
fn test_error_in_middle_of_file() {
    // When there is an error in the middle of a file
    let input = r#"
        interface User {
            name: string;
            @@@invalid@@@  // error
            age: number;
        }
        
        interface Admin {
            role: string;
        }
    "#;
    
    let result = tokenize(input);
    
    match result {
        Ok(tokens) => {
            println!("Unexpectedly succeeded with {} tokens", tokens.len());
        }
        Err(errors) => {
            println!("Failed with {} errors", errors.len());
            // Even with an error, the valid parts before and after should be parsed
            // The current implementation fails on the whole file
        }
    }
}

#[test]
fn test_multiple_errors() {
    // When there are several errors
    let input = r#"
        interface User {
            @@@error1
            name: string;
            ###error2
            age: number;
            $$$error3
        }
    "#;
    
    let result = tokenize(input);
    
    match result {
        Ok(_) => {
            println!("Unexpectedly succeeded");
        }
        Err(errors) => {
            println!("Error count: {}", errors.len());
            // Ideally it should collect every error
            assert!(errors.len() >= 1);
        }
    }
}

#[test]
fn test_unclosed_string() {
    // When a string is left unclosed
    let input = r#"
        interface User {
            name: "unclosed string
            age: number;
        }
    "#;
    
    let result = tokenize(input);
    
    match result {
        Ok(tokens) => {
            println!("Token count: {}", tokens.len());
        }
        Err(errors) => {
            println!("Failed as expected: {:?}", errors.first());
            // Other tokens should still be parsed after a string error
        }
    }
}

#[test]
fn test_partial_comment() {
    // When a comment is incomplete
    let inputs = vec![
        "// partial comment without newline",
        "/* unclosed comment",
        "/// doc comment without content",
    ];
    
    for input in inputs {
        println!("\n=== Testing: {:?} ===", input);
        let result = tokenize(input);
        
        // Comments should be treated relatively leniently
        match result {
            Ok(tokens) => {
                println!("Success with {} tokens", tokens.len());
            }
            Err(errors) => {
                println!("Failed: {:?}", errors.first());
            }
        }
    }
}