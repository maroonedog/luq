use luq_compiler::ast::{Program, AstContext, NodeId, nodes::*};
use luq_compiler::lexer::Lexer;
use luq_compiler::parser::Parser;

async fn parse_source(source: &str) -> (Program, AstContext) {
    let mut lexer = Lexer::new(source);
    let tokens = lexer.tokenize().await.unwrap();
    let parser = Parser::new(tokens, source.to_string());
    parser.parse().await.unwrap()
}

#[tokio::test]
async fn test_parse_simple_interface() {
    let source = r#"
interface User {
    name: string;
    age: number;
}
"#;
    
    let (program, context) = parse_source(source).await;
    
    assert_eq!(program.declarations.len(), 1);
    
    let user_id = NodeId { index: program.declarations.start.index };
    match context.get_ast(user_id) {
        Some(AstNode::TypeDecl { name, body, .. }) => {
            assert_eq!(context.get_str(*name), "User");
            
            if let Some(TypeNode::Object { fields, .. }) = context.get_type(*body) {
                assert_eq!(fields.len(), 2);
                
                // Check first field (name)
                let name_field_id = NodeId { index: fields.start.index };
                if let Some(field) = context.get_field(name_field_id) {
                    assert_eq!(context.get_str(field.name), "name");
                    assert!(!field.optional);
                    // Check it's a string type
                    assert!(matches!(context.get_type(field.type_node), Some(TypeNode::String { .. })));
                }
                
                // Check second field (age)
                let age_field_id = NodeId { index: fields.start.index + 1 };
                if let Some(field) = context.get_field(age_field_id) {
                    assert_eq!(context.get_str(field.name), "age");
                    assert!(!field.optional);
                    // Check it's a number type
                    assert!(matches!(context.get_type(field.type_node), Some(TypeNode::Number { .. })));
                }
            } else {
                panic!("Expected object type for User");
            }
        }
        _ => panic!("Expected interface statement"),
    }
}

#[tokio::test]
#[ignore] // TODO: Fix decorator parsing
async fn test_parse_interface_with_decorators() {
    let source = r#"
@validator
interface User {
    @required
    @min(3)
    name: string;
    
    @optional
    phone?: string;
}
"#;
    
    let (program, context) = parse_source(source).await;
    
    let user_id = NodeId { index: program.declarations.start.index };
    match context.get_ast(user_id) {
        Some(AstNode::TypeDecl { name, decorators, body, .. }) => {
            assert_eq!(context.get_str(*name), "User");
            
            // Check interface decorator
            assert_eq!(decorators.len(), 1);
            // TODO: Add decorator checking once decorator AST nodes are available
            
            if let Some(TypeNode::Object { fields, .. }) = context.get_type(*body) {
                assert_eq!(fields.len(), 2);
                
                // Check first field (name) with decorators
                let name_field_id = NodeId { index: fields.start.index };
                if let Some(field) = context.get_field(name_field_id) {
                    assert_eq!(context.get_str(field.name), "name");
                    assert!(!field.optional);
                    
                    // Check field decorators
                    assert_eq!(field.decorators.len(), 2);
                    // TODO: Add decorator checking once decorator AST nodes are available
                }
                
                // Check second field (phone) with decorators
                let phone_field_id = NodeId { index: fields.start.index + 1 };
                if let Some(field) = context.get_field(phone_field_id) {
                    assert_eq!(context.get_str(field.name), "phone");
                    assert!(field.optional);
                    
                    // Check field decorator
                    assert_eq!(field.decorators.len(), 1);
                    // TODO: Add decorator checking once decorator AST nodes are available
                }
            }
        }
        _ => panic!("Expected interface statement"),
    }
}