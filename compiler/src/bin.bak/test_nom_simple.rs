use luq_compiler::parser::Parser;

fn main() {
    // Test with progressively more complex inputs
    let test_cases = vec![
        ("Empty", ""),
        ("Comment only", "// This is a comment"),
        ("Simple interface", "interface User { name: string }"),
        ("Function", "function test(): boolean { return true }"),
        ("Decorator", "@validator\nfunction test(): boolean { return true }"),
        ("Regex simple", r#"function test(): boolean { return /test/.test("test") }"#),
    ];
    
    for (name, source) in test_cases {
        println!("\n=== Testing: {} ===", name);
        println!("Source: {}", source);
        
        let parser = Parser::new(source.to_string());
        match parser.parse(source) {
            Ok((program, _context)) => {
                println!("✅ Success! {} declarations", program.declarations.count);
            }
            Err(e) => {
                println!("❌ Failed: {}", e);
            }
        }
    }
    
    // Now test the actual file
    println!("\n=== Testing actual file ===");
    let source = r#"// Test file to verify @validator detection

// Functions WITH @validator decorator - should show in autocomplete
@validator
function validateEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}"#;
    
    println!("Source:\n{}", source);
    let parser = Parser::new(source.to_string());
    match parser.parse(source) {
        Ok((program, _context)) => {
            println!("✅ Success! {} declarations", program.declarations.count);
        }
        Err(e) => {
            println!("❌ Failed: {}", e);
        }
    }
}