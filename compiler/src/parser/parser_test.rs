#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::ast::{DecoratorArg, Program, Statement, TypeAnnotation};
    use crate::lexer::Lexer;
    use anyhow::Result;

    async fn parse_input(input: &str) -> Result<Program> {
        let mut lexer = Lexer::new(input);
        let tokens = lexer.tokenize().await?;
        let mut parser = Parser::new(tokens);
        parser.parse().await
    }

    #[tokio::test]
    async fn test_parse_simple_interface() {
        let input = r#"
        interface User {
            name: string;
            age: number;
        }
        "#;

        let program = parse_input(input).await.unwrap();
        assert_eq!(program.statements.len(), 1);

        match &program.statements[0] {
            Statement::Interface(interface) => {
                assert_eq!(interface.name, "User");
                assert_eq!(interface.members.len(), 2);
                
                assert_eq!(interface.members[0].key, "name");
                assert!(matches!(interface.members[0].type_annotation, TypeAnnotation::String));
                
                assert_eq!(interface.members[1].key, "age");
                assert!(matches!(interface.members[1].type_annotation, TypeAnnotation::Number));
            }
            _ => panic!("Expected interface statement"),
        }
    }

    #[tokio::test]
    async fn test_parse_interface_with_decorators() {
        let input = r#"
        @validator
        interface User {
            @required @min(3) @max(50)
            name: string;
            
            @required @email
            email: string;
            
            @optional
            phone?: string;
        }
        "#;

        let program = parse_input(input).await.unwrap();
        assert_eq!(program.statements.len(), 1);

        match &program.statements[0] {
            Statement::Interface(interface) => {
                // Check interface decorator
                assert_eq!(interface.decorators.len(), 1);
                assert_eq!(interface.decorators[0].name, "validator");
                assert_eq!(interface.decorators[0].args.len(), 0);

                // Check first member decorators
                assert_eq!(interface.members[0].key, "name");
                assert_eq!(interface.members[0].decorators.len(), 3);
                assert_eq!(interface.members[0].decorators[0].name, "required");
                assert_eq!(interface.members[0].decorators[1].name, "min");
                assert_eq!(interface.members[0].decorators[2].name, "max");

                // Check decorator arguments
                assert_eq!(interface.members[0].decorators[1].args.len(), 1);
                match &interface.members[0].decorators[1].args[0] {
                    DecoratorArg::Number(n) => assert_eq!(*n, 3.0),
                    _ => panic!("Expected number argument"),
                }

                assert_eq!(interface.members[0].decorators[2].args.len(), 1);
                match &interface.members[0].decorators[2].args[0] {
                    DecoratorArg::Number(n) => assert_eq!(*n, 50.0),
                    _ => panic!("Expected number argument"),
                }

                // Check email field
                assert_eq!(interface.members[1].key, "email");
                assert_eq!(interface.members[1].decorators[1].name, "email");

                // Check optional field
                assert_eq!(interface.members[2].key, "phone");
                assert!(interface.members[2].optional);
                assert_eq!(interface.members[2].decorators[0].name, "optional");
            }
            _ => panic!("Expected interface statement"),
        }
    }

    #[tokio::test]
    async fn test_parse_decorator_with_string_argument() {
        let input = r#"
        interface User {
            @message("This field is required")
            name: string;
        }
        "#;

        let program = parse_input(input).await.unwrap();
        match &program.statements[0] {
            Statement::Interface(interface) => {
                let decorator = &interface.members[0].decorators[0];
                assert_eq!(decorator.name, "message");
                assert_eq!(decorator.args.len(), 1);
                match &decorator.args[0] {
                    DecoratorArg::String(s) => assert_eq!(s, "This field is required"),
                    _ => panic!("Expected string argument"),
                }
            }
            _ => panic!("Expected interface statement"),
        }
    }

    #[tokio::test]
    async fn test_parse_decorator_with_regex_argument() {
        let input = r#"
        interface User {
            @pattern(/^[A-Z][a-z]+$/)
            name: string;
        }
        "#;

        let program = parse_input(input).await.unwrap();
        match &program.statements[0] {
            Statement::Interface(interface) => {
                let decorator = &interface.members[0].decorators[0];
                assert_eq!(decorator.name, "pattern");
                assert_eq!(decorator.args.len(), 1);
                match &decorator.args[0] {
                    DecoratorArg::Regex(r) => assert_eq!(r, "^[A-Z][a-z]+$"),
                    _ => panic!("Expected regex argument"),
                }
            }
            _ => panic!("Expected interface statement"),
        }
    }

    #[tokio::test]
    async fn test_parse_decorator_with_boolean_arguments() {
        let input = r#"
        interface Settings {
            @validate(true)
            enabled: boolean;
            
            @validate(false)
            disabled: boolean;
        }
        "#;

        let program = parse_input(input).await.unwrap();
        match &program.statements[0] {
            Statement::Interface(interface) => {
                // Check first field
                let decorator = &interface.members[0].decorators[0];
                assert_eq!(decorator.args.len(), 1);
                match &decorator.args[0] {
                    DecoratorArg::Boolean(b) => assert!(*b),
                    _ => panic!("Expected boolean argument"),
                }

                // Check second field
                let decorator = &interface.members[1].decorators[0];
                match &decorator.args[0] {
                    DecoratorArg::Boolean(b) => assert!(!*b),
                    _ => panic!("Expected boolean argument"),
                }
            }
            _ => panic!("Expected interface statement"),
        }
    }

    #[tokio::test]
    async fn test_parse_decorator_with_array_argument() {
        let input = r#"
        interface Config {
            @values([1, 2, 3])
            options: number[];
        }
        "#;

        let program = parse_input(input).await.unwrap();
        match &program.statements[0] {
            Statement::Interface(interface) => {
                let decorator = &interface.members[0].decorators[0];
                assert_eq!(decorator.name, "values");
                assert_eq!(decorator.args.len(), 1);
                match &decorator.args[0] {
                    DecoratorArg::Array(elements) => {
                        assert_eq!(elements.len(), 3);
                        match &elements[0] {
                            DecoratorArg::Number(n) => assert_eq!(*n, 1.0),
                            _ => panic!("Expected number in array"),
                        }
                        match &elements[1] {
                            DecoratorArg::Number(n) => assert_eq!(*n, 2.0),
                            _ => panic!("Expected number in array"),
                        }
                        match &elements[2] {
                            DecoratorArg::Number(n) => assert_eq!(*n, 3.0),
                            _ => panic!("Expected number in array"),
                        }
                    }
                    _ => panic!("Expected array argument"),
                }
            }
            _ => panic!("Expected interface statement"),
        }
    }

    #[tokio::test]
    async fn test_parse_decorator_with_object_argument() {
        let input = r#"
        interface Form {
            @validate({ min: 5, max: 10 })
            count: number;
        }
        "#;

        let program = parse_input(input).await.unwrap();
        match &program.statements[0] {
            Statement::Interface(interface) => {
                let decorator = &interface.members[0].decorators[0];
                assert_eq!(decorator.name, "validate");
                assert_eq!(decorator.args.len(), 1);
                match &decorator.args[0] {
                    DecoratorArg::Object(fields) => {
                        assert_eq!(fields.len(), 2);
                        assert_eq!(fields[0].0, "min");
                        match &fields[0].1 {
                            DecoratorArg::Number(n) => assert_eq!(*n, 5.0),
                            _ => panic!("Expected number value"),
                        }
                        assert_eq!(fields[1].0, "max");
                        match &fields[1].1 {
                            DecoratorArg::Number(n) => assert_eq!(*n, 10.0),
                            _ => panic!("Expected number value"),
                        }
                    }
                    _ => panic!("Expected object argument"),
                }
            }
            _ => panic!("Expected interface statement"),
        }
    }

    #[tokio::test]
    async fn test_parse_multiple_decorator_arguments() {
        let input = r#"
        interface Product {
            @range(10, 100, "Price must be between 10 and 100")
            price: number;
        }
        "#;

        let program = parse_input(input).await.unwrap();
        match &program.statements[0] {
            Statement::Interface(interface) => {
                let decorator = &interface.members[0].decorators[0];
                assert_eq!(decorator.name, "range");
                assert_eq!(decorator.args.len(), 3);
                
                match &decorator.args[0] {
                    DecoratorArg::Number(n) => assert_eq!(*n, 10.0),
                    _ => panic!("Expected number argument"),
                }
                match &decorator.args[1] {
                    DecoratorArg::Number(n) => assert_eq!(*n, 100.0),
                    _ => panic!("Expected number argument"),
                }
                match &decorator.args[2] {
                    DecoratorArg::String(s) => assert_eq!(s, "Price must be between 10 and 100"),
                    _ => panic!("Expected string argument"),
                }
            }
            _ => panic!("Expected interface statement"),
        }
    }

    #[tokio::test]
    async fn test_parse_optional_and_readonly_fields() {
        let input = r#"
        interface Document {
            readonly id: string;
            title?: string;
            readonly created?: number;
        }
        "#;

        let program = parse_input(input).await.unwrap();
        match &program.statements[0] {
            Statement::Interface(interface) => {
                assert_eq!(interface.members.len(), 3);
                
                // Check readonly id
                assert_eq!(interface.members[0].key, "id");
                assert!(interface.members[0].readonly);
                assert!(!interface.members[0].optional);
                
                // Check optional title
                assert_eq!(interface.members[1].key, "title");
                assert!(!interface.members[1].readonly);
                assert!(interface.members[1].optional);
                
                // Check readonly optional created
                assert_eq!(interface.members[2].key, "created");
                assert!(interface.members[2].readonly);
                assert!(interface.members[2].optional);
            }
            _ => panic!("Expected interface statement"),
        }
    }

    #[tokio::test]
    async fn test_parse_array_types() {
        let input = r#"
        interface Container {
            items: string[];
            numbers: number[];
            users: User[];
        }
        "#;

        let program = parse_input(input).await.unwrap();
        match &program.statements[0] {
            Statement::Interface(interface) => {
                assert_eq!(interface.members.len(), 3);
                
                // Check string array
                match &interface.members[0].type_annotation {
                    TypeAnnotation::Array(inner) => {
                        assert!(matches!(**inner, TypeAnnotation::String));
                    }
                    _ => panic!("Expected array type"),
                }
                
                // Check number array
                match &interface.members[1].type_annotation {
                    TypeAnnotation::Array(inner) => {
                        assert!(matches!(**inner, TypeAnnotation::Number));
                    }
                    _ => panic!("Expected array type"),
                }
                
                // Check custom type array
                match &interface.members[2].type_annotation {
                    TypeAnnotation::Array(inner) => {
                        match &**inner {
                            TypeAnnotation::Reference { name, .. } => {
                                assert_eq!(name, "User");
                            }
                            _ => panic!("Expected reference type"),
                        }
                    }
                    _ => panic!("Expected array type"),
                }
            }
            _ => panic!("Expected interface statement"),
        }
    }

    #[tokio::test]
    async fn test_parse_nested_decorators() {
        let input = r#"
        @controller("users")
        @authenticated
        interface UserController {
            @get("/list")
            @cache(300)
            listUsers: Function;
            
            @post("/create")
            @validate
            @authorize("admin")
            createUser: Function;
        }
        "#;

        let program = parse_input(input).await.unwrap();
        match &program.statements[0] {
            Statement::Interface(interface) => {
                // Check interface decorators
                assert_eq!(interface.decorators.len(), 2);
                assert_eq!(interface.decorators[0].name, "controller");
                assert_eq!(interface.decorators[0].args.len(), 1);
                assert_eq!(interface.decorators[1].name, "authenticated");
                assert_eq!(interface.decorators[1].args.len(), 0);
                
                // Check first member decorators
                assert_eq!(interface.members[0].decorators.len(), 2);
                assert_eq!(interface.members[0].decorators[0].name, "get");
                assert_eq!(interface.members[0].decorators[1].name, "cache");
                
                // Check second member decorators
                assert_eq!(interface.members[1].decorators.len(), 3);
                assert_eq!(interface.members[1].decorators[0].name, "post");
                assert_eq!(interface.members[1].decorators[1].name, "validate");
                assert_eq!(interface.members[1].decorators[2].name, "authorize");
            }
            _ => panic!("Expected interface statement"),
        }
    }

    #[tokio::test]
    async fn test_parse_empty_interface() {
        let input = r#"
        interface Empty {
        }
        "#;

        let program = parse_input(input).await.unwrap();
        match &program.statements[0] {
            Statement::Interface(interface) => {
                assert_eq!(interface.name, "Empty");
                assert_eq!(interface.members.len(), 0);
                assert_eq!(interface.decorators.len(), 0);
            }
            _ => panic!("Expected interface statement"),
        }
    }

    #[tokio::test]
    async fn test_parse_multiple_interfaces() {
        let input = r#"
        interface User {
            name: string;
        }
        
        interface Product {
            id: number;
        }
        
        interface Order {
            userId: number;
            productId: number;
        }
        "#;

        let program = parse_input(input).await.unwrap();
        assert_eq!(program.statements.len(), 3);
        
        // Check all interfaces are parsed
        for (i, expected_name) in ["User", "Product", "Order"].iter().enumerate() {
            match &program.statements[i] {
                Statement::Interface(interface) => {
                    assert_eq!(interface.name, *expected_name);
                }
                _ => panic!("Expected interface statement"),
            }
        }
    }

    #[tokio::test]
    async fn test_parse_complex_decorator_arguments() {
        let input = r#"
        interface ComplexValidation {
            @validate({
                rules: ["required", "email"],
                options: { 
                    trim: true, 
                    lowercase: false 
                },
                messages: {
                    required: "Email is required",
                    email: "Invalid email format"
                }
            })
            email: string;
        }
        "#;

        let program = parse_input(input).await.unwrap();
        match &program.statements[0] {
            Statement::Interface(interface) => {
                let decorator = &interface.members[0].decorators[0];
                assert_eq!(decorator.name, "validate");
                assert_eq!(decorator.args.len(), 1);
                
                match &decorator.args[0] {
                    DecoratorArg::Object(fields) => {
                        assert_eq!(fields.len(), 3);
                        assert_eq!(fields[0].0, "rules");
                        assert_eq!(fields[1].0, "options");
                        assert_eq!(fields[2].0, "messages");
                        
                        // Check nested array in object
                        match &fields[0].1 {
                            DecoratorArg::Array(elements) => {
                                assert_eq!(elements.len(), 2);
                            }
                            _ => panic!("Expected array value"),
                        }
                        
                        // Check nested object in object
                        match &fields[1].1 {
                            DecoratorArg::Object(inner_fields) => {
                                assert_eq!(inner_fields.len(), 2);
                            }
                            _ => panic!("Expected object value"),
                        }
                    }
                    _ => panic!("Expected object argument"),
                }
            }
            _ => panic!("Expected interface statement"),
        }
    }
}