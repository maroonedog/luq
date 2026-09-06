# 新実装の設計（確定版）

**戦略**: Marker-Typed Descriptor Pipeline — one path grammar, one plugin contract, one collector, one compile step, one branch-free engine

**プラグイン数**: 71 / **実装ステップ**: 32 / **モジュール**: 96

| 文書 | 内容 |
|---|---|
| [core-types.md](core-types.md) | 中核型仕様。実コンパイル検証済み |
| [build-order.md](build-order.md) | 実装順序と各ステップの検証方法 |
| [modules.md](modules.md) | 全モジュールと単一責務・行数見積もり |
| [test-strategy.md](test-strategy.md) | テストの置き場所・型テスト方式・ツール |
| [how-any-is-avoided.md](how-any-is-avoided.md) | any を使わずに型を通す方法 |
| [verification.md](verification.md) | 解決したブロッカーと残るリスク |

引き継ぐ仕様は [../legacy-spec/](../legacy-spec/)、公開面は [../legacy-public-surface.md](../legacy-public-surface.md)。
