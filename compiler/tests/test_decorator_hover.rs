use luq_compiler::parser::Parser;
use luq_compiler::lsp::hover::get_hover_info_at_position;
use tower_lsp::lsp_types::Position;

#[test]
fn test_hover_on_validator_decorator() {
    let source = r#"
/// Validates that a user ID is in the correct format
/// @param value The user ID to validate
/// @returns true if valid, false otherwise
@validator
function validateUser(value: string): boolean {
    return value.startsWith("user_");
}

interface User {
    @validateUser
    id: string;
}
"#;

    let parser = Parser::new(source.to_string());
    let (program, context) = parser.parse(source).expect("Should parse");
    
    // @validateUserの位置でホバー (line 10, character 6あたり)
    let position = Position { line: 10, character: 6 };
    let hover_info = get_hover_info_at_position(&program, &context, &position, source);
    
    assert!(hover_info.is_some(), "Should provide hover info for decorator");
    
    let hover = hover_info.unwrap();
    assert!(hover.contains("validateUser"), "Hover should contain function name");
    assert!(hover.contains("Validates that a user ID"), "Hover should contain documentation");
    assert!(hover.contains("@param value"), "Hover should contain parameter documentation");
    assert!(hover.contains("@returns"), "Hover should contain return documentation");
}

#[test]
fn test_hover_on_imported_decorator() {
    let source = r#"
import { validateEmail } from "./validators.luq";

interface User {
    @validateEmail
    email: string;
}
"#;

    let parser = Parser::new(source.to_string());
    let (program, context) = parser.parse(source).expect("Should parse");
    
    // @validateEmailの位置でホバー
    let position = Position { line: 4, character: 6 };
    let hover_info = get_hover_info_at_position(&program, &context, &position, source);
    
    assert!(hover_info.is_some(), "Should provide hover info for imported decorator");
    
    let hover = hover_info.unwrap();
    assert!(hover.contains("validateEmail"), "Hover should contain imported function name");
    assert!(hover.contains("imported from"), "Hover should indicate it's imported");
}

#[test]
fn test_hover_on_undefined_decorator() {
    let source = r#"
interface User {
    @nonExistent
    id: string;
}
"#;

    let parser = Parser::new(source.to_string());
    let (program, context) = parser.parse(source).expect("Should parse");
    
    // @nonExistentの位置でホバー
    let position = Position { line: 2, character: 6 };
    let hover_info = get_hover_info_at_position(&program, &context, &position, source);
    
    // 未定義のデコレーターでもホバー情報を提供（エラーメッセージを表示）
    assert!(hover_info.is_some(), "Should provide hover info even for undefined decorator");
    
    let hover = hover_info.unwrap();
    assert!(hover.contains("nonExistent"), "Hover should contain decorator name");
    assert!(hover.contains("not defined") || hover.contains("undefined"), 
            "Hover should indicate decorator is undefined");
}

#[test]
fn test_hover_shows_validator_signature() {
    let source = r#"
/// Custom length validator
@validator
function minLength(value: string, min: number): boolean {
    return value.length >= min;
}

interface User {
    @minLength(3)
    username: string;
}
"#;

    let parser = Parser::new(source.to_string());
    let (program, context) = parser.parse(source).expect("Should parse");
    
    // @minLengthの位置でホバー
    let position = Position { line: 8, character: 6 };
    let hover_info = get_hover_info_at_position(&program, &context, &position, source);
    
    assert!(hover_info.is_some(), "Should provide hover info for decorator with parameters");
    
    let hover = hover_info.unwrap();
    assert!(hover.contains("minLength"), "Hover should contain function name");
    assert!(hover.contains("(value: string, min: number)"), "Hover should show function signature");
    assert!(hover.contains("boolean"), "Hover should show return type");
    assert!(hover.contains("Custom length validator"), "Hover should show documentation");
}