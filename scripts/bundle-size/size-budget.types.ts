/**
 * config/size-budget.json の語彙。型のみ。
 *
 * 予算は「実測値 + 余裕」であって目標値ではない。実測の取り方 (どの入口を
 * どのオプションで束ねたか) は config 側の method に散文で書き、ここでは
 * ゲートが読む数値だけを型にする。
 */

/** "all" はカタログの全エントリ。配列は公開サブパス名 (camelCase) の列。 */
export type PluginSelection = readonly string[] | "all";

export interface BundleBudget {
  /** 予算の識別子。例 "core-only" */
  readonly id: string;
  /** 何を測っているかの散文。レポートにそのまま出る。 */
  readonly description: string;
  readonly plugins: PluginSelection;
  /** これを超えたらゲートが落ちる。 */
  readonly gzipCeilingBytes: number;
  /** 天井を決めたときの実測値。根拠であって判定には使わない。 */
  readonly recordedGzipBytes: number;
  /** 旧実装の対応する数値 (docs/legacy-spec/build-and-distribution.md)。 */
  readonly legacyGzipBytes?: number;
}

export interface TreeShakingBudget {
  /** プラグイン数の昇順に並んだ予算 id。この順で増分を見る。 */
  readonly orderedByPluginCount: readonly string[];
  /**
   * 「足したぶんだけ増える」を数値にしたもの。
   *
   * 単調増加を要求するだけでは弱すぎる。中核が既にそのプラグインを抱えて
   * いても、再 export の数バイトで gzip が増えてしまい検査をすり抜ける
   * (実測: プラグインを中核から到達可能にする改変で +9 B だけ増え、
   * 単調増加の検査は通ってしまった)。足したプラグイン1個あたり最低
   * これだけ増えることを要求する。
   */
  readonly minGzipBytesPerAddedPlugin: number;
  /** 「使わないぶんは入らない」を数値にしたもの: core / full の上限比率。 */
  readonly maxCoreShareOfFullPercent: number;
}

export interface BarrelEquivalenceBudget {
  /** バレル経由と深いサブパス経由で突き合わせるプラグイン。 */
  readonly plugins: readonly string[];
  readonly maxDivergencePercent: number;
}

export interface SizeBudget {
  readonly budgets: readonly BundleBudget[];
  readonly treeShaking: TreeShakingBudget;
  readonly barrelEquivalence: BarrelEquivalenceBudget;
}

export interface BundleMeasurement {
  readonly id: string;
  /** この予算が実際に含んだプラグイン数 ("all" を解決した後の数)。 */
  readonly pluginCount: number;
  readonly rawBytes: number;
  readonly gzipBytes: number;
}
