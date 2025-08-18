use luq_compiler::ast::{DecoratorArg, Program, Statement, TypeAnnotation};
use luq_compiler::lexer::Lexer;
use luq_compiler::parser::Parser;

async fn parse_file(content: &str) -> anyhow::Result<Program> {
    let mut lexer = Lexer::new(content);
    let tokens = lexer.tokenize().await?;
    let mut parser = Parser::new(tokens);
    parser.parse().await
}

#[tokio::test]
async fn test_full_user_example() {
    let input = r#"
    @validator
    interface User {
        @required @min(3) @max(50)
        name: string;
        
        @required @email
        email: string;
        
        @optional @pattern(/^\+?[1-9]\d{1,14}$/)
        phone?: string;
        
        @required @min(18) @max(120)
        age: number;
        
        @optional
        address?: Address;
        
        @required @arrayMin(1)
        roles: string[];
        
        readonly id: string;
        
        @transform("toLowerCase")
        username: string;
    }
    
    @validator
    interface Address {
        @required
        street: string;
        
        @required
        city: string;
        
        @required @pattern(/^\d{5}$/)
        zipCode: string;
        
        @optional
        country?: string;
    }
    "#;

    let program = parse_file(input).await.unwrap();
    
    // Should have 2 interfaces
    assert_eq!(program.statements.len(), 2);
    
    // Check User interface
    match &program.statements[0] {
        Statement::Interface(user) => {
            assert_eq!(user.name, "User");
            assert_eq!(user.decorators.len(), 1);
            assert_eq!(user.decorators[0].name, "validator");
            
            // Verify all fields are present
            let field_names: Vec<_> = user.members.iter().map(|m| m.key.as_str()).collect();
            assert_eq!(
                field_names,
                vec!["name", "email", "phone", "age", "address", "roles", "id", "username"]
            );
            
            // Check name field decorators
            let name_field = &user.members[0];
            assert_eq!(name_field.decorators.len(), 3);
            assert_eq!(name_field.decorators[0].name, "required");
            assert_eq!(name_field.decorators[1].name, "min");
            assert_eq!(name_field.decorators[2].name, "max");
            
            // Check min decorator argument
            match &name_field.decorators[1].args[0] {
                DecoratorArg::Number(n) => assert_eq!(*n, 3.0),
                _ => panic!("Expected number argument for min"),
            }
            
            // Check phone field is optional with pattern
            let phone_field = &user.members[2];
            assert!(phone_field.optional);
            assert_eq!(phone_field.decorators[1].name, "pattern");
            match &phone_field.decorators[1].args[0] {
                DecoratorArg::Regex(r) => assert_eq!(r, r"^\+?[1-9]\d{1,14}$"),
                _ => panic!("Expected regex argument for pattern"),
            }
            
            // Check readonly id field
            let id_field = &user.members[6];
            assert!(id_field.readonly);
            assert_eq!(id_field.key, "id");
            
            // Check array type for roles
            let roles_field = &user.members[5];
            match &roles_field.type_annotation {
                TypeAnnotation::Array(inner) => {
                    assert!(matches!(**inner, TypeAnnotation::String));
                }
                _ => panic!("Expected array type for roles"),
            }
            
            // Check transform decorator
            let username_field = &user.members[7];
            assert_eq!(username_field.decorators[0].name, "transform");
            match &username_field.decorators[0].args[0] {
                DecoratorArg::String(s) => assert_eq!(s, "toLowerCase"),
                _ => panic!("Expected string argument for transform"),
            }
        }
        _ => panic!("Expected User interface"),
    }
    
    // Check Address interface
    match &program.statements[1] {
        Statement::Interface(address) => {
            assert_eq!(address.name, "Address");
            assert_eq!(address.decorators.len(), 1);
            assert_eq!(address.decorators[0].name, "validator");
            
            // Check zipCode pattern
            let zip_field = &address.members[2];
            assert_eq!(zip_field.key, "zipCode");
            assert_eq!(zip_field.decorators[1].name, "pattern");
            match &zip_field.decorators[1].args[0] {
                DecoratorArg::Regex(r) => assert_eq!(r, r"^\d{5}$"),
                _ => panic!("Expected regex argument"),
            }
            
            // Check optional country field
            let country_field = &address.members[3];
            assert!(country_field.optional);
        }
        _ => panic!("Expected Address interface"),
    }
}

#[tokio::test]
async fn test_complex_validation_rules() {
    let input = r#"
    @validator
    @generateSchema
    interface Product {
        @required @trim @lowercase
        sku: string;
        
        @required @min(1) @max(1000)
        @transform("round")
        quantity: number;
        
        @required @range(0.01, 999999.99)
        @precision(2)
        price: number;
        
        @optional @oneOf(["active", "inactive", "discontinued"])
        status?: string;
        
        @required @arrayMin(1) @arrayMax(10)
        @each({ min: 3, max: 50 })
        tags: string[];
        
        @required @nested
        manufacturer: Manufacturer;
        
        @conditional("status", "active", { required: true })
        launchDate?: string;
        
        @custom("validateBarcode")
        barcode: string;
    }
    "#;

    let program = parse_file(input).await.unwrap();
    
    match &program.statements[0] {
        Statement::Interface(product) => {
            // Check interface has multiple decorators
            assert_eq!(product.decorators.len(), 2);
            assert_eq!(product.decorators[0].name, "validator");
            assert_eq!(product.decorators[1].name, "generateSchema");
            
            // Check SKU field with multiple string decorators
            let sku_field = &product.members[0];
            assert_eq!(sku_field.decorators.len(), 3);
            assert_eq!(sku_field.decorators[0].name, "required");
            assert_eq!(sku_field.decorators[1].name, "trim");
            assert_eq!(sku_field.decorators[2].name, "lowercase");
            
            // Check price field with range and precision
            let price_field = &product.members[2];
            let range_decorator = &price_field.decorators[1];
            assert_eq!(range_decorator.name, "range");
            assert_eq!(range_decorator.args.len(), 2);
            match &range_decorator.args[0] {
                DecoratorArg::Number(n) => assert_eq!(*n, 0.01),
                _ => panic!("Expected number for range min"),
            }
            match &range_decorator.args[1] {
                DecoratorArg::Number(n) => assert_eq!(*n, 999999.99),
                _ => panic!("Expected number for range max"),
            }
            
            // Check oneOf decorator with array of strings
            let status_field = &product.members[3];
            let oneof_decorator = &status_field.decorators[1];
            assert_eq!(oneof_decorator.name, "oneOf");
            match &oneof_decorator.args[0] {
                DecoratorArg::Array(options) => {
                    assert_eq!(options.len(), 3);
                    match &options[0] {
                        DecoratorArg::String(s) => assert_eq!(s, "active"),
                        _ => panic!("Expected string in oneOf array"),
                    }
                }
                _ => panic!("Expected array argument for oneOf"),
            }
            
            // Check tags field with each decorator containing object
            let tags_field = &product.members[4];
            let each_decorator = tags_field.decorators.iter().find(|d| d.name == "each").unwrap();
            match &each_decorator.args[0] {
                DecoratorArg::Object(fields) => {
                    assert_eq!(fields.len(), 2);
                    assert_eq!(fields[0].0, "min");
                    assert_eq!(fields[1].0, "max");
                }
                _ => panic!("Expected object argument for each"),
            }
            
            // Check conditional decorator with multiple arguments
            let launch_field = &product.members[6];
            let conditional_decorator = &launch_field.decorators[0];
            assert_eq!(conditional_decorator.name, "conditional");
            assert_eq!(conditional_decorator.args.len(), 3);
            match &conditional_decorator.args[0] {
                DecoratorArg::String(s) => assert_eq!(s, "status"),
                _ => panic!("Expected string for field name"),
            }
            match &conditional_decorator.args[1] {
                DecoratorArg::String(s) => assert_eq!(s, "active"),
                _ => panic!("Expected string for condition value"),
            }
            match &conditional_decorator.args[2] {
                DecoratorArg::Object(rules) => {
                    assert_eq!(rules[0].0, "required");
                    match &rules[0].1 {
                        DecoratorArg::Boolean(b) => assert!(*b),
                        _ => panic!("Expected boolean for required"),
                    }
                }
                _ => panic!("Expected object for validation rules"),
            }
            
            // Check custom decorator
            let barcode_field = &product.members[7];
            assert_eq!(barcode_field.decorators[0].name, "custom");
            match &barcode_field.decorators[0].args[0] {
                DecoratorArg::String(s) => assert_eq!(s, "validateBarcode"),
                _ => panic!("Expected string for custom validator name"),
            }
        }
        _ => panic!("Expected Product interface"),
    }
}

#[tokio::test]
async fn test_nested_interfaces() {
    let input = r#"
    @validator
    interface Order {
        @required
        id: string;
        
        @required @nested
        customer: Customer;
        
        @required @arrayMin(1) @arrayMax(100)
        @each({ nested: true })
        items: OrderItem[];
        
        @required @min(0)
        total: number;
    }
    
    interface Customer {
        @required
        name: string;
        
        @required @email
        email: string;
    }
    
    interface OrderItem {
        @required
        productId: string;
        
        @required @min(1)
        quantity: number;
        
        @required @min(0)
        price: number;
    }
    "#;

    let program = parse_file(input).await.unwrap();
    assert_eq!(program.statements.len(), 3);
    
    // Verify all three interfaces are parsed
    let interface_names: Vec<_> = program.statements.iter().map(|stmt| {
        match stmt {
            Statement::Interface(i) => i.name.as_str(),
            _ => panic!("Expected interface"),
        }
    }).collect();
    
    assert_eq!(interface_names, vec!["Order", "Customer", "OrderItem"]);
    
    // Check nested decorator on customer field
    match &program.statements[0] {
        Statement::Interface(order) => {
            let customer_field = &order.members[1];
            assert_eq!(customer_field.key, "customer");
            assert!(customer_field.decorators.iter().any(|d| d.name == "nested"));
            
            // Check type reference
            match &customer_field.type_annotation {
                TypeAnnotation::Reference { name, .. } => {
                    assert_eq!(name, "Customer");
                }
                _ => panic!("Expected reference type"),
            }
            
            // Check items array with nested validation
            let items_field = &order.members[2];
            let each_decorator = items_field.decorators.iter().find(|d| d.name == "each").unwrap();
            match &each_decorator.args[0] {
                DecoratorArg::Object(fields) => {
                    assert_eq!(fields[0].0, "nested");
                    match &fields[0].1 {
                        DecoratorArg::Boolean(b) => assert!(*b),
                        _ => panic!("Expected boolean for nested"),
                    }
                }
                _ => panic!("Expected object for each decorator"),
            }
        }
        _ => panic!("Expected Order interface"),
    }
}

#[tokio::test]
async fn test_mixed_decorator_styles() {
    let input = r#"
    @validator
    interface Form {
        @required
        @min(3)
        @max(50)
        @pattern(/^[A-Za-z\s]+$/)
        @transform("trim")
        @transform("capitalize")
        name: string;
        
        @validate({
            required: true,
            min: 18,
            max: 120,
            message: "Age must be between 18 and 120"
        })
        age: number;
        
        @rules(["required", "email", "unique"])
        @messages({
            required: "Email is required",
            email: "Invalid email format",
            unique: "Email already exists"
        })
        email: string;
    }
    "#;

    let program = parse_file(input).await.unwrap();
    
    match &program.statements[0] {
        Statement::Interface(form) => {
            // Check name field with multiple individual decorators
            let name_field = &form.members[0];
            assert_eq!(name_field.decorators.len(), 6);
            let decorator_names: Vec<_> = name_field.decorators.iter().map(|d| d.name.as_str()).collect();
            assert_eq!(decorator_names, vec!["required", "min", "max", "pattern", "transform", "transform"]);
            
            // Check age field with single object-style decorator
            let age_field = &form.members[1];
            assert_eq!(age_field.decorators.len(), 1);
            assert_eq!(age_field.decorators[0].name, "validate");
            match &age_field.decorators[0].args[0] {
                DecoratorArg::Object(fields) => {
                    assert_eq!(fields.len(), 4);
                    // Verify all fields are present
                    let field_names: Vec<_> = fields.iter().map(|(k, _)| k.as_str()).collect();
                    assert!(field_names.contains(&"required"));
                    assert!(field_names.contains(&"min"));
                    assert!(field_names.contains(&"max"));
                    assert!(field_names.contains(&"message"));
                }
                _ => panic!("Expected object for validate decorator"),
            }
            
            // Check email field with rules array and messages object
            let email_field = &form.members[2];
            assert_eq!(email_field.decorators.len(), 2);
            
            // Check rules decorator
            assert_eq!(email_field.decorators[0].name, "rules");
            match &email_field.decorators[0].args[0] {
                DecoratorArg::Array(rules) => {
                    assert_eq!(rules.len(), 3);
                    match &rules[0] {
                        DecoratorArg::String(s) => assert_eq!(s, "required"),
                        _ => panic!("Expected string in rules array"),
                    }
                }
                _ => panic!("Expected array for rules"),
            }
            
            // Check messages decorator
            assert_eq!(email_field.decorators[1].name, "messages");
            match &email_field.decorators[1].args[0] {
                DecoratorArg::Object(messages) => {
                    assert_eq!(messages.len(), 3);
                    assert_eq!(messages[0].0, "required");
                    match &messages[0].1 {
                        DecoratorArg::String(s) => assert_eq!(s, "Email is required"),
                        _ => panic!("Expected string message"),
                    }
                }
                _ => panic!("Expected object for messages"),
            }
        }
        _ => panic!("Expected Form interface"),
    }
}

#[tokio::test]
async fn test_edge_cases() {
    // Test empty decorator
    let input1 = r#"
    @validator
    interface Test1 {
        @required
        field: string;
    }
    "#;
    let program1 = parse_file(input1).await.unwrap();
    match &program1.statements[0] {
        Statement::Interface(i) => {
            assert_eq!(i.decorators[0].args.len(), 0);
            assert_eq!(i.members[0].decorators[0].args.len(), 0);
        }
        _ => panic!("Expected interface"),
    }
    
    // Test decorator with empty array
    let input2 = r#"
    interface Test2 {
        @values([])
        field: string[];
    }
    "#;
    let program2 = parse_file(input2).await.unwrap();
    match &program2.statements[0] {
        Statement::Interface(i) => {
            match &i.members[0].decorators[0].args[0] {
                DecoratorArg::Array(arr) => assert_eq!(arr.len(), 0),
                _ => panic!("Expected empty array"),
            }
        }
        _ => panic!("Expected interface"),
    }
    
    // Test decorator with empty object
    let input3 = r#"
    interface Test3 {
        @config({})
        field: string;
    }
    "#;
    let program3 = parse_file(input3).await.unwrap();
    match &program3.statements[0] {
        Statement::Interface(i) => {
            match &i.members[0].decorators[0].args[0] {
                DecoratorArg::Object(obj) => assert_eq!(obj.len(), 0),
                _ => panic!("Expected empty object"),
            }
        }
        _ => panic!("Expected interface"),
    }
    
    // Test deeply nested structures
    let input4 = r#"
    interface Test4 {
        @config({
            nested: {
                deeply: {
                    value: 42
                }
            }
        })
        field: string;
    }
    "#;
    let program4 = parse_file(input4).await.unwrap();
    match &program4.statements[0] {
        Statement::Interface(i) => {
            match &i.members[0].decorators[0].args[0] {
                DecoratorArg::Object(obj) => {
                    assert_eq!(obj[0].0, "nested");
                    match &obj[0].1 {
                        DecoratorArg::Object(inner) => {
                            assert_eq!(inner[0].0, "deeply");
                            match &inner[0].1 {
                                DecoratorArg::Object(innermost) => {
                                    assert_eq!(innermost[0].0, "value");
                                    match &innermost[0].1 {
                                        DecoratorArg::Number(n) => assert_eq!(*n, 42.0),
                                        _ => panic!("Expected number"),
                                    }
                                }
                                _ => panic!("Expected object"),
                            }
                        }
                        _ => panic!("Expected object"),
                    }
                }
                _ => panic!("Expected object"),
            }
        }
        _ => panic!("Expected interface"),
    }
}