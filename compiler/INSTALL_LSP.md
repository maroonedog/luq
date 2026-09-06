# Luq LSP Installation Guide

## Files Installed

1. **LSP Server**: `luq-lsp.exe` (7.3MB)
   - Location: `/mnt/c/projects/luq/compiler/luq-lsp.exe`
   - Provides language server functionality for Luq files

2. **VSCode Extension**: `vscode-luq/`
   - LSP binary copied to: `vscode-luq/bin/luq-lsp.exe`
   - Provides syntax highlighting and language features

## Features

### Autocomplete
- **Decorators**: Triggers on `@`
  - `@required`, `@optional`, `@validator`
  - `@min(n)`, `@max(n)`, `@pattern(/regex/)`
  - `@email`, `@array`, `@minLength`, `@maxLength`

- **Types**: Triggers on `:` 
  - `string`, `number`, `boolean`
  - `void`, `any`, `unknown`, `never`

- **Keywords**: On empty line or after space
  - `interface`, `export`, `import`, `function`
  - Includes snippets for quick insertion

### Hover Information
- Hover over keywords for documentation
- Hover over decorators for usage information

### Diagnostics
- Real-time syntax error detection
- Error messages in Problems panel

## VSCode Setup

1. Open VSCode in the extension directory:
   ```bash
   cd vscode-luq
   code .
   ```

2. Press `F5` to launch Extension Development Host

3. Open a `.luq` file to test:
   - Try typing `@` for decorator completions
   - Try typing `:` after a field name for type completions
   - Hover over keywords for documentation

## Testing

Test file provided: `test_lsp_simple.luq`

Try these actions:
1. Type `@` on line 10 - should show decorator completions
2. Add a new field and type `:` - should show type completions
3. Introduce a syntax error - should show in Problems panel

## Configuration

In VSCode settings.json:
```json
{
  "luq.server.path": "path/to/luq-lsp.exe",
  "luq.trace.server": "verbose"  // for debugging
}
```

## Troubleshooting

If LSP doesn't start:
1. Check Output panel → "Luq" channel for errors
2. Verify `luq-lsp.exe` exists in `vscode-luq/bin/`
3. Restart VSCode

## Build from Source

```bash
# Build LSP
cargo build --release --target x86_64-pc-windows-gnu --bin luq-lsp

# Copy to extension
cp target/x86_64-pc-windows-gnu/release/luq-lsp.exe vscode-luq/bin/
```