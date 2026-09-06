# VSCode拡張機能が読み込まれない問題の解決

## 問題の原因
VSCodeが古いバージョンの拡張機能をキャッシュしているか、VSIXパッケージ版がインストールされている可能性があります。

## 解決手順

### ステップ1: インストール済み拡張機能の確認と削除
```bash
# VSCodeで:
# 1. Ctrl+Shift+X で拡張機能パネルを開く
# 2. "Luq" を検索
# 3. もしインストールされていたらアンインストール
```

### ステップ2: VSCodeを完全に終了
```bash
# PowerShellで実行:
Get-Process | Where-Object {$_.ProcessName -like "*code*"} | Stop-Process -Force
```

### ステップ3: 拡張機能を再ビルド
```bash
cd /mnt/c/projects/luq/compiler/vscode-luq
npm run compile
```

### ステップ4: 開発モードで起動
```bash
# VSCodeで vscode-luq フォルダを開く
code .

# F5キーを押してデバッグ実行
# 新しいVSCodeウィンドウが開く
```

### ステップ5: 動作確認
新しいVSCodeウィンドウで:
1. `test-completion.luq` を開く
2. 出力パネルで「Luq」チャンネルを選択
3. 以下のメッセージが表示されることを確認:
   ```
   === Luq Extension (IMMEDIATE FIX) ===
   ```

4. `@` を入力して `Ctrl+Space` を押す
5. 出力に以下のようなログが表示されることを確認:
   ```
   [Completion] Start at X:Y
   [Completion] Success: 1 items in Xms
   ```

## もしまだ動作しない場合

### VSCodeキャッシュの完全クリア (Windows)
```powershell
# PowerShellを管理者として実行
Remove-Item -Path "$env:APPDATA\Code\Cache" -Recurse -Force
Remove-Item -Path "$env:APPDATA\Code\CachedData" -Recurse -Force
Remove-Item -Path "$env:APPDATA\Code\CachedExtensionVSIXs" -Recurse -Force
```

### 拡張機能の直接実行テスト
```bash
cd /mnt/c/projects/luq/compiler/vscode-luq
node out/extension_immediate_fix.js
# エラーが出ないことを確認
```

## 確認ポイント
- `package.json` の `main` が `"./out/extension_immediate_fix.js"` を指している ✓
- `out/extension_immediate_fix.js` が存在する ✓
- ファイル内に "IMMEDIATE FIX" の文字列が含まれている ✓
- Promise.race によるキャンセル処理が実装されている ✓