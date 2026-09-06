use luq_compiler::parser::nom_parser::Parser;

fn main() {
    let input = r#"interface TestType {
    id: string;
}

function test(param: TestType) {
    return param;
}"#;

    let mut parser = Parser::new(input.to_string());
    match parser.parse() {
        Ok((program, _context)) => {
            println!("Parse successful!");
            
            // Print AST with spans
            for (i, node) in program.body.iter().enumerate() {
                match node {
                    luq_compiler::ast::nodes::AstNode::TypeDecl { name, name_span, span, .. } => {
                        let name_str = _context.resolve_string(*name);
                        println!("TypeDecl {}: name={}, name_span={}:{}-{}:{}, full_span={}:{}-{}:{}", 
                            i, name_str,
                            name_span.start_line, name_span.start_column, 
                            name_span.end_line, name_span.end_column,
                            span.start_line, span.start_column,
                            span.end_line, span.end_column);
                    }
                    luq_compiler::ast::nodes::AstNode::FunctionDecl { name, name_span, span, .. } => {
                        let name_str = _context.resolve_string(*name);
                        println!("FunctionDecl {}: name={}, name_span={}:{}-{}:{}, full_span={}:{}-{}:{}", 
                            i, name_str,
                            name_span.start_line, name_span.start_column,
                            name_span.end_line, name_span.end_column,
                            span.start_line, span.start_column,
                            span.end_line, span.end_column);
                    }
                    _ => {}
                }
            }
            
            // Test position lookup
            let test_positions = vec![
                (7, 20), // On TestType in function param
                (0, 10), // On TestType in interface declaration
            ];
            
            for (line, col) in test_positions {
                println!("\nLooking for word at {}:{}", line, col);
                
                // Calculate offset from line/column
                let mut current_line = 0;
                let mut offset = 0;
                for (i, ch) in input.chars().enumerate() {
                    if current_line == line && i - offset == col {
                        // Found position
                        let word_start = i;
                        let word_end = input[i..].chars()
                            .take_while(|c| c.is_alphanumeric() || *c == '_')
                            .count() + i;
                        let word = &input[word_start..word_end];
                        println!("  Found word: '{}'", word);
                        break;
                    }
                    if ch == '\n' {
                        current_line += 1;
                        offset = i + 1;
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("Parse error: {:?}", e);
        }
    }
}