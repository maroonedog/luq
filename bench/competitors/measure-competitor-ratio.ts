// ===========================================================================
// bench/competitors/measure-competitor-ratio.ts
//
// Luq と競合ライブラリを、同じ値のプールに対して交互に測る。
//
// 交互に測る理由は take-interleaved-samples.ts のヘッダにある通りで、
// 片方を全部測ってから他方を測ると、負荷の山が片側だけに落ちて比率が動く。
//
// **測るのは判定が一致した値だけ** である。measure-agreement.ts が食い違いを
// 数えており、食い違った値を含めたまま時間を測ると「相手が別の仕事をして
// 速い/遅い」を速度差として報告することになる。食い違いは消さず、報告の別の
// 欄に出す。
//
// 測るのは validate 相当の一往復だけで、parse は測らない。競合の多くは
// 「検証」と「変換」を分けておらず、対応づけると比較のほうが恣意的になる。
// ===========================================================================
import { median, relativeSpreadPercent } from "../sample-rate";
import { takeInterleavedSamples } from "../take-interleaved-samples";
import { rotateOverValues, type ValuePool } from "../rotate-over-values";
import type { BenchShape, BenchShapeName } from "../shapes/bench-shape.types";
import type { Competitor } from "./competitor.types";
import { measureShapeAgreement } from "./measure-agreement";

export interface CompetitorRatio {
  readonly shape: BenchShapeName;
  readonly competitor: string;
  readonly competitorVersion: string;
  readonly luqOpsPerSecond: number;
  readonly competitorOpsPerSecond: number;
  /** 1 より大きければ Luq が速い。ペアごとの比の中央値。 */
  readonly ratio: number;
  /** 時間を測った値の数と、食い違って除いた値の数。 */
  readonly comparedValues: number;
  readonly disagreedValues: number;
  readonly luqSpreadPercent: number;
  readonly competitorSpreadPercent: number;
}

const TARGET_SAMPLE_MS = 60;
const SAMPLE_COUNT = 9;
const WARMUP_MS = 120;

/**
 * 一致した値だけを回す関数を作る。返すのは「期待どおりに答えたか」であって
 * 成否ではない — 途中でどちらかが別の答えを返し始めたら、それは比較の前提が
 * 崩れたということなので、呼び出し側が数を突き合わせて気づけるようにする。
 */
function buildRotation(
  values: ValuePool,
  judge: (value: unknown) => boolean,
  expected: ReadonlyMap<unknown, boolean>
): () => boolean {
  return rotateOverValues(
    values,
    (value) => judge(value) === expected.get(value)
  );
}

/**
 * ValuePool は「2つ以上」を型で要求する。一致した値が1つしかない相手は
 * 測らない — プールが1値だと V8 が定数畳み込みして、片方だけ消える
 * (rotate-over-values.ts が記録している事故がそれである)。
 */
function toPool(values: readonly unknown[]): ValuePool | undefined {
  const [first, second, ...rest] = values;
  if (values.length < 2) return undefined;
  return [first, second, ...rest];
}

export function measureCompetitorRatio(
  shape: BenchShape,
  competitor: Competitor
): CompetitorRatio | undefined {
  const subject = competitor.subjects[shape.name];
  const agreement = measureShapeAgreement(shape, competitor);
  if (subject === undefined || agreement === undefined) return undefined;
  if (agreement.agreedValues.length === 0) return undefined;

  const validator = shape.buildValidator();
  const expected = new Map<unknown, boolean>();
  for (const value of agreement.agreedValues) {
    expected.set(value, validator.validate(value).valid);
  }

  const pool = toPool(agreement.agreedValues);
  if (pool === undefined) return undefined;

  const samples = takeInterleavedSamples(
    buildRotation(pool, (v) => validator.validate(v).valid, expected),
    buildRotation(pool, (v) => subject.check(v), expected),
    {
      targetSampleMs: TARGET_SAMPLE_MS,
      sampleCount: SAMPLE_COUNT,
      warmupMs: WARMUP_MS,
    }
  );

  const luqRates = samples.firstRates;
  const otherRates = samples.secondRates;

  const luqMedian = median(luqRates);
  const otherMedian = median(otherRates);

  return {
    shape: shape.name,
    competitor: competitor.name,
    competitorVersion: competitor.version,
    luqOpsPerSecond: luqMedian,
    competitorOpsPerSecond: otherMedian,
    ratio: median(samples.pairRatios),
    comparedValues: agreement.agreedValues.length,
    disagreedValues: agreement.disagreements.length,
    luqSpreadPercent: relativeSpreadPercent(luqRates, luqMedian),
    competitorSpreadPercent: relativeSpreadPercent(otherRates, otherMedian),
  };
}
