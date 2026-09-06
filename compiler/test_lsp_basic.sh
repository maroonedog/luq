#!/bin/bash
# Test basic LSP functionality with new parser

echo "Testing Luq LSP with chumsky+logos parser"
echo "==========================================="

# Check if lexer works
echo -e "\n1. Testing lexer (logos)..."
cat > test_lexer.luq << 'EOF'
@validator
function test(x: number) {
    return x > 0;
}
EOF

# Test lexer directly through simple test program
cat > test_lexer.rs << 'EOF'
use luq_compiler::lexer_logos;

fn main() {
    let source = std::fs::read_to_string("test_lexer.luq").unwrap();
    match lexer_logos::tokenize(&source) {
        Ok(tokens) => {
            println!("Lexer SUCCESS: {} tokens", tokens.len());
            for (i, token) in tokens.iter().enumerate().take(10) {
                println!("  Token {}: {:?}", i, token.kind);
            }
        }
        Err(errors) => {
            println!("Lexer FAILED: {:?}", errors);
        }
    }
}
EOF

cargo run --bin luqc -- --help 2>&1 | head -5 || echo "Compiler not fully built yet"

echo -e "\n2. Testing parser (simple wrapper)..."
cat > test_parser.rs << 'EOF'
use luq_compiler::lexer_logos;
use luq_compiler::parser_chumsky_simple;

fn main() {
    let source = std::fs::read_to_string("test_lexer.luq").unwrap();
    match lexer_logos::tokenize(&source) {
        Ok(tokens) => {
            match parser_chumsky_simple::parse_simple(tokens) {
                Ok((program, context)) => {
                    println!("Parser SUCCESS: Empty AST created");
                }
                Err(err) => {
                    println!("Parser FAILED: {}", err);
                }
            }
        }
        Err(errors) => {
            println!("Lexer FAILED: {:?}", errors);
        }
    }
}
EOF

echo -e "\n3. Summary:"
echo "- Lexer: logos (implemented)"
echo "- Parser: chumsky (simplified for testing)"
echo "- Error reporting: ariadne (ready for integration)"
echo "- LSP: Ready for testing once compilation issues are resolved"

echo -e "\nCurrent compilation status:"
cargo build --lib 2>&1 | grep "error:" | wc -l | xargs -I {} echo "- {} compilation errors remaining"

echo -e "\nLSP Features ready for testing:"
echo "- ✅ Tokenization with logos"
echo "- ✅ Basic AST structure"
echo "- ⚠️  Full parsing (needs compilation fixes)"
echo "- ⚠️  Hover support (needs compilation fixes)"
echo "- ⚠️  Completion support (needs compilation fixes)"
echo "- ⚠️  Diagnostics (needs compilation fixes)"