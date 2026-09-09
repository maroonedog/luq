// ===========================================================================
// scripts/perf-figures/render-perf-tables.ts
//
// README の2つの性能表を config/perf-baseline.json から組み立てる。
//
// ここに置いたのは、同じ事故が5度目だからである。適合率・バージョン・バンドル
// サイズ・競合表は既に生成に移した。残っていたのがこの2表で、`bench:record` を
// 回すたびに README だけが古い数字を出し続けていた — 実際、配列の負添字を直して
// 全形状が 20〜45% 速くなったとき、README は「×0.11 / ×0.35 / ×0.32」を掲げた
// ままだった。自己整合しているので、内部矛盾を探す検査では捕まらない。
//
// 表そのものを組み立てるのは1箇所だけで、書き出しも検査も同じ関数を通る。
// ===========================================================================

export interface ThroughputRecord {
  readonly shape: string;
  readonly operation: string;
  readonly opsPerSecond: number;
  readonly relativeSpreadPercent: number;
}

export interface LegacyRecord {
  readonly shape: string;
  readonly legacyOpsPerSecond: number | null;
  readonly currentOpsPerSecond: number;
  readonly speedup: number | null;
}

export interface PerfBaseline {
  readonly throughput: readonly ThroughputRecord[];
  readonly legacyComparison: readonly LegacyRecord[];
}

/** 表の行の並びと見出し。形状の識別子は実測ファイル側の綴りである。 */
const THROUGHPUT_ROWS: readonly (readonly [string, string])[] = [
  ["1 field, 1 check", "singleField"],
  ["3 fields, 6 plugins", "multiField"],
  ["nested, depth 2–3", "nested"],
  ["array of 50 elements", "array"],
  ["JSON Schema document", "jsonSchema"],
];

/**
 * 1.x に負けている形状だけ太字にする。強調は「読者が知っておくべき悪い報せ」
 * を指すためのもので、勝ちを飾るためのものではない。どちらが負けかは実測から
 * 決めるので、速度が変われば強調も勝手に移る。
 */
const LEGACY_ROWS: readonly (readonly [string, string])[] = [
  ["1 field", "singleField"],
  ["3 fields", "multiField"],
  ["nested", "nested"],
  ["array of 50", "array"],
  ["JSON Schema", "jsonSchema"],
];

function formatOps(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function findThroughput(
  baseline: PerfBaseline,
  shape: string,
  operation: string
): ThroughputRecord {
  const found = baseline.throughput.find(
    (record) => record.shape === shape && record.operation === operation
  );
  if (found === undefined) {
    throw new Error(
      `config/perf-baseline.json に ${shape}/${operation} が無い`
    );
  }
  return found;
}

function findLegacy(baseline: PerfBaseline, shape: string): LegacyRecord {
  const found = baseline.legacyComparison.find(
    (record) => record.shape === shape
  );
  if (found === undefined) {
    throw new Error(`config/perf-baseline.json に legacy ${shape} が無い`);
  }
  return found;
}

export function renderThroughputTable(baseline: PerfBaseline): string {
  return THROUGHPUT_ROWS.map(([label, shape]) => {
    const validate = findThroughput(baseline, shape, "validate");
    const parse = findThroughput(baseline, shape, "parse");
    return `| ${label} | ${formatOps(validate.opsPerSecond)} | ${formatOps(parse.opsPerSecond)} |`;
  }).join("\n");
}

/**
 * 比較できなかった形状は行ごと落とさず「not comparable」と書く。落とすと、
 * 表の行数が黙って減って読者には「そんな形状は測っていない」と読める。
 */
export function renderLegacyTable(baseline: PerfBaseline): string {
  return LEGACY_ROWS.map(([label, shape]) => {
    const record = findLegacy(baseline, shape);
    if (record.legacyOpsPerSecond === null || record.speedup === null) {
      return `| ${label} | not comparable | ${formatOps(record.currentOpsPerSecond)} | — |`;
    }
    const ratio = `×${record.speedup.toFixed(2)}`;
    const cell = record.speedup < 1 ? `**${ratio}**` : ratio;
    return `| ${label} | ${formatOps(record.legacyOpsPerSecond)} | ${formatOps(record.currentOpsPerSecond)} | ${cell} |`;
  }).join("\n");
}

/**
 * 1.x が自分の README で「simple」と呼んでいた形状を、こちらで測り直した値。
 *
 * README の一文の中に `3.06M` と書かれていて、そこだけ生成の外に残っていた。
 * 表を生成にしても一文が腐れば同じことなので、ここに引き込む。桁は百万単位の
 * まま — 文章の中の数字であって、表の数字ではない。
 */
export function renderLegacySimpleOps(baseline: PerfBaseline): string {
  const record = findLegacy(baseline, "multiField");
  if (record.legacyOpsPerSecond === null) return "no comparable figure";
  return `${(record.legacyOpsPerSecond / 1_000_000).toFixed(2)}M`;
}

/** 「on these ten it is 2.9–8.6%」の数字。丸めは表示と同じ小数第1位。 */
export function renderSpreadRange(baseline: PerfBaseline): string {
  const spreads = baseline.throughput.map(
    (record) => record.relativeSpreadPercent
  );
  const low = Math.min(...spreads);
  const high = Math.max(...spreads);
  return `${low.toFixed(1)}–${high.toFixed(1)}%`;
}
