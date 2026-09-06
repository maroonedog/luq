# Debug Version Test Instructions

## Setup
The debug versions of both the LSP server and VSCode extension have been deployed with extensive logging to diagnose the completion hanging issue.

## Files Changed
1. **LSP Server Debug**: `src/lsp_debug.rs` → `bin/luq-lsp-debug.exe`
   - Request ID tracking
   - Timing measurements for each operation
   - Pending request monitoring
   - Detailed logging at each step

2. **VSCode Extension Debug**: `src/extension_debug.ts` → `out/extension_debug.js`
   - Completion request tracking
   - 5-second timeout mechanism
   - Pending request monitoring
   - Detailed middleware logging

## How to Test

1. **Reload VSCode Window**
   - Press `Ctrl+Shift+P` → "Developer: Reload Window"
   - This will load the debug extension

2. **Open Output Channel**
   - View → Output → Select "Luq Debug" from dropdown
   - Keep this visible while testing

3. **Open Test File**
   ```bash
   code test-imports/circular-a.luq
   ```

4. **Trigger Completion**
   - Go to line 9 after the `@` symbol
   - Press `Ctrl+Space` to trigger completion
   - Try multiple times rapidly to reproduce the hanging issue

## What to Look For in Logs

### LSP Server Logs (Luq Debug output):
```
LSP DEBUG: Completion #1 START at file:///path:8:5 (1 pending)
LSP DEBUG: #1 Document fetch took 0.5ms (1 docs in cache)
LSP DEBUG: #1 Before cursor: '@'
LSP DEBUG: #1 Adding decorator completions
LSP DEBUG: Completion #1 COMPLETE in 2ms with 3 items (0 pending)
```

### VSCode Extension Logs:
```
=== COMPLETION REQUEST #1 ===
Time: 2025-08-31T12:00:00.000Z
Document: file:///path/circular-a.luq
Position: 8:5
Text before cursor: "@"
REQUEST #1 COMPLETED in 15ms
  Result: 3 completions
```

## Key Indicators of the Problem

1. **Hanging Requests**: Look for requests that START but never COMPLETE
2. **Timeout Messages**: "REQUEST #X TIMED OUT" indicates VSCode gave up waiting
3. **Pending Count**: If pending count keeps increasing, requests are piling up
4. **Slow Warnings**: Messages about requests taking >1000ms

## Diagnosis Guide

### If requests complete in LSP but not in VSCode:
- Issue is in the VSCode extension or communication layer
- Check for "REQUEST #X TIMED OUT" messages

### If LSP shows incomplete requests:
- Issue is in the Rust LSP server
- Look for missing "COMPLETE" messages for request IDs
- Check if pending count stays > 0

### If both show completion but UI still shows "読込中です...":
- Issue might be in VSCode's completion UI rendering
- Check the completion response format

## Commands to Check Status

In VSCode command palette (`Ctrl+Shift+P`):
- "Luq: Show Debug Output" - Shows current pending requests

## Reporting Results

Please share:
1. The full output from "Luq Debug" channel when the issue occurs
2. Whether the issue happens immediately or after multiple attempts
3. The pattern of request IDs (do they increment normally?)
4. Any timeout or error messages

This will help identify whether the issue is in:
- The Rust LSP server (request processing/response)
- The VSCode extension (request handling/timeout)
- The communication layer (message passing)