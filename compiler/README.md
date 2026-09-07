# Luq Compiler

Compiler for `.luq` DSL files - a TypeScript-like validation definition language with decorator support.

## Features

- TypeScript-like syntax with interface decorators
- AOT (Ahead-of-Time) compilation to runtime-free validation functions
- Multi-language code generation (TypeScript, Java planned)
- Zero runtime dependencies for generated code

## Prerequisites

### Install Rust

The Luq compiler is written in Rust. You need to install Rust to build from source:

```bash
# Install rustup (Rust toolchain manager)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Follow the on-screen instructions, then reload your shell configuration
source $HOME/.cargo/env

# Verify installation
rustc --version
cargo --version
```

The project uses Rust 1.75.0 by default (configured in `rust-toolchain.toml`).

## Installation

### Option 1: Install from npm (prebuilt binaries)

```bash
# Global installation
npm install -g @maroonedog/luq-compiler

# Or add to your project
npm install --save-dev @maroonedog/luq-compiler
```

### Option 2: Build from source

```bash
# Clone the repository
git clone https://github.com/maroonedog/luq.git
cd luq/compiler

# Install Rust dependencies and build
cargo build --release

# Build TypeScript wrapper
npm install
npm run build

# Optional: Link for global usage
npm link
```

## Usage

```bash
# Build the compiler
cargo build --release

# Compile a .luq file to TypeScript (AOT mode)
./target/release/luqc compile examples/user.luq --target typescript --aot

# Parse and check syntax
./target/release/luqc check examples/user.luq

# Debug: Print AST
./target/release/luqc parse examples/user.luq --pretty
```

## DSL Syntax

```typescript
@validator
interface User {
  @required @min(3) @max(50)
  name: string;
  
  @required @email
  email: string;
  
  @optional
  phone?: string;
}
```

## Project Structure

```
compiler/
├── src/
│   ├── ast/           # Abstract Syntax Tree definitions
│   ├── lexer/         # Tokenization
│   ├── parser/        # Syntax parsing
│   ├── codegen/       # Code generation
│   └── cli.rs         # CLI interface
├── examples/          # Sample .luq files
└── tests/            # Unit and integration tests
```

## Development

### Setup Development Environment

```bash
# Install development tools
cargo install cargo-watch  # For watch mode
cargo install cargo-expand # For macro debugging

# Install pre-commit hooks (optional)
rustup component add rustfmt clippy
```

### Development Commands

```bash
# Run tests
cargo test

# Run with example
cargo run -- compile examples/user.luq --aot

# Watch mode for development
cargo watch -x "run -- compile examples/user.luq"

# Format code
cargo fmt

# Lint code
cargo clippy

# Build for all platforms (requires cross-compilation setup)
npm run build:rust:all
```

### Cross-compilation Setup

To build for multiple platforms:

```bash
# Add target platforms
rustup target add x86_64-unknown-linux-gnu
rustup target add x86_64-pc-windows-msvc
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin

# Install cross-compilation tools (Linux)
sudo apt-get install gcc-mingw-w64  # For Windows target
```