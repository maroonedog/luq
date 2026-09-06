# 🚨 デッドロック問題の原因判明

## 根本原因
**インストール済みの古い拡張機能が使用されています！**
```
/root/.vscode-server/extensions/maroonedog.vscode-luq-0.1.0
```

## デッドロックの仕組み
1. 高速にリクエスト#3-10を送信
2. 即座に#3-9をキャンセル
3. キャンセル済みレスポンスが到着
4. Promiseが未解決のまま残る
5. 新しいリクエストが古いPromiseを待つ → **デッドロック**

## 解決方法
```bash
# インストール済み拡張機能を削除
rm -rf ~/.vscode-server/extensions/maroonedog.vscode-luq-*

# F5でデバッグ実行
cd vscode-luq && code .
```
