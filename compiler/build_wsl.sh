#!/bin/bash
# Build script for WSL environment

echo "Building in WSL environment..."

# Set environment variables
export CARGO_TARGET_DIR=target-wsl
export RUST_BACKTRACE=1

# Clean previous builds
echo "Cleaning previous builds..."
cargo clean 2>/dev/null

# Build the LSP server
echo "Building LSP server..."
cargo build --bin luq-lsp --release

# Build the compiler
echo "Building compiler..."
cargo build --bin luqc --release

echo "Build complete!"
echo "Binaries are located in: $CARGO_TARGET_DIR/release/"

# List the built binaries
ls -la $CARGO_TARGET_DIR/release/luq* 2>/dev/null || echo "No binaries found"