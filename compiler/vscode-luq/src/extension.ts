import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

function getBinaryPath(context: vscode.ExtensionContext): string {
  const isWindows = process.platform === "win32";
  const binaryName = isWindows ? "luq-lsp.exe" : "luq-lsp";
  return path.join(context.extensionPath, "bin", binaryName);
}

export async function activate(context: vscode.ExtensionContext) {
  // Output channelを作成してデバッグ情報を出力
  const outputChannel = vscode.window.createOutputChannel("Luq");
  outputChannel.appendLine("=== Luq Extension Activation ===");
  outputChannel.appendLine(`Platform: ${process.platform}`);
  outputChannel.appendLine(`Extension Path: ${context.extensionPath}`);

  // First check if user has configured a custom path
  let serverCommand = vscode.workspace
    .getConfiguration("luq")
    .get<string>("server.path");

  // If no custom path or custom path doesn't exist, use the bundled binary
  if (!serverCommand || !fs.existsSync(serverCommand)) {
    serverCommand = getBinaryPath(context);

    // Check if the bundled binary exists
    if (!fs.existsSync(serverCommand)) {
      outputChannel.appendLine(
        `ERROR: LSP binary not found at: ${serverCommand}`
      );

      const selection = await vscode.window.showErrorMessage(
        `Luq LSP server not found at: ${path.basename(serverCommand)}. Please reinstall the extension or run 'npm install' in the extension directory.`,
        "Open Extension Directory",
        "Show Instructions",
        "Dismiss"
      );

      if (selection === "Open Extension Directory") {
        // Open the extension directory in VS Code
        const uri = vscode.Uri.file(context.extensionPath);
        await vscode.commands.executeCommand("vscode.openFolder", uri, {
          forceNewWindow: true,
        });
      } else if (selection === "Show Instructions") {
        const instructions = `
# Luq Language Server Installation

The Luq Language Server binary was not found. This should have been installed automatically.

## Quick Fix:
1. Open a terminal in the extension directory:
   ${context.extensionPath}

2. Run:
   npm install

3. Restart VS Code

## Manual Build (if automatic installation fails):
1. Install Rust: https://rustup.rs/
2. In the extension directory, run:
   npm run build-lsp
3. Restart VS Code

## Custom Path Configuration:
If you have the LSP binary in a different location, add to VS Code settings.json:
"luq.server.path": "/path/to/luq-lsp"
                `;

        const doc = await vscode.workspace.openTextDocument({
          content: instructions,
          language: "markdown",
        });
        await vscode.window.showTextDocument(doc);
      }
      return;
    }
  }

  outputChannel.appendLine(`Using LSP server: ${serverCommand}`);

  // サーバーオプション
  const serverOptions: ServerOptions = {
    run: {
      command: serverCommand,
      args: [],
      transport: TransportKind.stdio,
      options: {
        env: { ...process.env, RUST_BACKTRACE: "1" },
      },
    },
    debug: {
      command: serverCommand,
      args: [],
      transport: TransportKind.stdio,
      options: {
        env: { ...process.env, RUST_BACKTRACE: "1", RUST_LOG: "debug" },
      },
    },
  };

  // クライアントオプション - .luqファイルに対して有効化
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "luq" },
      { scheme: "untitled", language: "luq" },
    ],
    synchronize: {
      // .luqファイルの変更を監視
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.luq"),
    },
    outputChannel: outputChannel,
    traceOutputChannel: outputChannel,
    revealOutputChannelOn: 3, // Never reveal automatically
  };

  // Language Clientを作成して起動
  client = new LanguageClient(
    "luq",
    "Luq Language Server",
    serverOptions,
    clientOptions
  );

  // クライアントを起動
  try {
    await client.start();

    // ステータスバーに表示
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    statusBarItem.text = "$(check) Luq";
    statusBarItem.tooltip = "Luq Language Server is running";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    outputChannel.appendLine("Luq extension activated successfully!");
    vscode.window.showInformationMessage("Luq Language Support is now active");
  } catch (error) {
    outputChannel.appendLine(`Failed to start LSP: ${error}`);
    vscode.window.showErrorMessage(
      `Failed to start Luq Language Server: ${error}`
    );
  }

  // 拡張機能のコンテキストに登録
  context.subscriptions.push(client);
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
