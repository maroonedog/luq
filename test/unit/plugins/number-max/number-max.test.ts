import { Builder } from "../../../../src/index";
import { PluginArgumentError } from "../../../../src/plugin-kit/plugin-definition";
import { numberMaxPlugin } from "../../../../src/plugins/number-max";

type Score = { readonly value: number };

const inclusive = Builder()
  .use(numberMaxPlugin)
  .for<Score>()
  .v("value", (b) => b.number.max(100))
  .build();

const exclusive = Builder()
  .use(numberMaxPlugin)
  .for<Score>()
  .v("value", (b) => b.number.max(100, true))
  .build();

describe("numberMax", () => {
  it("境界は既定で包含する (100 <= 100)", () => {
    expect(inclusive.validate({ value: 100 }).valid).toBe(true);
  });

  it("境界を上回る値を弾く", () => {
    const validationResult = inclusive.validate({ value: 100.5 });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toEqual([
      {
        path: "value",
        code: "numberMax",
        message: "Value must be at most 100, but got 100.5",
        severity: "error",
      },
    ]);
  });

  it("exclusive を渡すと境界そのものを弾き、文言も変わる", () => {
    const validationResult = exclusive.validate({ value: 100 });
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues[0]?.message).toBe(
      "Value must be less than 100, but got 100"
    );
    expect(exclusive.validate({ value: 99.9 }).valid).toBe(true);
  });

  it("messageFactory は max / actual / exclusive を受け取る", () => {
    const custom = Builder()
      .use(numberMaxPlugin)
      .for<Score>()
      .v("value", (b) =>
        b.number.max(5, false, {
          messageFactory: (context) =>
            `${String(context.max)}/${String(context.actual)}/${String(
              context.exclusive
            )}`,
        })
      )
      .build();
    expect(custom.validate({ value: 9 }).issues[0]?.message).toBe("5/9/false");
  });

  it("NaN の上限は build 時に PluginArgumentError で落ちる", () => {
    expect(() =>
      Builder()
        .use(numberMaxPlugin)
        .for<Score>()
        .v("value", (b) => b.number.max(Number.NaN))
        .build()
    ).toThrow(PluginArgumentError);
  });
});
