# Luq Language Support for VS Code

This extension provides language support for `.luq` validation definition files.

## Features

- 🎨 **Syntax Highlighting**: Full syntax highlighting for `.luq` files
- 🔧 **IntelliSense**: Auto-completion for decorators and types
- 📝 **Hover Information**: Documentation on hover for decorators
- ⚠️ **Diagnostics**: Real-time error and warning detection
- 🔍 **Go to Definition**: Navigate to type definitions

## Installation

### From VSIX Package

1. Download the `.vsix` file
2. In VS Code, open Command Palette (`Ctrl+Shift+P`)
3. Run "Extensions: Install from VSIX..."
4. Select the downloaded `.vsix` file

### From Source

```bash
cd vscode-luq
npm install
npm run compile
```

## Requirements

- The Luq Language Server (`luq-lsp`) must be installed and available in your PATH
- VS Code version 1.75.0 or higher

## Extension Settings

This extension contributes the following settings:

* `luq.server.path`: Path to the Luq language server executable (default: `luq-lsp`)
* `luq.trace.server`: Traces the communication between VS Code and the language server

## Usage

Simply open any `.luq` file in VS Code. The extension will automatically activate and provide language features.

### Example

```luq
@validator
interface User {
    @required @min(3) @max(50)
    name: string;
    
    @required @email
    email: string;
    
    @optional @min(18)
    age?: number;
}
```

## Development

To develop the extension:

1. Clone the repository
2. Run `npm install` in the extension directory
3. Open VS Code in the extension directory
4. Press `F5` to launch a new VS Code window with the extension loaded
5. Open a `.luq` file to test the extension

## Release Notes

### 0.1.0

- Initial release
- Basic syntax highlighting
- Decorator auto-completion
- LSP integration