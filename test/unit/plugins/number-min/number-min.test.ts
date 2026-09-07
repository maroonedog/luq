// 実際に検証を走らせて valid / issues を確かめる。型が通っただけでは合格にしない。
import { Builder } from "../../../../src/index";
import { PluginArgumentError } from "../../../../src/plugin-kit/plugin-definition";
import { numberMinPlugin } from "../../../../src/plugins/number-min";

type Score = { readonly value: number };

const inclusive = Builder()
  .use(numberMinPlugin)
  .for<Score>()
  .v("value", (b) => b.number.min(10))
  .build();

const exclusive = Builder()
  .use(numberMinPlugin)
  .for<Score>()
  .v("value", (b) => b.number.min(10, true))
  .build();

describe("numberMin", () => {
  it("境界は既定で包含する (10 >= 10)", () => {
    expect(inclusive.validate({ value: 10 }).valid).toBe(true);
  });

  it("境界を下回る値を弾く", () => {
    const validationResult = inclusive.validate({ value: 9.999 });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toEqual([
      {
        path: "value",
        code: "numberMin",
        message: "Value must be at least 10, but got 9.999",
        severity: "error",
      },
    ]);
  });

  it("exclusive を渡すと境界そのものを弾き、文言も変わる", () => {
    const validationResult = exclusive.validate({ value: 10 });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues[0]?.message).toBe(
      "Value must be greater than 10, but got 10"
    );
    expect(exclusive.validate({ value: 10.0001 }).valid).toBe(true);
  });

  it("code はオプションで上書きできる", () => {
    const renamed = Builder()
      .use(numberMinPlugin)
      .for<Score>()
      .v("value", (b) => b.number.min(10, false, { code: "TOO_SMALL" }))
      .build();
    const validationResult = renamed.validate({ value: 1 });
    expect(validationResult.issues[0]?.code).toBe("TOO_SMALL");
  });

  it("messageFactory は min / actual / exclusive を受け取る", () => {
    const custom = Builder()
      .use(numberMinPlugin)
      .for<Score>()
      .v("value", (b) =>
        b.number.min(10, true, {
          messageFactory: (context) =>
            `${context.path}:${String(context.min)}:${String(context.actual)}:${String(
              context.exclusive
            )}`,
        })
      )
      .build();
    expect(custom.validate({ value: 4 }).issues[0]?.message).toBe(
      "value:10:4:true"
    );
  });

  it("負の下限も扱える", () => {
    const belowZero = Builder()
      .use(numberMinPlugin)
      .for<Score>()
      .v("value", (b) => b.number.min(-5))
      .build();
    expect(belowZero.validate({ value: -5 }).valid).toBe(true);
    expect(belowZero.validate({ value: -6 }).valid).toBe(false);
  });

  it("NaN の下限は build 時に PluginArgumentError で落ちる", () => {
    expect(() =>
      Builder()
        .use(numberMinPlugin)
        .for<Score>()
        .v("value", (b) => b.number.min(Number.NaN))
        .build()
    ).toThrow(PluginArgumentError);
  });
});
