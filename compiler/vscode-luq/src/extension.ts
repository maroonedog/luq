import * as path from 'path';
import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Luq Language Server');
    outputChannel.appendLine('Activating Luq extension...');

    // Get the LSP executable path
    const config = vscode.workspace.getConfiguration('luq');
    let serverPath = config.get<string>('server.path');
    
    if (!serverPath || serverPath === 'luq-lsp') {
        // Default to the bundled LSP server
        serverPath = context.asAbsolutePath(path.join('bin', 'luq-lsp.exe'));
    }

    outputChannel.appendLine(`LSP server path: ${serverPath}`);

    // Server options
    const serverOptions: ServerOptions = {
        run: {
            command: serverPath,
            transport: TransportKind.stdio
        },
        debug: {
            command: serverPath,
            transport: TransportKind.stdio,
            options: {
                env: {
                    ...process.env,
                    RUST_LOG: 'debug'
                }
            }
        }
    };

    // Client options
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'luq' }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.luq')
        },
        outputChannel: outputChannel,
        traceOutputChannel: outputChannel
    };

    // Create and start the language client
    client = new LanguageClient(
        'luq',
        'Luq Language Server',
        serverOptions,
        clientOptions
    );

    outputChannel.appendLine('Starting language client...');
    
    try {
        await client.start();
        outputChannel.appendLine('Language client started successfully');
        
        // Show a message to confirm activation
        vscode.window.showInformationMessage('Luq Language Server is running');
    } catch (error) {
        outputChannel.appendLine(`Failed to start language client: ${error}`);
        vscode.window.showErrorMessage(`Failed to start Luq Language Server: ${error}`);
    }
}

export async function deactivate() {
    if (client) {
        await client.stop();
    }
}