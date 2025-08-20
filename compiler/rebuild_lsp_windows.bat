@echo off
echo Cleaning old Windows builds...
del target\release\luq-lsp.exe 2>nul
del vscode-luq\luq-lsp.exe 2>nul
del vscode-luq\bin\luq-lsp.exe 2>nul

echo Building LSP server for Windows...
cargo build --release --bin luq-lsp --target x86_64-pc-windows-msvc

if exist target\x86_64-pc-windows-msvc\release\luq-lsp.exe (
    echo Copying to VSCode extension...
    copy /Y target\x86_64-pc-windows-msvc\release\luq-lsp.exe vscode-luq\luq-lsp.exe
    if not exist vscode-luq\bin mkdir vscode-luq\bin
    copy /Y target\x86_64-pc-windows-msvc\release\luq-lsp.exe vscode-luq\bin\luq-lsp.exe
    echo Success! LSP server updated.
) else if exist target\release\luq-lsp.exe (
    echo Copying from default target...
    copy /Y target\release\luq-lsp.exe vscode-luq\luq-lsp.exe
    if not exist vscode-luq\bin mkdir vscode-luq\bin
    copy /Y target\release\luq-lsp.exe vscode-luq\bin\luq-lsp.exe
    echo Success! LSP server updated.
) else (
    echo Error: Build failed!
    exit /b 1
)

echo.
echo Please restart VSCode or reload the window (Ctrl+Shift+P -> Developer: Reload Window)
pause