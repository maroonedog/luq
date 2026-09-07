// プール回転は、参照実装が「何もしない」より速く見えた消去への構造的な対策で
// あり、比率ゲート全体がこの上に乗っている。回転が実際に全要素を順に回すこと、
// 両辺が同じ形で包まれることを固定する。
import {
  rotateOverNothing,
  rotateOverValues,
  type ValuePool,
} from "../../../bench/rotate-over-values";

const POOL: ValuePool = ["a", "b", "c", "d"];

describe("rotateOverValues", () => {
  it("プールを順に一巡し、末尾の次で先頭へ戻る", () => {
    const seen: unknown[] = [];
    const subject = rotateOverValues(POOL, (value) => {
      seen.push(value);
      return true;
    });
    for (let call = 0; call < 6; call += 1) subject();
    expect(seen).toEqual(["a", "b", "c", "d", "a", "b"]);
  });

  it("consume の答えをそのまま返す — 受理数の表明がこれに依る", () => {
    const subject = rotateOverValues(POOL, (value) => value === "a");
    expect([subject(), subject(), subject(), subject()]).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("プールに undefined があれば consume を呼ばず false を返す", () => {
    const calls: unknown[] = [];
    const subject = rotateOverValues(["a", undefined] as ValuePool, (value) => {
      calls.push(value);
      return true;
    });
    expect(subject()).toBe(true);
    expect(subject()).toBe(false);
    expect(calls).toEqual(["a"]);
  });

  it("2つの subject は互いの位置を進めない", () => {
    const first: unknown[] = [];
    const second: unknown[] = [];
    const one = rotateOverValues(POOL, (value) => {
      first.push(value);
      return true;
    });
    const other = rotateOverValues(POOL, (value) => {
      second.push(value);
      return true;
    });
    one();
    one();
    other();
    expect(first).toEqual(["a", "b"]);
    expect(second).toEqual(["a"]);
  });
});

describe("rotateOverNothing", () => {
  it("同じ回転を通しながら常に true を返す — 回転そのものの費用を測る床", () => {
    const subject = rotateOverNothing(POOL);
    expect([subject(), subject(), subject(), subject(), subject()]).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
  });
});
