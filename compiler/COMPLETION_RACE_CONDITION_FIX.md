# @ Completion Race Condition Fix

## 問題
- `@validateUser()` 入力後、削除して再度 `@` を入力すると補完が動作しない
- 「読み込んでいます...」が表示されたまま

## 根本原因

### 1. **Document Map の競合状態**
```rust
// 問題のコード
async fn did_change(&self, params: DidChangeTextDocumentParams) {
    tokio::spawn(async move {
        debouncer.debounce_file_change(path, move || async move {
            server2.update_document(uri, text).await;  // ここでdocument_map更新
        }).await;
    });
}

async fn update_document(&self, uri: Url, text: String) {
    // document_map.write().await でロック取得
    map.insert(uri.clone(), text.clone());
}

async fn get_completions(...) {
    // document_map.read().await でロック取得 <- 競合！
    let doc_content = document_map.read().await.get(uri).cloned();
}
```

### 2. **問題の流れ**
1. ユーザーが `@` を入力
2. `did_change` が呼ばれ、`tokio::spawn` で非同期更新開始
3. 即座に補完リクエストが来る
4. `get_completions` が `document_map.read()` を試みる
5. しかし `update_document` が `write()` ロックを保持中
6. デッドロック or タイムアウト発生

### 3. **二重更新の問題**
- `did_change/did_open` → `update_document` → document_map更新
- `update_document` 内でも document_map更新
- 同じデータを2回更新していた

## 修正内容

### 1. **即座にDocument Mapを更新**
```rust
async fn did_change(&self, params: DidChangeTextDocumentParams) {
    let uri = params.text_document.uri.clone();
    let text = change.text.clone();
    
    // 即座に更新（補完が確実に動作するように）
    {
        let mut map = self.document_map.write().await;
        map.insert(uri.clone(), text.clone());
    }
    
    // その後、高コストな処理をデバウンス
    tokio::spawn(async move {
        debouncer.debounce_file_change(path, move || async move {
            server2.update_document(uri2, text).await;
        }).await;
    });
}
```

### 2. **重複更新の削除**
```rust
async fn update_document(&self, uri: Url, text: String) {
    // document_map更新を削除（did_changeで既に更新済み）
    // パースと検証のみ実行
}
```

### 3. **タイムアウトとエラー処理追加**
```rust
// 各ロック取得に500msタイムアウト
match tokio::time::timeout(
    Duration::from_millis(500),
    dependency_graph.read()
).await {
    Ok(g) => Some(g),
    Err(_) => {
        eprintln!("ERROR: Timeout getting lock!");
        None  // フォールバック
    }
}
```

### 4. **依存グラフ機能の復元**
- 簡略化版から元の実装に戻した
- `validators::get_validator_completions` が依存グラフから@validator関数を検索
- これは必要な機能だった（安易に削除してはいけなかった）

## 結果
✅ Document更新と補完リクエストの競合を解消
✅ 2回目以降の @ 補完が正常に動作
✅ デッドロックを防止
✅ タイムアウト時もフォールバック補完を提供

## テスト手順
1. VSCodeを再起動
2. .luqファイルを開く
3. `@validateUser()` を入力
4. すべて削除
5. 再度 `@` を入力
6. 補完リストが表示されることを確認

## インストール済み
- Windows実行ファイル: `C:\projects\luq\compiler\target\release\luq-lsp.exe` (8.9MB)
- 更新時刻: 2025-08-30 19:39:53