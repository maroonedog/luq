# Luq LSP サーバーのインストールと設定方法

## 仕組みの概要

```mermaid
graph LR
    A[.luqファイル] --> B[VS Code]
    B --> C[Luq Extension]
    C --> D[Language Client]
    D <--> E[LSP Server<br/>luq-lsp]
    E --> F[パース・検証]
    F --> G[診断・補完・ホバー]
    G --> D
```

1. **ファイル拡張子の関連付け**: VS Code拡張機能が`.luq`ファイルを認識
2. **Language Client起動**: 拡張機能がLSPクライアントを起動
3. **LSPサーバー起動**: クライアントが`luq-lsp`実行ファイルを起動
4. **通信確立**: stdio経由でJSON-RPCプロトコルで通信

## インストール手順

### 1. LSPサーバーのビルドとインストール

```bash
# Rustプロジェクトでビルド
cd /mnt/c/projects/luq/compiler
cargo build --release --bin luq-lsp

# システムパスに配置（Linux/Mac）
sudo cp target/release/luq-lsp /usr/local/bin/

# または、Cargoでインストール
cargo install --path . --bin luq-lsp

# Windows
# target\release\luq-lsp.exe を PATH に追加
```

### 2. VS Code拡張機能のインストール

#### 開発環境での手動インストール

```bash
# 拡張機能ディレクトリへ移動
cd vscode-luq

# 依存関係をインストール
npm install

# TypeScriptをコンパイル
npm run compile

# VS Codeの拡張機能ディレクトリにシンボリックリンク作成
# Linux/Mac
ln -s $(pwd) ~/.vscode/extensions/vscode-luq

# Windows
mklink /D "%USERPROFILE%\.vscode\extensions\vscode-luq" "%CD%"
```

#### VSIXパッケージとしてインストール

```bash
# vsce（VS Code Extension manager）をインストール
npm install -g @vscode/vsce

# VSIXパッケージを作成
cd vscode-luq
vsce package

# 生成された.vsixファイルをVS Codeでインストール
# VS Code内で: Ctrl+Shift+P → "Extensions: Install from VSIX..."
```

### 3. 設定の確認

VS Codeの設定（settings.json）:

```json
{
  "luq.server.path": "luq-lsp",  // または絶対パス
  "luq.trace.server": "messages"  // デバッグ時
}
```

## 動作確認

1. VS Codeを再起動
2. `.luq`ファイルを開く
3. 右下のステータスバーに「✓ Luq」が表示されることを確認
4. `@`を入力して補完候補が表示されることを確認

## トラブルシューティング

### LSPサーバーが起動しない

```bash
# LSPサーバーが実行可能か確認
which luq-lsp  # Linux/Mac
where luq-lsp  # Windows

# 手動でテスト
echo '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{}}' | luq-lsp --stdio
```

### 拡張機能が認識されない

1. VS Code開発者ツールを開く（Ctrl+Shift+I）
2. Consoleタブでエラーを確認
3. 出力パネルで「Luq」チャンネルを確認

### ログの確認

```json
// settings.json
{
  "luq.trace.server": "verbose"
}
```

出力パネル → 「Luq」チャンネルでログを確認

## 他のエディタでの利用

### Neovim

```lua
-- init.lua
local lspconfig = require('lspconfig')

-- Luq LSP設定
lspconfig.luq_lsp = {
  default_config = {
    cmd = { 'luq-lsp', '--stdio' },
    filetypes = { 'luq' },
    root_dir = lspconfig.util.root_pattern('.git', 'package.json'),
    settings = {},
  },
}

lspconfig.luq_lsp.setup{}

-- ファイルタイプの関連付け
vim.filetype.add({
  extension = {
    luq = 'luq',
  },
})
```

### Sublime Text

```json
// LSP.sublime-settings
{
  "clients": {
    "luq": {
      "enabled": true,
      "command": ["luq-lsp", "--stdio"],
      "selector": "source.luq"
    }
  }
}
```

## 開発者向け：LSPサーバーのデバッグ

```bash
# デバッグモードで起動
RUST_LOG=debug luq-lsp --stdio

# ログファイルに出力
luq-lsp --stdio 2> lsp-debug.log
```

## まとめ

1. **LSPサーバー**: Rustでビルドして`PATH`に配置
2. **VS Code拡張機能**: npmでビルドしてインストール
3. **ファイル関連付け**: 拡張機能が`.luq`を自動認識
4. **通信**: stdio経由でLSPプロトコル

これにより、`.luq`ファイルを開くと自動的にLSPサーバーが起動し、補完・診断・ホバー情報などの機能が利用可能になります。