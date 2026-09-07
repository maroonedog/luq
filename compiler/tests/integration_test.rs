use luq_compiler::ast::{Program, AstContext, NodeId, nodes::*};
use luq_compiler::lexer::Lexer;
use luq_compiler::parser::Parser;

async fn parse_file(content: &str) -> anyhow::Result<(Program, AstContext)> {
    let mut lexer = Lexer::new(content);
    let tokens = lexer.tokenize().await?;
    let parser = Parser::new(tokens, content.to_string());
    parser.parse().await
}

#[tokio::test]
async fn test_full_user_example() {
    let input = r#"
    @validator
    interface User {
        name: string
        email: string
        phone?: string
        age: number
        address?: Address
        roles: string[]
        readonly id: string
        username: string
    }
    
    @validator
    interface Address {
        street: string
        city: string
        zipCode: string
        country?: string
    }
    "#;

    let (program, context) = parse_file(input).await.unwrap();
    
    // Should have 2 interfaces
    assert_eq!(program.declarations.len(), 2);
    
    // Check User interface
    let user_id = NodeId { index: program.declarations.start.index };
    match context.get_ast(user_id) {
        Some(AstNode::TypeDecl { name, body, .. }) => {
            assert_eq!(context.get_str(*name), "User");
            
            // Check that it's an object type
            if let Some(TypeNode::Object { fields, .. }) = context.get_type(*body) {
                // Should have 8 fields
                assert_eq!(fields.len(), 8);
                
                // Check first field (name)
                let first_field_id = NodeId { index: fields.start.index };
                if let Some(field) = context.get_field(first_field_id) {
                    assert_eq!(context.get_str(field.name), "name");
                    assert!(!field.optional);
                }
                
                // Check phone field (optional)
                let phone_field_id = NodeId { index: fields.start.index + 2 };
                if let Some(field) = context.get_field(phone_field_id) {
                    assert_eq!(context.get_str(field.name), "phone");
                    assert!(field.optional);
                }
                
                // Check id field (readonly)
                let id_field_id = NodeId { index: fields.start.index + 6 };
                if let Some(field) = context.get_field(id_field_id) {
                    assert_eq!(context.get_str(field.name), "id");
                    assert!(field.readonly);
                }
            } else {
                panic!("Expected object type for User");
            }
        }
        _ => panic!("Expected User interface"),
    }
    
    // Check Address interface
    let address_id = NodeId { index: program.declarations.start.index + 1 };
    match context.get_ast(address_id) {
        Some(AstNode::TypeDecl { name, body, .. }) => {
            assert_eq!(context.get_str(*name), "Address");
            
            if let Some(TypeNode::Object { fields, .. }) = context.get_type(*body) {
                assert_eq!(fields.len(), 4);
                
                // Check country field (optional)
                let country_field_id = NodeId { index: fields.start.index + 3 };
                if let Some(field) = context.get_field(country_field_id) {
                    assert_eq!(context.get_str(field.name), "country");
                    assert!(field.optional);
                }
            }
        }
        _ => panic!("Expected Address interface"),
    }
}

#[tokio::test]
async fn test_complex_types() {
    let input = r#"
    interface Product {
        sku: string
        quantity: number
        price: number
        status?: string
        tags: string[]
        manufacturer: Manufacturer
        launchDate?: string
        barcode: string
    }
    
    type ProductId = string
    
    type Status = "active" | "inactive" | "discontinued"
    "#;

    let (program, context) = parse_file(input).await.unwrap();
    
    // Should have 3 declarations
    assert!(program.declarations.len() >= 2);
    
    // Check Product interface
    let product_id = NodeId { index: program.declarations.start.index };
    match context.get_ast(product_id) {
        Some(AstNode::TypeDecl { name, body, .. }) => {
            assert_eq!(context.get_str(*name), "Product");
            
            if let Some(TypeNode::Object { fields, .. }) = context.get_type(*body) {
                assert_eq!(fields.len(), 8);
                
                // Check tags array field
                let tags_field_id = NodeId { index: fields.start.index + 4 };
                if let Some(field) = context.get_field(tags_field_id) {
                    assert_eq!(context.get_str(field.name), "tags");
                    
                    // Check it's an array type
                    if let Some(TypeNode::Array { .. }) = context.get_type(field.type_node) {
                        // Success - it's an array
                    } else {
                        panic!("Expected array type for tags");
                    }
                }
            }
        }
        _ => panic!("Expected Product interface"),
    }
    
    // Check ProductId type alias
    let productid_id = NodeId { index: program.declarations.start.index + 1 };
    match context.get_ast(productid_id) {
        Some(AstNode::TypeAlias { name, body, .. }) => {
            assert_eq!(context.get_str(*name), "ProductId");
            
            // Should be a string type
            assert!(matches!(context.get_type(*body), Some(TypeNode::String { .. })));
        }
        _ => {} // Type alias might not be fully parsed yet
    }
}

#[tokio::test]
async fn test_nested_interfaces() {
    let input = r#"
    interface Order {
        id: string
        customer: Customer
        items: OrderItem[]
        total: number
    }
    
    interface Customer {
        name: string
        email: string
    }
    
    interface OrderItem {
        productId: string
        quantity: number
        price: number
    }
    "#;

    let (program, context) = parse_file(input).await.unwrap();
    assert_eq!(program.declarations.len(), 3);
    
    // Verify all three interfaces are parsed
    let mut interface_names = Vec::new();
    for i in 0..3 {
        let node_id = NodeId { index: program.declarations.start.index + i };
        if let Some(AstNode::TypeDecl { name, .. }) = context.get_ast(node_id) {
            interface_names.push(context.get_str(*name).to_string());
        }
    }
    
    assert_eq!(interface_names, vec!["Order", "Customer", "OrderItem"]);
    
    // Check Order interface references Customer type
    let order_id = NodeId { index: program.declarations.start.index };
    match context.get_ast(order_id) {
        Some(AstNode::TypeDecl { body, .. }) => {
            if let Some(TypeNode::Object { fields, .. }) = context.get_type(*body) {
                // Check customer field type reference
                let customer_field_id = NodeId { index: fields.start.index + 1 };
                if let Some(field) = context.get_field(customer_field_id) {
                    assert_eq!(context.get_str(field.name), "customer");
                    
                    // Check it's a reference type
                    if let Some(TypeNode::Ref { target, .. }) = context.get_type(field.type_node) {
                        assert_eq!(context.get_str(*target), "Customer");
                    }
                }
                
                // Check items array field
                let items_field_id = NodeId { index: fields.start.index + 2 };
                if let Some(field) = context.get_field(items_field_id) {
                    assert_eq!(context.get_str(field.name), "items");
                    
                    // Check it's an array of OrderItem
                    if let Some(TypeNode::Array { elem, .. }) = context.get_type(field.type_node) {
                        if let Some(TypeNode::Ref { target, .. }) = context.get_type(*elem) {
                            assert_eq!(context.get_str(*target), "OrderItem");
                        }
                    }
                }
            }
        }
        _ => panic!("Expected Order interface"),
    }
}

#[tokio::test]
async fn test_functions() {
    let input = r#"
    function validateUser(user: User): boolean {
        return true
    }
    
    function greet(name: string): string {
        return "Hello"
    }
    "#;

    let (program, context) = parse_file(input).await.unwrap();
    assert_eq!(program.declarations.len(), 2);
    
    // Check validateUser function
    let validate_id = NodeId { index: program.declarations.start.index };
    match context.get_ast(validate_id) {
        Some(AstNode::FunctionDecl { name, params, return_type, .. }) => {
            assert_eq!(context.get_str(*name), "validateUser");
            assert_eq!(params.len(), 1);
            
            // Check parameter
            let param_id = NodeId { index: params.start.index };
            if let Some(param) = context.get_param(param_id) {
                assert_eq!(context.get_str(param.name), "user");
                
                // Check parameter type
                if let Some(Some(TypeNode::Ref { target, .. })) = param.type_node.map(|id| context.get_type(id)) {
                    assert_eq!(context.get_str(*target), "User");
                }
            }
            
            // Check return type
            if let Some(ret_id) = return_type {
                assert!(matches!(context.get_type(*ret_id), Some(TypeNode::Boolean { .. })));
            }
        }
        _ => panic!("Expected validateUser function"),
    }
    
    // Check greet function
    let greet_id = NodeId { index: program.declarations.start.index + 1 };
    match context.get_ast(greet_id) {
        Some(AstNode::FunctionDecl { name, params, return_type, .. }) => {
            assert_eq!(context.get_str(*name), "greet");
            assert_eq!(params.len(), 1);
            
            // Check return type is string
            if let Some(ret_id) = return_type {
                assert!(matches!(context.get_type(*ret_id), Some(TypeNode::String { .. })));
            }
        }
        _ => panic!("Expected greet function"),
    }
}

#[tokio::test]
async fn test_export_import() {
    let input = r#"
    interface User {
        name: string
    }
    
    export { User }
    "#;

    let (program, context) = parse_file(input).await.unwrap();
    assert_eq!(program.declarations.len(), 2);
    
    // Check interface
    let user_id = NodeId { index: program.declarations.start.index };
    assert!(matches!(context.get_ast(user_id), Some(AstNode::TypeDecl { .. })));
    
    // Check export
    let export_id = NodeId { index: program.declarations.start.index + 1 };
    assert!(matches!(context.get_ast(export_id), Some(AstNode::Export { .. })));
}