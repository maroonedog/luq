import * as vscode from 'vscode';
import * as path from 'path';
import { 
    LanguageClient, 
    LanguageClientOptions, 
    ServerOptions,
    TransportKind 
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
    // LSPサーバーの実行可能ファイルパス
    const serverCommand = vscode.workspace.getConfiguration('luq').get<string>('server.path') || 'luq-lsp';
    
    // サーバーオプション
    const serverOptions: ServerOptions = {
        run: {
            command: serverCommand,
            args: ['--stdio'],
            transport: TransportKind.stdio
        },
        debug: {
            command: serverCommand,
            args: ['--stdio', '--debug'],
            transport: TransportKind.stdio
        }
    };

    // クライアントオプション - .luqファイルに対して有効化
    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'luq' },
            { scheme: 'untitled', language: 'luq' }
        ],
        synchronize: {
            // .luqファイルの変更を監視
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.luq')
        }
    };

    // Language Clientを作成して起動
    client = new LanguageClient(
        'luq',
        'Luq Language Server',
        serverOptions,
        clientOptions
    );

    // クライアントを起動
    client.start();

    // 拡張機能のコンテキストに登録
    context.subscriptions.push(client);

    // ステータスバーに表示
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(check) Luq';
    statusBarItem.tooltip = 'Luq Language Server is running';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    console.log('Luq extension activated');
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}