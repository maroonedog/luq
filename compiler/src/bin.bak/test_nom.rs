use luq_compiler::parser::Parser;
use std::fs;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let path = if args.len() > 1 {
        &args[1]
    } else {
        "/mnt/c/projects/luq/test-validator-detection.luq"
    };
    
    println!("Testing nom parser on {}", path);
    
    let source = fs::read_to_string(path)
        .expect("Failed to read test file");
    
    println!("Source length: {} bytes", source.len());
    
    let parser = Parser::new(source.clone());
    
    match parser.parse(&source) {
        Ok((program, context)) => {
            println!("✅ Parse successful!");
            println!("Program has {} declarations", program.declarations.count);
            
            // Print some basic info about the parsed program
            println!("\nParsed content:");
            let lines: Vec<&str> = source.lines().collect();
            for (i, line) in lines.iter().enumerate().take(10) {
                println!("  {} | {}", i + 1, line);
            }
            if lines.len() > 10 {
                println!("  ... and {} more lines", lines.len() - 10);
            }
        }
        Err(e) => {
            println!("❌ Parse error: {}", e);
            
            // Try to show where the error occurred
            if let Some(pos) = e.find("Nom(") {
                println!("\nError details: {}", &e[pos..]);
            }
        }
    }
}