# 旧実装から引き継ぐ仕様（抽出結果）

旧 `src/` を削除する前に、14領域から抽出した「引き継ぐべき仕様」を記録したもの。
実装時はこのディレクトリと [legacy-public-surface.md](../legacy-public-surface.md) を一次資料とする。
旧実装そのものは `git show master:src/<path>` で参照できる。

| 領域 | must-preserve | 公開シンボル | 振る舞い規則 | 捨てるもの |
|---|---|---|---|---|
| [build-and-distribution](build-and-distribution.md) | 64 | 83 | 19 | 20 |
| [execution-model](execution-model.md) | 17 | 49 | 16 | 18 |
| [test-intent-integration](test-intent-integration.md) | 15 | 139 | 27 | 15 |
| [plugin-contract](plugin-contract.md) | 18 | 172 | 18 | 22 |
| [result-and-errors](result-and-errors.md) | 13 | 61 | 18 | 20 |
| [documented-promises](documented-promises.md) | 15 | 216 | 13 | 14 |
| [field-path-semantics](field-path-semantics.md) | 9 | 13 | 14 | 14 |
| [json-schema-mapping](json-schema-mapping.md) | 9 | 75 | 54 | 13 |
| [plugin-catalog-structural](plugin-catalog-structural.md) | 11 | 84 | 14 | 15 |
| [plugin-catalog-core](plugin-catalog-core.md) | 35 | 136 | 15 | 20 |
| [plugin-catalog-relational](plugin-catalog-relational.md) | 12 | 111 | 18 | 17 |
| [public-api-surface](public-api-surface.md) | 15 | 216 | 20 | 29 |
| [anti-patterns](anti-patterns.md) | 7 | 67 | 40 | 20 |
| [test-intent-unit](test-intent-unit.md) | 29 | 170 | 28 | 10 |

**合計 must-preserve 契約: 269件**
