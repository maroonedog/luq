fn main() {
    // Test the completion logic conditions
    let test_cases = vec![
        "  @",      // Should match: ends_with("@")
        "@",        // Should match: ends_with("@")
        "@val",     // Should match: trimmed starts_with("@") && !contains(' ')
        "  @val",   // Should match: trimmed starts_with("@") && !contains(' ')
        "@ ",       // Should NOT match: contains space after @
        "",         // Should NOT match
    ];
    
    for before_cursor in test_cases {
        let should_complete = before_cursor.ends_with("@") || 
           before_cursor.trim_end().ends_with("@") ||
           (before_cursor.len() > 0 && {
               let trimmed = before_cursor.trim_start();
               trimmed.starts_with("@") && !trimmed.contains(' ')
           });
           
        println!("'{}' -> {}", before_cursor, should_complete);
    }
}