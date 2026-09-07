import {
  countDecimalPlaces,
  isMultipleOf,
} from "../../../../src/plugins/number-multiple-of/is-multiple-of";

describe("countDecimalPlaces", () => {
  it("通常表記の小数桁を数える", () => {
    expect(countDecimalPlaces(3)).toBe(0);
    expect(countDecimalPlaces(0.1)).toBe(1);
    expect(countDecimalPlaces(0.35)).toBe(2);
    expect(countDecimalPlaces(-2.125)).toBe(3);
  });

  it("指数表記も桁に還元する", () => {
    expect(countDecimalPlaces(1e-7)).toBe(7);
    expect(countDecimalPlaces(1.5e-7)).toBe(8);
    expect(countDecimalPlaces(1e21)).toBe(0);
  });
});

describe("isMultipleOf", () => {
  // 旧実装のバグ: 0.3 % 0.1 は 0.09999999999999998 なので 0.3 が弾かれていた。
  it("浮動小数の丸め誤差を越えて 0.3 が 0.1 の倍数だと判定する", () => {
    expect(isMultipleOf(0.3, 0.1)).toBe(true);
    expect(isMultipleOf(0.7, 0.1)).toBe(true);
    expect(isMultipleOf(1.1, 0.1)).toBe(true);
  });

  // 誤差を吸収するあまり全部通してしまう実装になっていないこと。
  it("倍数でない小数は弾く", () => {
    expect(isMultipleOf(0.35, 0.1)).toBe(false);
    expect(isMultipleOf(0.05, 0.1)).toBe(false);
    expect(isMultipleOf(1.05, 0.1)).toBe(false);
  });

  it("整数どうしの判定", () => {
    expect(isMultipleOf(10, 5)).toBe(true);
    expect(isMultipleOf(10, 3)).toBe(false);
    expect(isMultipleOf(0, 7)).toBe(true);
    expect(isMultipleOf(-0, 7)).toBe(true);
  });

  it("負の値と負の除数", () => {
    expect(isMultipleOf(-0.3, 0.1)).toBe(true);
    expect(isMultipleOf(0.3, -0.1)).toBe(true);
    expect(isMultipleOf(-9, -3)).toBe(true);
    expect(isMultipleOf(-10, 3)).toBe(false);
  });

  it("桁数の異なる小数どうし (スケールは両者の最大桁で取る)", () => {
    expect(isMultipleOf(7.5, 2.5)).toBe(true);
    expect(isMultipleOf(1, 0.25)).toBe(true);
    expect(isMultipleOf(1.125, 0.125)).toBe(true);
    expect(isMultipleOf(1.2, 0.125)).toBe(false);
  });

  it("有限でない値は倍数ではない", () => {
    expect(isMultipleOf(Number.POSITIVE_INFINITY, 2)).toBe(false);
    expect(isMultipleOf(Number.NaN, 2)).toBe(false);
  });

  it("安全整数を越えるスケールでも破綻しない", () => {
    expect(isMultipleOf(1e-8, 1e-8)).toBe(true);
    expect(isMultipleOf(3e-8, 1e-8)).toBe(true);
    expect(isMultipleOf(1e-20, 1e-20)).toBe(true);
    expect(isMultipleOf(1e20, 1e10)).toBe(true);
  });
});
