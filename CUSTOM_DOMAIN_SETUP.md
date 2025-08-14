# GitHub Pages カスタムドメイン設定ガイド

## 概要

GitHub Pages で独自ドメインを使用するための完全ガイドです。

## 設定手順

### 1. DNS設定（ドメインプロバイダ側）

#### Apex ドメイン（example.com）の場合

DNSプロバイダの管理画面で以下の4つのAレコードを追加します：

```
タイプ: A
ホスト: @ (または空欄)
値: 185.199.108.153
```
```
タイプ: A
ホスト: @ (または空欄)
値: 185.199.109.153
```
```
タイプ: A
ホスト: @ (または空欄)
値: 185.199.110.153
```
```
タイプ: A
ホスト: @ (または空欄)
値: 185.199.111.153
```

#### サブドメイン（docs.example.com）の場合

CNAMEレコードを1つ追加します：

```
タイプ: CNAME
ホスト: docs (またはサブドメイン名)
値: [あなたのGitHubユーザー名].github.io
```

### 2. CNAMEファイルの作成

`docs-site/public/`ディレクトリにCNAMEファイルを作成：

```bash
# サブドメインの場合
echo "docs.example.com" > docs-site/public/CNAME

# Apexドメインの場合
echo "example.com" > docs-site/public/CNAME
```

**重要**: ファイル名は`CNAME`（拡張子なし）である必要があります。

### 3. Astro設定の更新

`docs-site/astro.config.mjs`を編集：

```javascript
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

export default defineConfig({
  // カスタムドメインを設定
  site: 'https://docs.example.com', // あなたのドメインに置き換え
  
  // GitHub Pages用の設定
  base: '/', // カスタムドメインの場合はルートパス
  
  integrations: [
    tailwind(),
    mdx(),
  ],
  
  output: 'static',
});
```

### 4. GitHub リポジトリの設定

1. GitHubでリポジトリを開く
2. **Settings** タブをクリック
3. 左サイドバーの **Pages** をクリック
4. **Custom domain** フィールドにドメインを入力
   - 例: `docs.example.com` または `example.com`
5. **Save** をクリック
6. DNS確認が完了したら **Enforce HTTPS** にチェック

### 5. デプロイワークフローの確認

`.github/workflows/deploy-docs.yml`が正しく設定されていることを確認：

```yaml
- name: Build documentation site
  working-directory: ./docs-site
  run: npm run build
  
# CNAMEファイルが public/ にあれば自動的に dist/ にコピーされます
```

### 6. デプロイの実行

```bash
# 変更をコミット
git add docs-site/public/CNAME
git add docs-site/astro.config.mjs
git commit -m "Add custom domain configuration"

# masterブランチにプッシュ（自動デプロイ）
git push origin master
```

## DNS伝播の確認

### 設定が正しいか確認

```bash
# Aレコードの確認（Apexドメイン）
dig example.com

# CNAMEレコードの確認（サブドメイン）
dig docs.example.com

# 別の方法
nslookup docs.example.com
```

### 期待される結果

**Apexドメインの場合**:
```
example.com.    300    IN    A    185.199.108.153
example.com.    300    IN    A    185.199.109.153
example.com.    300    IN    A    185.199.110.153
example.com.    300    IN    A    185.199.111.153
```

**サブドメインの場合**:
```
docs.example.com.    300    IN    CNAME    [username].github.io.
```

## SSL/HTTPS設定

### 自動SSL証明書

- GitHub Pagesは **Let's Encrypt** から自動的にSSL証明書を取得
- DNS設定が正しく伝播した後、自動的に有効化
- 証明書の取得には最大24時間かかる場合がある

### HTTPS強制の有効化

1. DNS設定が完了し、サイトがHTTPでアクセス可能になったら
2. **Settings → Pages** で **Enforce HTTPS** にチェック
3. すべてのHTTPトラフィックが自動的にHTTPSにリダイレクトされる

## トラブルシューティング

### よくある問題と解決方法

#### 1. 「DNS Check in Progress」が長時間続く

**原因**: DNS設定が正しくない、または伝播に時間がかかっている

**解決方法**:
- DNS設定を再確認
- TTL値を300秒などの短い値に設定
- 最大48時間待つ

#### 2. 404エラー

**原因**: CNAMEファイルが正しく配置されていない

**解決方法**:
```bash
# CNAMEファイルの存在確認
ls docs-site/public/CNAME

# ビルド後の確認
npm run build
ls docs-site/dist/CNAME
```

#### 3. SSL証明書エラー

**原因**: 証明書がまだ発行されていない

**解決方法**:
1. **Enforce HTTPS** を一時的に無効化
2. HTTPでサイトにアクセスできることを確認
3. 再度 **Enforce HTTPS** を有効化
4. 24時間待つ

#### 4. リダイレクトループ

**原因**: Cloudflareなどの CDN/Proxy サービスとの競合

**解決方法**:
- CDNのSSL設定を「Flexible」または「Full」に設定
- CloudflareのProxy機能を一時的に無効化（DNSのみモード）

### DNSプロバイダ別の設定例

#### Cloudflare

1. DNSタブを開く
2. **Proxy status** をオフ（DNSのみ）に設定
3. CNAMEまたはAレコードを追加
4. TTLを「Auto」に設定

#### Google Domains

1. DNS設定を開く
2. **カスタムレコード**セクションで追加
3. タイプとデータを入力
4. TTLは300に設定

#### お名前.com

1. DNS設定/転送設定を開く
2. DNSレコード設定を選択
3. レコードを追加
4. 確認画面で設定を保存

## 設定完了後の確認

### チェックリスト

- [ ] DNSレコードが正しく設定されている
- [ ] CNAMEファイルが `docs-site/public/` に存在
- [ ] `astro.config.mjs` の `site` が正しく設定されている
- [ ] GitHub Pages の Custom domain が設定されている
- [ ] HTTPでサイトにアクセスできる
- [ ] Enforce HTTPS が有効化されている
- [ ] HTTPSでサイトにアクセスできる
- [ ] 旧URLから新URLへのリダイレクトが機能している

### 最終確認コマンド

```bash
# ビルドとローカル確認
cd docs-site
npm run build
npm run preview

# デプロイ
git push origin master

# DNS確認
dig +short docs.example.com

# HTTPS確認
curl -I https://docs.example.com
```

## 参考リンク

- [GitHub Pages公式ドキュメント - カスタムドメイン](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [GitHub Pages - DNSレコードの設定](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Let's Encrypt](https://letsencrypt.org/)
- [DNS伝播チェッカー](https://www.whatsmydns.net/)

## サポート

問題が解決しない場合は、以下の情報を含めてIssueを作成してください：

1. 使用しているドメイン名（機密情報は隠す）
2. DNSプロバイダ名
3. `dig` コマンドの出力
4. GitHub Pages設定のスクリーンショット
5. エラーメッセージの詳細