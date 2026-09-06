use luq_compiler::lexer::{tokenize, TokenKind};

#[test]
fn test_interface_declaration() {
    let input = r#"
        interface User {
            name: string;
            age: number;
        }
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    let non_eof_tokens: Vec<_> = tokens.iter()
        .filter(|t| !matches!(t.kind, TokenKind::Eof))
        .collect();
    
    // Check the main structure tokens
    assert!(non_eof_tokens.iter().any(|t| matches!(t.kind, TokenKind::Interface)));
    assert!(non_eof_tokens.iter().any(|t| matches!(t.kind, TokenKind::Identifier(ref s) if s == "User")));
    assert!(non_eof_tokens.iter().any(|t| matches!(t.kind, TokenKind::StringType)));
    assert!(non_eof_tokens.iter().any(|t| matches!(t.kind, TokenKind::NumberType)));
}

#[test]
fn test_decorators() {
    let input = r#"
        @validator
        @required
        @min(10)
        @max(100)
        @pattern(/^\d+$/)
        interface Config {
            value: number;
        }
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    let at_count = tokens.iter()
        .filter(|t| matches!(t.kind, TokenKind::At))
        .count();
    
    assert_eq!(at_count, 5);
}

#[test]
fn test_import_statements() {
    let input = r#"
        import { validateEmail, validatePhone } from "./validators.luq";
        import UserValidator from "./validators.luq";
        import * as utils from "./utils.luq";
        import { type User } from "../types/user.ts";
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    let import_count = tokens.iter()
        .filter(|t| matches!(t.kind, TokenKind::Import))
        .count();
    
    assert_eq!(import_count, 4);
    
    let from_count = tokens.iter()
        .filter(|t| matches!(t.kind, TokenKind::From))
        .count();
    
    assert_eq!(from_count, 4);
}

#[test]
fn test_export_statements() {
    let input = r#"
        export interface User { }
        export function validate() { }
        export default class Manager { }
        export { User as UserType };
        export * from "./types.luq";
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    let export_count = tokens.iter()
        .filter(|t| matches!(t.kind, TokenKind::Export))
        .count();
    
    assert_eq!(export_count, 5);
}

#[test]
fn test_function_declaration() {
    let input = r#"
        function processUser(name: string, age: number): boolean {
            const isValid = name.length > 0 && age >= 18;
            return isValid;
        }
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Function)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Const)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Return)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::AndAnd)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::GreaterThanEquals)));
}

#[test]
fn test_string_literals() {
    let input = r#"
        const str1 = "hello world";
        const str2 = 'single quotes';
        const str3 = "with \"escaped\" quotes";
        const str4 = 'with \'escaped\' apostrophes';
        const str5 = "with\nnewline";
        const str6 = "with\ttab";
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    let string_literals: Vec<_> = tokens.iter()
        .filter_map(|t| match &t.kind {
            TokenKind::StringLiteral(s) => Some(s.clone()),
            _ => None
        })
        .collect();
    
    assert_eq!(string_literals.len(), 6);
    assert!(string_literals.contains(&"hello world".to_string()));
    assert!(string_literals.contains(&"single quotes".to_string()));
}

#[test]
fn test_number_literals() {
    let input = r#"
        const int = 42;
        const float = 3.14;
        const negative = -10;
        const scientific = 1.5e10;
        const negScientific = 2.5e-3;
        const zero = 0;
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    let numbers: Vec<_> = tokens.iter()
        .filter_map(|t| match t.kind {
            TokenKind::NumberLiteral(n) => Some(n),
            _ => None
        })
        .collect();
    
    assert!(numbers.len() >= 6);
    assert!(numbers.contains(&42.0));
    assert!(numbers.contains(&3.14));
    assert!(numbers.contains(&0.0));
}

#[test]
fn test_boolean_and_null_literals() {
    let input = r#"
        const isTrue = true;
        const isFalse = false;
        const nothing = null;
        const notDefined = undefined;
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::True)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::False)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Null)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Undefined)));
}

#[test]
fn test_comments() {
    let input = r#"
        // This is a single-line comment
        /// This is a doc comment
        /* This is a 
           multi-line comment */
        interface User { // inline comment
            name: string; /// inline doc comment
        }
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    
    let single_line_comments = tokens.iter()
        .filter(|t| matches!(t.kind, TokenKind::SingleLineComment(_)))
        .count();
    
    let doc_comments = tokens.iter()
        .filter(|t| matches!(t.kind, TokenKind::DocComment(_)))
        .count();
    
    let multi_line_comments = tokens.iter()
        .filter(|t| matches!(t.kind, TokenKind::MultiLineComment(_)))
        .count();
    
    assert!(single_line_comments >= 1);
    assert!(doc_comments >= 1);
    assert!(multi_line_comments >= 1);
}

#[test]
fn test_regex_literals() {
    let input = r#"
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const phoneRegex = /^\+?[\d-]+$/;
        const simpleRegex = /test/gi;
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    let regex_literals = tokens.iter()
        .filter(|t| matches!(t.kind, TokenKind::RegexLiteral(_)))
        .count();
    
    assert!(regex_literals >= 3);
}

#[test]
fn test_operators() {
    let input = r#"
        a === b;
        c !== d;
        e && f || g;
        h += 1;
        i -= 2;
        j *= 3;
        k /= 4;
        l++;
        m--;
        n => o;
        p == q;
        r != s;
        t <= u;
        v >= w;
        x | y;
        z & aa;
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::EqualsEqualsEquals)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::BangEqualsEquals)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::AndAnd)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::OrOr)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::PlusEquals)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::MinusEquals)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::StarEquals)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::SlashEquals)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::PlusPlus)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::MinusMinus)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Arrow)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::EqualsEquals)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::BangEquals)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::LessThanEquals)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::GreaterThanEquals)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Pipe)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Ampersand)));
}

#[test]
fn test_type_annotations() {
    let input = r#"
        interface User {
            name: string;
            age: number;
            isActive: boolean;
            data: any;
            result: unknown;
            empty: void;
            impossible: never;
            nullable?: string;
            union: string | number;
            intersection: User & Admin;
            array: string[];
        }
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::StringType)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::NumberType)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::BooleanType)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::AnyType)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::UnknownType)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::VoidType)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::NeverType)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Question)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Pipe)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Ampersand)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::LeftBracket)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::RightBracket)));
}

#[test]
fn test_extends_and_implements() {
    let input = r#"
        interface Admin extends User {
            permissions: string[];
        }
        
        class UserService implements IUserService {
            getUser(): User { }
        }
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Extends)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Implements)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Class)));
}

#[test]
fn test_async_await() {
    let input = r#"
        async function fetchUser(): Promise<User> {
            const result = await getUserFromAPI();
            return result;
        }
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Async)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Await)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Promise)));
}

#[test]
fn test_spread_operator() {
    let input = r#"
        const merged = { ...obj1, ...obj2 };
        const arr = [...items1, ...items2];
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    let ellipsis_count = tokens.iter()
        .filter(|t| matches!(t.kind, TokenKind::Ellipsis))
        .count();
    
    assert_eq!(ellipsis_count, 4);
}

#[test]
fn test_complex_real_world_example() {
    let input = r#"
        /// User validation service
        /// Handles all user-related validation logic
        import { validateEmail, validatePhone } from "./validators.luq";
        import { type User } from "../types/user.ts";
        
        @validator
        export interface UserProfile extends User {
            @required @min(3) @max(50)
            username: string;
            
            @required @email
            email: string;
            
            @optional @pattern(/^\+?[\d-]+$/)
            phone?: string;
            
            @array @minLength(1) @maxLength(5)
            addresses: Address[];
            
            metadata: {
                createdAt: Date;
                updatedAt: Date;
                version: number;
            };
        }
        
        export async function validateUserProfile(profile: UserProfile): Promise<boolean> {
            // Validate email format
            if (!validateEmail(profile.email)) {
                return false;
            }
            
            // Validate phone if provided
            if (profile.phone && !validatePhone(profile.phone)) {
                return false;
            }
            
            // Check username length
            const usernameLength = profile.username.length;
            if (usernameLength < 3 || usernameLength > 50) {
                return false;
            }
            
            return true;
        }
        
        export default UserProfile;
    "#;
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    
    // Verify we have all the major token types
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::DocComment(_))));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Import)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Export)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Interface)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Extends)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Function)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Async)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Promise)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::At)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Return)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::If)));
    assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::Default)));
    
    // Check that comments are preserved
    let comments: Vec<_> = tokens.iter()
        .filter(|t| matches!(t.kind, 
            TokenKind::SingleLineComment(_) | 
            TokenKind::DocComment(_) | 
            TokenKind::MultiLineComment(_)))
        .collect();
    
    assert!(comments.len() >= 3); // At least the doc comments and inline comments
}

#[test]
fn test_token_text_field() {
    let input = "interface User { }";
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    let interface_token = tokens.iter()
        .find(|t| matches!(t.kind, TokenKind::Interface))
        .expect("Should find interface token");
    
    assert_eq!(interface_token.text, "interface");
    
    let user_token = tokens.iter()
        .find(|t| matches!(t.kind, TokenKind::Identifier(ref s) if s == "User"))
        .expect("Should find User identifier");
    
    assert_eq!(user_token.text, "User");
}

#[test]
fn test_token_spans() {
    let input = "const x = 42;";
    
    let result = tokenize(input);
    assert!(result.is_ok());
    
    let tokens = result.unwrap();
    
    // Find the const token
    let const_token = tokens.iter()
        .find(|t| matches!(t.kind, TokenKind::Const))
        .expect("Should find const token");
    
    assert_eq!(const_token.span.start, 0);
    assert_eq!(const_token.span.end, 5);
    assert_eq!(&input[const_token.span.start..const_token.span.end], "const");
}