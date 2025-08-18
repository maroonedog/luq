# Testing the Luq VS Code Extension

## Quick Test

1. Open VS Code in the extension directory:
```bash
cd /mnt/c/projects/luq/compiler/vscode-luq
code .
```

2. Press `F5` to launch a new VS Code window with the extension loaded

3. In the new window, open the test file:
```bash
code /mnt/c/projects/luq/compiler/test.luq
```

4. Test features:
   - Syntax highlighting should work
   - Type `@` and see if completion appears
   - Hover over decorators for documentation

## Installation for regular use

```bash
# Package the extension
npm install -g @vscode/vsce
vsce package

# Install the generated .vsix file
code --install-extension vscode-luq-0.1.0.vsix
```

## Verify LSP is working

In VS Code Output panel, select "Luq" channel to see LSP messages.