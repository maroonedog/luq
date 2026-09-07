import { Builder } from "../../../../src/index";
import { PluginArgumentError } from "../../../../src/plugin-kit/plugin-definition";
import { numberRangePlugin } from "../../../../src/plugins/number-range";

type Score = { readonly value: number };

const between = Builder()
  .use(numberRangePlugin)
  .for<Score>()
  .v("value", (b) => b.number.range(1, 10))
  .build();

describe("numberRange", () => {
  it("両端を包含する", () => {
    expect(between.validate({ value: 1 }).valid).toBe(true);
    expect(between.validate({ value: 10 }).valid).toBe(true);
    expect(between.validate({ value: 5.5 }).valid).toBe(true);
  });

  it("範囲外を弾き、既定文言を出す", () => {
    const validationResult = between.validate({ value: 11 });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toEqual([
      {
        path: "value",
        code: "numberRange",
        message: "Value must be between 1 and 10, but got 11",
        severity: "error",
      },
    ]);
    expect(between.validate({ value: 0 }).valid).toBe(false);
  });

  it("messageFactory は min / max / actual を受け取る", () => {
    const custom = Builder()
      .use(numberRangePlugin)
      .for<Score>()
      .v("value", (b) =>
        b.number.range(1, 10, {
          messageFactory: (context) =>
            `${String(context.min)}-${String(context.max)}:${String(context.actual)}`,
        })
      )
      .build();
    expect(custom.validate({ value: 42 }).issues[0]?.message).toBe("1-10:42");
  });

  // 旧実装は min > max を実行時まで持ち越し、全ての値を失敗させたうえで
  // 設定ミスの文言をエンドユーザーに出していた。build 時に落とす。
  it("min > max は build 時に PluginArgumentError で落ちる", () => {
    expect(() =>
      Builder()
        .use(numberRangePlugin)
        .for<Score>()
        .v("value", (b) => b.number.range(5, 1))
        .build()
    ).toThrow(PluginArgumentError);
  });

  it("NaN の境界は build 時に PluginArgumentError で落ちる", () => {
    expect(() =>
      Builder()
        .use(numberRangePlugin)
        .for<Score>()
        .v("value", (b) => b.number.range(Number.NaN, 10))
        .build()
    ).toThrow(PluginArgumentError);
    expect(() =>
      Builder()
        .use(numberRangePlugin)
        .for<Score>()
        .v("value", (b) => b.number.range(1, Number.NaN))
        .build()
    ).toThrow(PluginArgumentError);
  });

  it("min === max の一点範囲は成立する", () => {
    const exact = Builder()
      .use(numberRangePlugin)
      .for<Score>()
      .v("value", (b) => b.number.range(7, 7))
      .build();
    expect(exact.validate({ value: 7 }).valid).toBe(true);
    expect(exact.validate({ value: 8 }).valid).toBe(false);
  });
});
