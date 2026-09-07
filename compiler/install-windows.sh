#!/bin/bash
# Install script for Luq LSP on Windows (from WSL)

echo "=================================================="
echo "Luq LSP Windows Installation Script"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in WSL
if ! grep -q microsoft /proc/version; then
    echo -e "${RED}Error: This script must be run from WSL${NC}"
    exit 1
fi

# Set paths
PROJECT_DIR="/mnt/c/projects/luq/compiler"
WINDOWS_TARGET_DIR="$PROJECT_DIR/target/release"
SOURCE_EXE="target/x86_64-pc-windows-gnu/release/luq-lsp.exe"

echo -e "\n${YELLOW}Step 1: Checking environment...${NC}"

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}Error: Rust is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Rust is installed"

# Check if mingw-w64 is installed
if ! command -v x86_64-w64-mingw32-gcc &> /dev/null; then
    echo -e "${YELLOW}Installing mingw-w64 for Windows cross-compilation...${NC}"
    sudo apt-get update && sudo apt-get install -y mingw-w64
fi
echo -e "${GREEN}✓${NC} mingw-w64 is installed"

# Add Windows target if not already added
if ! rustup target list | grep -q "x86_64-pc-windows-gnu (installed)"; then
    echo -e "${YELLOW}Adding Windows target...${NC}"
    rustup target add x86_64-pc-windows-gnu
fi
echo -e "${GREEN}✓${NC} Windows target is configured"

echo -e "\n${YELLOW}Step 2: Building Windows executable...${NC}"

# Build the Windows executable
cargo build --release --target x86_64-pc-windows-gnu --bin luq-lsp

if [ ! -f "$SOURCE_EXE" ]; then
    echo -e "${RED}Error: Build failed - executable not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Build successful"

echo -e "\n${YELLOW}Step 3: Installing to Windows path...${NC}"

# Create target directory if it doesn't exist
mkdir -p "$WINDOWS_TARGET_DIR"

# Copy the executable
cp "$SOURCE_EXE" "$WINDOWS_TARGET_DIR/luq-lsp.exe"

if [ ! -f "$WINDOWS_TARGET_DIR/luq-lsp.exe" ]; then
    echo -e "${RED}Error: Failed to copy executable${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Installed to: C:\\projects\\luq\\compiler\\target\\release\\luq-lsp.exe"

# Get file info
SIZE=$(ls -lh "$WINDOWS_TARGET_DIR/luq-lsp.exe" | awk '{print $5}')
echo -e "   File size: ${SIZE}"

echo -e "\n${YELLOW}Step 4: Creating VSCode configuration...${NC}"

# Create .vscode directory if it doesn't exist
mkdir -p "$PROJECT_DIR/.vscode"

# Update or create settings.json
SETTINGS_FILE="$PROJECT_DIR/.vscode/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
    echo -e "${YELLOW}   Updating existing settings.json...${NC}"
    # Backup existing settings
    cp "$SETTINGS_FILE" "$SETTINGS_FILE.bak"
else
    echo -e "${YELLOW}   Creating new settings.json...${NC}"
    echo "{}" > "$SETTINGS_FILE"
fi

# Add LSP path to settings (using jq if available, otherwise manual)
if command -v jq &> /dev/null; then
    jq '. + {"luq.server.path": "C:\\projects\\luq\\compiler\\target\\release\\luq-lsp.exe"}' "$SETTINGS_FILE" > "$SETTINGS_FILE.tmp" && mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"
else
    # Manual update if jq is not available
    cat > "$SETTINGS_FILE" << EOF
{
    "luq.server.path": "C:\\projects\\luq\\compiler\\target\\release\\luq-lsp.exe",
    "luq.trace.server": "verbose"
}
EOF
fi

echo -e "${GREEN}✓${NC} VSCode configuration updated"

echo -e "\n${YELLOW}Step 5: Creating test file...${NC}"

# Create a test Luq file
cat > "$PROJECT_DIR/test.luq" << 'EOF'
// Test file for Luq LSP with chumsky+logos parser
@validator
@description("Test validation function")
function validateTest(data: { value: string }) {
    if (!data.value) {
        return "Value is required";
    }
    return true;
}

type Result = boolean | string;
export { validateTest, Result };
EOF

echo -e "${GREEN}✓${NC} Test file created: test.luq"

echo -e "\n=================================================="
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "=================================================="
echo
echo "Luq LSP has been installed with:"
echo "  • Parser: chumsky + logos + ariadne"
echo "  • Location: C:\\projects\\luq\\compiler\\target\\release\\luq-lsp.exe"
echo "  • File size: $SIZE"
echo
echo "To use in VSCode:"
echo "  1. Open VSCode in Windows"
echo "  2. Install the Luq extension (if not already installed)"
echo "  3. Open a .luq file"
echo "  4. The LSP should start automatically"
echo
echo "To test manually from PowerShell:"
echo '  PS> C:\projects\luq\compiler\target\release\luq-lsp.exe --version'
echo
echo "To rebuild and reinstall:"
echo "  $ ./install-windows.sh"
echo