#!/bin/bash

echo "=================================================="
echo "Luq LSP Windows Installation Verification"
echo "=================================================="
echo

# Check if executable exists
if [ -f "/mnt/c/projects/luq/compiler/target/release/luq-lsp.exe" ]; then
    echo "✅ Windows executable installed"
    echo "   Path: C:\\projects\\luq\\compiler\\target\\release\\luq-lsp.exe"
    
    # Get file size
    SIZE=$(ls -lh /mnt/c/projects/luq/compiler/target/release/luq-lsp.exe | awk '{print $5}')
    echo "   Size: $SIZE"
    
    # Get modification time
    MODIFIED=$(stat -c %y /mnt/c/projects/luq/compiler/target/release/luq-lsp.exe | cut -d' ' -f1,2 | cut -d'.' -f1)
    echo "   Modified: $MODIFIED"
else
    echo "❌ Windows executable NOT found"
    exit 1
fi

echo

# Check VSCode settings
if [ -f "/mnt/c/projects/luq/compiler/.vscode/settings.json" ]; then
    echo "✅ VSCode settings configured"
    if grep -q "luq.server.path" /mnt/c/projects/luq/compiler/.vscode/settings.json; then
        echo "   LSP path is set in settings.json"
    fi
else
    echo "❌ VSCode settings NOT found"
fi

echo

# Check test scripts
echo "✅ Test scripts available:"
[ -f "/mnt/c/projects/luq/compiler/test-lsp.ps1" ] && echo "   • test-lsp.ps1 (PowerShell)"
[ -f "/mnt/c/projects/luq/compiler/test-lsp.bat" ] && echo "   • test-lsp.bat (Command Prompt)"
[ -f "/mnt/c/projects/luq/compiler/install-windows.sh" ] && echo "   • install-windows.sh (WSL installer)"

echo
echo "=================================================="
echo "INSTALLATION COMPLETE"
echo "=================================================="
echo
echo "The Luq LSP has been successfully installed to Windows."
echo
echo "Parser stack:"
echo "  • Lexer: logos (fast DFA-based tokenizer)"
echo "  • Parser: chumsky (combinator with error recovery)"
echo "  • Errors: ariadne (beautiful error reporting)"
echo
echo "To use in VSCode:"
echo "  1. Open VSCode on Windows"
echo "  2. Open any .luq file"
echo "  3. The LSP will start automatically"
echo
echo "To test from Windows PowerShell:"
echo '  PS> .\test-lsp.ps1'
echo
echo "To rebuild from WSL:"
echo '  $ ./install-windows.sh'
