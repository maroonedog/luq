@echo off
REM Build script for Luq LSP server on Windows

echo Building Luq LSP server...
echo.

REM Check if Rust is installed
where cargo >nul 2>nul
if not %errorlevel%==0 (
    echo Error: Cargo not found. Please install Rust from https://rustup.rs/
    exit /b 1
)

REM Set build target directory for Windows
set CARGO_TARGET_DIR=target

REM Clean previous builds (optional)
REM cargo clean

REM Build the LSP server in release mode
echo Building LSP server in release mode...
cargo build --release --bin luq-lsp

if not %errorlevel%==0 (
    echo.
    echo Build failed! Trying debug mode...
    cargo build --bin luq-lsp
    
    if not %errorlevel%==0 (
        echo.
        echo Error: Failed to build LSP server.
        echo Please check the error messages above.
        exit /b 1
    )
    
    echo.
    echo Debug build successful!
    echo LSP server location: %cd%\target\debug\luq-lsp.exe
    
    REM Copy to expected location
    copy /Y target\debug\luq-lsp.exe luq-lsp.exe >nul 2>nul
) else (
    echo.
    echo Release build successful!
    echo LSP server location: %cd%\target\release\luq-lsp.exe
    
    REM Copy to expected location
    copy /Y target\release\luq-lsp.exe luq-lsp.exe >nul 2>nul
)

REM Also try to copy to the VSCode extension directory if it exists
if exist "vscode-luq\" (
    echo.
    echo Copying LSP server to VSCode extension...
    
    REM Create bin directory if it doesn't exist
    if not exist "vscode-luq\bin\" mkdir vscode-luq\bin
    
    if exist "target\release\luq-lsp.exe" (
        copy /Y target\release\luq-lsp.exe vscode-luq\bin\luq-lsp.exe >nul 2>nul
        if %errorlevel%==0 (
            echo LSP server copied to vscode-luq\bin\luq-lsp.exe
        )
        REM Also copy to root for backwards compatibility
        copy /Y target\release\luq-lsp.exe vscode-luq\luq-lsp.exe >nul 2>nul
    ) else (
        if exist "target\debug\luq-lsp.exe" (
            copy /Y target\debug\luq-lsp.exe vscode-luq\bin\luq-lsp.exe >nul 2>nul
            if %errorlevel%==0 (
                echo LSP server copied to vscode-luq\bin\luq-lsp.exe
            )
            REM Also copy to root for backwards compatibility
            copy /Y target\debug\luq-lsp.exe vscode-luq\luq-lsp.exe >nul 2>nul
        )
    )
)

echo.
echo Build complete!
echo.
echo Next steps:
echo 1. If using VSCode, reload the window (Ctrl+Shift+P, then "Developer: Reload Window")
echo 2. The Luq extension should now be able to find the LSP server
echo.

REM Check if the executable exists and show its location
if exist "luq-lsp.exe" (
    echo LSP executable found at: %cd%\luq-lsp.exe
) else (
    if exist "target\release\luq-lsp.exe" (
        echo LSP executable found at: %cd%\target\release\luq-lsp.exe
    ) else (
        if exist "target\debug\luq-lsp.exe" (
            echo LSP executable found at: %cd%\target\debug\luq-lsp.exe
        ) else (
            echo Warning: Could not locate the built LSP executable
        )
    )
)

pause