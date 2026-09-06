@echo off
echo ========================================
echo Luq LSP Test (Windows)
echo ========================================
echo.

set LSP_PATH=C:\projects\luq\compiler\target\release\luq-lsp.exe

echo Checking if LSP executable exists...
if exist "%LSP_PATH%" (
    echo [OK] Found: %LSP_PATH%
    
    echo.
    echo File information:
    for %%I in ("%LSP_PATH%") do echo   Size: %%~zI bytes
    for %%I in ("%LSP_PATH%") do echo   Modified: %%~tI
    
    echo.
    echo Testing LSP startup...
    echo (Press Ctrl+C to stop)
    echo.
    
    REM Start LSP and show output
    "%LSP_PATH%"
) else (
    echo [ERROR] LSP executable not found at: %LSP_PATH%
    echo.
    echo Please run install-windows.sh from WSL first:
    echo   $ cd /mnt/c/projects/luq/compiler
    echo   $ ./install-windows.sh
)

echo.
pause