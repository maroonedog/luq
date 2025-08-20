#!/bin/bash

# Luq Build Script
# Quick build script for LSP development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default to debug build
BUILD_TYPE="${1:-debug}"

echo -e "${YELLOW}Building Luq LSP (${BUILD_TYPE} mode)...${NC}"

cd compiler

if [ "$BUILD_TYPE" = "release" ]; then
    echo -e "${GREEN}Building release version (optimized)...${NC}"
    cargo build --release --bin luq-lsp
    echo -e "${GREEN}✓ Built: target/release/luq-lsp${NC}"
    echo -e "${YELLOW}To use this build, update .vscode/settings.json:${NC}"
    echo '  "luq.server.path": "/mnt/c/projects/luq/compiler/target/release/luq-lsp"'
else
    echo -e "${GREEN}Building debug version...${NC}"
    cargo build --bin luq-lsp
    echo -e "${GREEN}✓ Built: target/debug/luq-lsp${NC}"
    echo -e "${YELLOW}To use this build, update .vscode/settings.json:${NC}"
    echo '  "luq.server.path": "/mnt/c/projects/luq/compiler/target/debug/luq-lsp"'
fi

echo -e "${GREEN}Build complete! Reload VSCode window to use the new build.${NC}"
echo -e "${YELLOW}Tip: Press Ctrl+Shift+P and run 'Developer: Reload Window'${NC}"