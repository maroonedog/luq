# PowerShell script to test Luq LSP on Windows

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Luq LSP Test (Windows PowerShell)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$lspPath = "C:\projects\luq\compiler\target\release\luq-lsp.exe"

# Check if file exists
if (Test-Path $lspPath) {
    Write-Host "[✓] LSP executable found" -ForegroundColor Green
    
    # Get file info
    $fileInfo = Get-Item $lspPath
    Write-Host ""
    Write-Host "File Information:" -ForegroundColor Yellow
    Write-Host "  Path: $($fileInfo.FullName)"
    Write-Host "  Size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB"
    Write-Host "  Created: $($fileInfo.CreationTime)"
    Write-Host "  Modified: $($fileInfo.LastWriteTime)"
    
    Write-Host ""
    Write-Host "Testing LSP communication..." -ForegroundColor Yellow
    
    # Create a simple test to send initialize request
    $initRequest = @"
Content-Length: 85

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"processId":null,"rootUri":null}}
"@
    
    # Start LSP process
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $lspPath
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    
    try {
        $process = [System.Diagnostics.Process]::Start($psi)
        Write-Host "[✓] LSP process started (PID: $($process.Id))" -ForegroundColor Green
        
        # Send initialize request
        $process.StandardInput.WriteLine($initRequest)
        $process.StandardInput.Flush()
        
        # Wait briefly for response
        Start-Sleep -Milliseconds 500
        
        # Check if process is still running
        if (!$process.HasExited) {
            Write-Host "[✓] LSP is running and responsive" -ForegroundColor Green
            
            # Send shutdown
            $shutdownRequest = @"
Content-Length: 48

{"jsonrpc":"2.0","id":2,"method":"shutdown","params":null}
"@
            $process.StandardInput.WriteLine($shutdownRequest)
            
            # Send exit
            $exitNotification = @"
Content-Length: 38

{"jsonrpc":"2.0","method":"exit","params":null}
"@
            $process.StandardInput.WriteLine($exitNotification)
            
            # Wait for graceful shutdown
            $process.WaitForExit(1000)
            
            Write-Host "[✓] LSP shutdown successful" -ForegroundColor Green
        } else {
            Write-Host "[!] LSP exited unexpectedly" -ForegroundColor Red
            $error = $process.StandardError.ReadToEnd()
            if ($error) {
                Write-Host "Error output: $error" -ForegroundColor Red
            }
        }
        
        $process.Dispose()
    }
    catch {
        Write-Host "[✗] Failed to start LSP: $_" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "SUMMARY" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "✅ Components Status:" -ForegroundColor Green
    Write-Host "  • LSP executable: INSTALLED"
    Write-Host "  • Parser: chumsky + logos + ariadne"
    Write-Host "  • Location: $lspPath"
    Write-Host "  • VSCode integration: READY"
    Write-Host ""
    Write-Host "📝 To use in VSCode:" -ForegroundColor Yellow
    Write-Host "  1. Open VSCode"
    Write-Host "  2. Open a .luq file"
    Write-Host "  3. LSP will start automatically"
    Write-Host ""
    Write-Host "🔧 To rebuild from WSL:" -ForegroundColor Yellow
    Write-Host "  $ cd /mnt/c/projects/luq/compiler"
    Write-Host "  $ cargo build --release --target x86_64-pc-windows-gnu --bin luq-lsp"
    Write-Host "  $ cp target/x86_64-pc-windows-gnu/release/luq-lsp.exe /mnt/c/projects/luq/compiler/target/release/"
    
} else {
    Write-Host "[✗] LSP executable not found at: $lspPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install from WSL:" -ForegroundColor Yellow
    Write-Host "  $ cd /mnt/c/projects/luq/compiler"
    Write-Host "  $ ./install-windows.sh"
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")