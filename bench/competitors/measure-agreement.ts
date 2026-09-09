// ===========================================================================
// bench/competitors/measure-agreement.ts
//
// 速度を測る前に、**同じ答えを出しているか** を数える。
//
// assert-reference-agreement.ts は手書き参照に対してこれを表明として書き、
// 一致しなければビルドを落とす。競合に対しては落とさない — 落とすべきでない
// からである。ライブラリごとに `email` の厳しさは違い、それは実装の優劣では
// なく仕様の違いで、こちらが直せるものでもない。
//
// 代わりに数えて報告する。時間を測るのは全員が一致した値だけにし、食い違った
// 値は件数と中身を残す。どちらも消さない:
//   * 一致した値だけで測る  -> 比較が「同じ仕事」に対するものになる
//   * 食い違いを報告に出す  -> 「速いが違う判定をしている」が読者に見える
//
// 片方だけやると誠実さが失われる。全部同じプールで測れば「相手が手を抜いて
// 速い」を見逃し、食い違いを隠せば「なぜ数が合わないか」が説明できない。
// ===========================================================================
import { BENCH_SHAPES } from "../shapes/index";
import type { BenchShape, BenchShapeName } from "../shapes/bench-shape.types";
import type { Competitor } from "./competitor.types";

export interface Disagreement {
  readonly value: unknown;
  /** Luq がどう答えたか。競合はその逆を答えている。 */
  readonly luqSaid: boolean;
}

export interface ShapeAgreement {
  readonly shape: BenchShapeName;
  readonly competitor: string;
  readonly agreedValues: readonly unknown[];
  readonly disagreements: readonly Disagreement[];
}

function judgeWithLuq(shape: BenchShape, value: unknown): boolean {
  return shape.buildValidator().validate(value).valid;
}

/**
 * 一つの shape と一つの競合について、受理プールと棄却プールの全値を突き合わせる。
 *
 * Luq 側は毎回 build し直さない — 一度だけ組んで使い回す。ここは計測ではない
 * ので速度は問題にならないが、build ごとに違う validator を使うと「どの
 * validator の答えか」が曖昧になる。
 */
export function measureShapeAgreement(
  shape: BenchShape,
  competitor: Competitor
): ShapeAgreement | undefined {
  const subject = competitor.subjects[shape.name];
  if (subject === undefined) return undefined;

  const validator = shape.buildValidator();
  const agreed: unknown[] = [];
  const disagreements: Disagreement[] = [];

  for (const value of [...shape.acceptedValues, ...shape.rejectedValues]) {
    const luqSaid = validator.validate(value).valid;
    if (subject.check(value) === luqSaid) agreed.push(value);
    else disagreements.push({ value, luqSaid });
  }

  return {
    shape: shape.name,
    competitor: competitor.name,
    agreedValues: Object.freeze(agreed),
    disagreements: Object.freeze(disagreements),
  };
}

export function measureAllAgreement(
  competitors: readonly Competitor[]
): readonly ShapeAgreement[] {
  const results: ShapeAgreement[] = [];
  for (const shape of BENCH_SHAPES) {
    for (const competitor of competitors) {
      const agreement = measureShapeAgreement(shape, competitor);
      if (agreement !== undefined) results.push(agreement);
    }
  }
  return Object.freeze(results);
}

/** 使い回すために、Luq 側の判定を一度だけ取る。 */
export { judgeWithLuq };
