# Debug Test Instructions - CRITICAL BUG

## Problem Summary
User reports that autocomplete behaves incorrectly:
1. **First attempt**: Shows ALL candidates (BUG - should only show decorators after @)
2. **Second attempt**: After deleting @ and typing @ again, shows only validateUser (CORRECT)
3. **Third attempt**: After deleting @ and typing @ again, shows "読込中です..." forever (CRITICAL BUG)

## Debug Version Deployed
Both debug LSP server and VSCode extension are now deployed with enhanced logging:
- **LSP Server**: `luq-lsp-debug.exe` with detailed decorator/keyword detection logging
- **VSCode Extension**: `extension_debug.js` with request tracking and 5-second timeout

## Test Steps

1. **Reload VSCode Window**
   ```
   Ctrl+Shift+P → "Developer: Reload Window"
   ```

2. **Open Debug Output**
   ```
   View → Output → Select "Luq Debug"
   ```

3. **Test the Bug**
   Open `test-imports/circular-a.luq`:
   - Go to line 9 after `@`
   - Press `Ctrl+Space` (First attempt - check if ALL candidates appear)
   - Delete `@`, type `@` again
   - Press `Ctrl+Space` (Second attempt - should show validateUser)
   - Delete `@`, type `@` again
   - Press `Ctrl+Space` (Third attempt - CRITICAL: shows "読込中です...")

## What to Look For

### In Debug Logs:
1. **Request IDs**: Are they incrementing? (e.g., #1, #2, #3)
2. **Decorator detection**: Look for "Decorator check - ends_with_@: true/false"
3. **Keyword detection**: Look for "Keyword check - should_add: true/false"
4. **Completion counts**: How many items are returned?
5. **Hanging requests**: Look for START without COMPLETE
6. **Timeout messages**: "REQUEST #X TIMED OUT"

### Critical Questions:
- Why does the first attempt show ALL candidates?
- Why does the third attempt hang forever?
- Are requests piling up? (check pending count)

## Expected Log Pattern (CORRECT):
```
LSP DEBUG: Completion #1 START at file:///path:8:5 (1 pending)
LSP DEBUG: #1 Decorator check - ends_with_@: true, trim_ends_with_@: true, starts_with_@_no_space: false
LSP DEBUG: #1 Adding decorator completions
LSP DEBUG: #1 Keyword check - should_add: false
LSP DEBUG: Completion #1 COMPLETE in 5ms with 6 items (0 pending)
```

## Problematic Pattern (BUG):
```
LSP DEBUG: Completion #3 START at file:///path:8:5 (1 pending)
[No COMPLETE message - request hangs]
REQUEST #3 TIMED OUT after 5000ms
```

## Please Test NOW and Share:
1. The complete "Luq Debug" output when reproducing the bug
2. Whether the pattern is consistent (always fails on 3rd attempt?)
3. Any error messages in VSCode Developer Tools (Help → Toggle Developer Tools → Console)