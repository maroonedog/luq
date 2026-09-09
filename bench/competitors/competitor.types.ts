// ===========================================================================
// bench/competitors/competitor.types.ts
//
// 競合ライブラリを、この harness が測れる一つの形に揃える。
//
// 測る前に **判定が一致するか** を見るのが、このディレクトリの一番大事な仕事
// である。assert-reference-agreement.ts が手書き参照に対してやっているのと
// 同じ理由で、判定の違う相手との速度比較は「遅い数字」ではなく「誤った数字」
// になる。そして競合とは実際に食い違う: 例えば multiField の rejected プールに
// は、緩い正規表現なら通るが Luq の string-email は弾くメールが入っている。
//
// なので食い違いは隠さず、**数える**。時間を測るのは全員が同じ答えを出す値
// だけにし、食い違った値は件数と中身を報告に出す。どちらも消さない。
// ===========================================================================
import type { BenchShapeName } from "../shapes/bench-shape.types";

/** 一つの競合ライブラリの、一つの shape に対する実装。 */
export interface CompetitorSubject {
  /** 値を受け取り、その shape の規則を満たすかを答える。 */
  check(value: unknown): boolean;
}

export interface Competitor {
  /** npm のパッケージ名。報告に出る。 */
  readonly name: string;
  /** 実測したバージョン。手で書かず package.json から読む。 */
  readonly version: string;
  /**
   * 実装のある shape だけを持つ。全部を埋める必要はない —
   * 例えば ajv は JSON Schema のライブラリなので jsonSchema shape が本命で、
   * 他の shape は「同じ規則を JSON Schema で書いたもの」になる。
   */
  readonly subjects: Partial<Record<BenchShapeName, CompetitorSubject>>;
}
