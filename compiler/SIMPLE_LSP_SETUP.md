# シンプルなLuq LSPセットアップ

## 問題
`tower-lsp`の最新版はRust 1.82以上を要求するため、現在のRust 1.75では動作しません。

## 代替案

### 1. **簡易版: Node.js LSPサーバー**

TypeScript/JavaScriptでLSPサーバーを実装（Rustコンパイラを呼び出す）：

```bash
cd /mnt/c/projects/luq/compiler
mkdir luq-lsp-node
cd luq-lsp-node
npm init -y
npm install vscode-languageserver vscode-languageserver-textdocument
```

#### `luq-lsp-node/src/server.js`:
```javascript
const {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  CompletionItem,
  CompletionItemKind,
  TextDocumentSyncKind,
} = require('vscode-languageserver/node');

const { TextDocument } = require('vscode-languageserver-textdocument');
const { spawn } = require('child_process');

// Create connection
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize((params) => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['@']
      }
    }
  };
});

// デコレーター補完
connection.onCompletion(() => {
  return [
    {
      label: 'required',
      kind: CompletionItemKind.Keyword,
      detail: 'Mark field as required'
    },
    {
      label: 'min',
      kind: CompletionItemKind.Function,
      detail: 'Set minimum value',
      insertText: 'min($1)'
    },
    {
      label: 'email',
      kind: CompletionItemKind.Keyword,
      detail: 'Validate email format'
    }
  ];
});

// ドキュメント変更時にRustパーサーを呼ぶ
documents.onDidChangeContent(async (change) => {
  const text = change.document.getText();
  
  // Rustパーサーを呼び出し
  const luqc = spawn('luqc', ['parse', '-'], {
    shell: true
  });
  
  luqc.stdin.write(text);
  luqc.stdin.end();
  
  luqc.on('close', (code) => {
    if (code !== 0) {
      // エラーを診断として送信
      connection.sendDiagnostics({
        uri: change.document.uri,
        diagnostics: [{
          severity: 1, // Error
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 }
          },
          message: 'Parse error',
          source: 'luq'
        }]
      });
    } else {
      connection.sendDiagnostics({
        uri: change.document.uri,
        diagnostics: []
      });
    }
  });
});

documents.listen(connection);
connection.listen();
```

### 2. **VS Code拡張機能の修正**

`vscode-luq/src/extension.ts`を更新してNode.js版LSPを使用：

```typescript
const serverModule = context.asAbsolutePath(
  path.join('..', 'luq-lsp-node', 'src', 'server.js')
);

const serverOptions: ServerOptions = {
  run: { module: serverModule, transport: TransportKind.ipc },
  debug: {
    module: serverModule,
    transport: TransportKind.ipc,
    options: { execArgv: ['--nolazy', '--inspect=6009'] }
  }
};
```

## インストール手順

### 1. Node.js LSPサーバー
```bash
cd luq-lsp-node
npm install
node src/server.js --stdio  # テスト
```

### 2. VS Code拡張機能
```bash
cd vscode-luq
npm install
npm run compile
code --install-extension vscode-luq-0.1.0.vsix
```

### 3. 動作確認
1. VS Codeを再起動
2. `.luq`ファイルを開く
3. `@`を入力して補完が出ることを確認

## メリット

- **Rust 1.75対応**: tower-lspの依存関係問題を回避
- **シンプル**: Node.jsで実装するため依存関係が少ない
- **拡張しやすい**: JavaScriptで機能追加が容易

## デメリット

- **パフォーマンス**: Rustネイティブより遅い
- **プロセス起動**: パース時に毎回luqcプロセスを起動

## 将来的な改善

Rust 1.82にアップグレード後、本格的なRust LSPサーバーに移行可能。