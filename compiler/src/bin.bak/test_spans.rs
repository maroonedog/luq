use luq_compiler::parser::nom_parser::Parser;
use std::fs;

fn main() {
    let input = fs::read_to_string("../test-goto-def.luq").unwrap();
    println!("Input file length: {} bytes", input.len());
    println!("Input content:\n{}", input);
    println!("\n=== Parsing ===\n");
    
    let mut parser = Parser::new(input.clone());
    match parser.parse(&input) {
        Ok((program, context)) => {
            println!("Parse successful!");
            println!("Number of declarations: {}", program.declarations.len());
            
            // Check each declaration and print its span
            for i in 0..program.declarations.len() {
                let node_id = luq_compiler::ast::NodeId {
                    index: program.declarations.start.index + i as u32
                };
                
                if let Some(node) = context.get_ast(node_id) {
                    match node {
                        luq_compiler::ast::nodes::AstNode::TypeDecl { name, span, .. } => {
                            let type_name = context.get_str(*name);
                            println!("TypeDecl '{}' at span: start={}, end={}", 
                                type_name, span.start, span.end);
                            
                            // Show the actual text at this span
                            if (span.end as usize) <= input.len() {
                                let text = &input[span.start as usize..span.end as usize];
                                println!("  Text at span: {:?}", text);
                            }
                        }
                        luq_compiler::ast::nodes::AstNode::FunctionDecl { name, span, .. } => {
                            let func_name = context.get_str(*name);
                            println!("FunctionDecl '{}' at span: start={}, end={}", 
                                func_name, span.start, span.end);
                            
                            // Show the actual text at this span
                            if (span.end as usize) <= input.len() {
                                let text = &input[span.start as usize..span.end as usize];
                                println!("  Text at span: {:?}", text);
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
        Err(e) => {
            println!("Parse error: {:?}", e);
        }
    }
}