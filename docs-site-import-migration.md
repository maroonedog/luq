# Docs Site Import Migration Progress

## 新しいインポート構造
- メインパッケージ: `@maroonedog/luq`
- コア機能: `@maroonedog/luq/core` (Builder等)
- プラグイン: `@maroonedog/luq/plugin` (全バリデーションプラグイン)
- レジストリ: `@maroonedog/luq/core/registry` (createPluginRegistry等)

## 修正対象ファイル

### 🔍 CSSクラス名のみ (修正不要) (8 files)
- [x] `/docs-site/src/components/CodeExample.astro` - luq-card等のCSSクラスのみ
- [x] `/docs-site/src/components/Hero.astro` - CSS クラスのみ  
- [x] `/docs-site/src/components/PracticalExamples.astro` - CSS クラスのみ
- [x] `/docs-site/src/components/roadmap/WhyProgressive.astro` - CSS クラスのみ
- [x] `/docs-site/src/pages/docs/examples.astro` - CSS クラスのみ
- [x] `/docs-site/src/pages/plugins/index.astro` - CSS クラスのみ  
- [x] `/docs-site/src/pages/roadmap.astro` - CSS クラスのみ
- [x] `/docs-site/src/styles/global.css` - CSS クラスのみ

### ✅ 修正完了 (9 files)
- [x] `/docs-site/src/components/SimplifiedFeatures.astro` - プラグインインポート修正
- [x] `/docs-site/src/data/core-concepts-code-examples.ts` - プラグイン、プラグイン作成機能修正
- [x] `/docs-site/src/pages/docs/api/builder.astro` - Builder、プラグイン、レジストリ修正
- [x] `/docs-site/src/pages/docs/api/plugin-registry.astro` - レジストリ、プラグイン修正
- [x] `/docs-site/src/pages/docs/api/validator.astro` - Builder、プラグイン修正
- [x] `/docs-site/src/pages/docs/core-concepts.astro` - Builder、プラグイン修正  
- [x] `/docs-site/src/pages/docs/custom-plugins.astro` - プラグイン作成機能修正
- [x] `/docs-site/src/pages/docs/getting-started.astro` - Builder、プラグイン修正
- [x] `/docs-site/src/pages/docs/troubleshooting.astro` - プラグイン修正

## 修正パターン

### 1. Builder等のコア機能
```typescript
// 旧
import { Builder } from '@maroonedog/luq';

// 新
import { Builder } from '@maroonedog/luq/core';
```

### 2. プラグイン (基本)
```typescript
// 旧
import { stringMinPlugin, requiredPlugin } from '@maroonedog/luq';

// 新
import { stringMinPlugin, requiredPlugin } from '@maroonedog/luq/plugin';
```

### 3. プラグイン (旧pluginsパス)
```typescript
// 旧
import { requiredPlugin, stringMinPlugin } from '@maroonedog/luq/plugins';

// 新
import { requiredPlugin, stringMinPlugin } from '@maroonedog/luq/plugin';
```

### 4. プラグイン作成機能
```typescript
// 旧
import { plugin } from '@maroonedog/luq/plugin-creator';
import { pluginPredefinedTransform } from '@maroonedog/luq/plugin-creator';
import { pluginConfigurableTransform } from '@maroonedog/luq/plugin-creator';

// 新
import { plugin, pluginPredefinedTransform, pluginConfigurableTransform } from '@maroonedog/luq/core';
```

### 5. レジストリ機能
```typescript
// 旧
import { createPluginRegistry } from '@maroonedog/luq';

// 新
import { createPluginRegistry } from '@maroonedog/luq/core/registry';
```

### 6. 複合インポート
```typescript
// 旧
import { Builder, plugin } from '@maroonedog/luq';

// 新
import { Builder, plugin } from '@maroonedog/luq/core';
```

### 7. 実験的機能 (変更なし)
```typescript
// そのまま維持
import { createAsyncContext, addAsyncSupport } from '@maroonedog/luq/async.experimental';
```

## 修正完了サマリー

✅ **全17ファイル調査・修正完了**

### 修正内容統計
- **CSSクラス名のみ**: 8ファイル (修正不要)
- **JavaScriptインポート修正**: 9ファイル

### 主な修正内容
1. **Builder**: `@maroonedog/luq` → `@maroonedog/luq/core`
2. **プラグイン**: `@maroonedog/luq` または `/plugins` → `@maroonedog/luq/plugin`  
3. **プラグイン作成**: `/plugin-creator` → `@maroonedog/luq/core`
4. **レジストリ**: `@maroonedog/luq` → `@maroonedog/luq/core/registry`
5. **実験的機能**: 変更なし

### 新しいインポート構造の利点
- **Tree-shaking最適化**: 必要な機能のみをインポート
- **明確な役割分離**: core/plugin/registryで機能が明確
- **段階的導入**: 部分的にインポートして軽量利用が可能