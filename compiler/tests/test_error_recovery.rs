use luq_compiler::lexer::{tokenize, TokenKind};

#[test]
fn test_incomplete_decorator() {
    // ユーザーが"@"だけ入力した状態
    let input = "@";
    let result = tokenize(input);
    
    println!("Input: {:?}", input);
    println!("Result: {:?}", result);
    
    // 現在の実装ではエラーになる可能性が高い
    // 理想的には、少なくとも"@"トークンは返すべき
    match result {
        Ok(tokens) => {
            println!("Success! Tokens: {:?}", tokens);
            assert!(tokens.iter().any(|t| matches!(t.kind, TokenKind::At)));
        }
        Err(errors) => {
            println!("Failed with errors: {:?}", errors);
            // エラーでもオートコンプリートには部分的な結果が必要
        }
    }
}

#[test]
fn test_incomplete_interface() {
    // ユーザーが"interface"を入力途中
    let inputs = vec![
        "inter",
        "interface",
        "interface U",
        "interface User {",
        "interface User { n",
        "interface User { name:",
    ];
    
    for input in inputs {
        println!("\n=== Testing: {:?} ===", input);
        let result = tokenize(input);
        
        match result {
            Ok(tokens) => {
                println!("Success! Token count: {}", tokens.len());
                // 部分的でもトークンが返ることを確認
                assert!(tokens.len() > 0);
            }
            Err(errors) => {
                println!("Failed with {} errors", errors.len());
                // エラーでもこの時点までのトークンが必要
            }
        }
    }
}

#[test]
fn test_consecutive_autocomplete_calls() {
    // 連続でオートコンプリートを呼び出すシミュレーション
    let base_input = "interface User {\n  @";
    
    // ユーザーが連続で候補を探している状況
    let completions = vec![
        format!("{}", base_input),
        format!("{}r", base_input),
        format!("{}re", base_input),
        format!("{}req", base_input),
        format!("{}required", base_input),
    ];
    
    for (i, input) in completions.iter().enumerate() {
        println!("\n=== Call {} ===", i + 1);
        let result = tokenize(input);
        
        match result {
            Ok(tokens) => {
                println!("Success! Last few tokens:");
                for token in tokens.iter().rev().take(3) {
                    println!("  {:?}", token.kind);
                }
            }
            Err(errors) => {
                println!("Failed! First error: {:?}", errors.first());
                // ここでオートコンプリートが動作しない
            }
        }
    }
}

#[test]
fn test_error_in_middle_of_file() {
    // ファイルの途中にエラーがある場合
    let input = r#"
        interface User {
            name: string;
            @@@invalid@@@  // エラー
            age: number;
        }
        
        interface Admin {
            role: string;
        }
    "#;
    
    let result = tokenize(input);
    
    match result {
        Ok(tokens) => {
            println!("Unexpectedly succeeded with {} tokens", tokens.len());
        }
        Err(errors) => {
            println!("Failed with {} errors", errors.len());
            // エラーがあっても、前後の有効な部分は解析されるべき
            // 現在の実装では全体が失敗する
        }
    }
}

#[test]
fn test_multiple_errors() {
    // 複数のエラーがある場合
    let input = r#"
        interface User {
            @@@error1
            name: string;
            ###error2
            age: number;
            $$$error3
        }
    "#;
    
    let result = tokenize(input);
    
    match result {
        Ok(_) => {
            println!("Unexpectedly succeeded");
        }
        Err(errors) => {
            println!("Error count: {}", errors.len());
            // 理想的には全てのエラーを収集すべき
            assert!(errors.len() >= 1);
        }
    }
}

#[test]
fn test_unclosed_string() {
    // 文字列が閉じられていない場合
    let input = r#"
        interface User {
            name: "unclosed string
            age: number;
        }
    "#;
    
    let result = tokenize(input);
    
    match result {
        Ok(tokens) => {
            println!("Token count: {}", tokens.len());
        }
        Err(errors) => {
            println!("Failed as expected: {:?}", errors.first());
            // 文字列エラー後も他のトークンを解析すべき
        }
    }
}

#[test]
fn test_partial_comment() {
    // コメントが不完全な場合
    let inputs = vec![
        "// partial comment without newline",
        "/* unclosed comment",
        "/// doc comment without content",
    ];
    
    for input in inputs {
        println!("\n=== Testing: {:?} ===", input);
        let result = tokenize(input);
        
        // コメントの場合は比較的寛容であるべき
        match result {
            Ok(tokens) => {
                println!("Success with {} tokens", tokens.len());
            }
            Err(errors) => {
                println!("Failed: {:?}", errors.first());
            }
        }
    }
}