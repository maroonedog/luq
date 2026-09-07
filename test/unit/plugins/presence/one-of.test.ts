// oneOf は「許可された値の集合」。JSON Schema の合成キーワード oneOf とは別物。
import { Builder } from "../../../../src/index";
import { oneOfPlugin } from "../../../../src/plugins/one-of";
import { PluginArgumentError } from "../../../../src/plugin-kit/plugin-definition";

type Ticket = { status: string; priority: number };

const validateStatus = Builder()
  .use(oneOfPlugin)
  .for<Ticket>()
  .v("status", (b) => b.string.oneOf(["open", "closed"]))
  .build();

describe("oneOf", () => {
  it("集合に含まれる値を通す", () => {
    expect(validateStatus.validate({ status: "open", priority: 1 }).valid).toBe(
      true
    );
  });

  it("含まれない値を弾き、既定メッセージに候補を並べる", () => {
    const result = validateStatus.validate({ status: "draft", priority: 1 });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]).toEqual({
      path: "status",
      code: "oneOf",
      message: 'Value must be one of: "open", "closed"',
      severity: "error",
    });
  });

  it("厳密等価で判定する (数値の集合に文字列は入らない)", () => {
    const validator = Builder()
      .use(oneOfPlugin)
      .for<Ticket>()
      .v("priority", (b) => b.number.oneOf([1, 2, 3]))
      .build();
    expect(validator.validate({ status: "s", priority: 2 }).valid).toBe(true);
    expect(validator.validate({ status: "s", priority: 4 }).valid).toBe(false);
  });

  // 8件を超えると Set 経路に切り替わる。どちらの経路でも答えは同じでなければならない。
  it("候補が8件を超えても判定は変わらない", () => {
    const many = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    const validator = Builder()
      .use(oneOfPlugin)
      .for<Ticket>()
      .v("status", (b) => b.string.oneOf(many))
      .build();
    expect(validator.validate({ status: "i", priority: 1 }).valid).toBe(true);
    expect(validator.validate({ status: "z", priority: 1 }).valid).toBe(false);
  });

  it("空配列は build 時に PluginArgumentError で落ちる", () => {
    expect(() =>
      Builder()
        .use(oneOfPlugin)
        .for<Ticket>()
        .v("status", (b) => b.string.oneOf([]))
        .build()
    ).toThrow(PluginArgumentError);
  });

  it("options.messageFactory を尊重する", () => {
    const validator = Builder()
      .use(oneOfPlugin)
      .for<Ticket>()
      .v("status", (b) =>
        b.string.oneOf(["open", "closed"], {
          code: "BAD_STATUS",
          messageFactory: (context) => `${context.path}: ${context.code}`,
        })
      )
      .build();
    const result = validator.validate({ status: "draft", priority: 1 });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("status: BAD_STATUS");
  });
});
