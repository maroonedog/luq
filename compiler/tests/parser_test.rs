use luq_compiler::ast::{Program, Statement, TypeAnnotation};
use luq_compiler::lexer::Lexer;
use luq_compiler::parser::Parser;

async fn parse_source(source: &str) -> Program {
    let mut lexer = Lexer::new(source);
    let tokens = lexer.tokenize().await.unwrap();
    let mut parser = Parser::new(tokens);
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
    
    let program = parse_source(source).await;
    
    assert_eq!(program.statements.len(), 1);
    
    match &program.statements[0] {
        Statement::Interface(interface) => {
            assert_eq!(interface.name, "User");
            assert_eq!(interface.members.len(), 2);
            
            assert_eq!(interface.members[0].key, "name");
            assert!(matches!(interface.members[0].type_annotation, TypeAnnotation::String));
            assert!(!interface.members[0].optional);
            
            assert_eq!(interface.members[1].key, "age");
            assert!(matches!(interface.members[1].type_annotation, TypeAnnotation::Number));
            assert!(!interface.members[1].optional);
        }
        _ => panic!("Expected interface statement"),
    }
}

#[tokio::test]
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
    
    let program = parse_source(source).await;
    
    match &program.statements[0] {
        Statement::Interface(interface) => {
            // Check interface decorator
            assert_eq!(interface.decorators.len(), 1);
            assert_eq!(interface.decorators[0].name, "validator");
            
            // Check first member decorators
            assert_eq!(interface.members[0].decorators.len(), 2);
            assert_eq!(interface.members[0].decorators[0].name, "required");
            assert_eq!(interface.members[0].decorators[1].name, "min");
            
            // Check second member
            assert_eq!(interface.members[1].key, "phone");
            assert!(interface.members[1].optional);
            assert_eq!(interface.members[1].decorators.len(), 1);
            assert_eq!(interface.members[1].decorators[0].name, "optional");
        }
        _ => panic!("Expected interface statement"),
    }
}