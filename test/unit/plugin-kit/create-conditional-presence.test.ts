// 条件付き presence ルールのコンストラクタ。
// 検証したいのは「述語を再ラップしないこと」と「メッセージ経路が
// 他のルール種別と完全に同じであること」の2点。
import {
  PERMITS_ABSENCE,
  REQUIRES_A_VALUE,
  conditionalPresence,
} from "../../../src/plugin-kit/create-conditional-presence";

const MESSAGE_CONTEXT = { path: "email", value: undefined, code: "optionalIf" };

function makeRule(
  messageFactory?: (context: { path: string; condition: boolean }) => string
) {
  return conditionalPresence<{ condition: boolean }>({
    code: "optionalIf",
    messageFactory,
    severity: "error",
    when: (root) => root === true,
    whenMet: PERMITS_ABSENCE,
    whenUnmet: REQUIRES_A_VALUE,
    describe: () => "Field is optional when condition is met",
    buildMessageContext: () => ({ condition: false }),
  });
}

describe("conditionalPresence", () => {
  it("kind は conditionalPresence で、split がそれを見て振り分ける", () => {
    expect(makeRule().kind).toBe("conditionalPresence");
  });

  it("述語は同一性のまま保持される", () => {
    const when = (): boolean => true;
    const rule = conditionalPresence({
      code: "requiredIf",
      severity: "error",
      when,
      whenMet: REQUIRES_A_VALUE,
      whenUnmet: null,
      describe: () => "x",
      buildMessageContext: () => ({}),
    });
    expect(rule.when).toBe(when);
  });

  it("messageFactory が無ければ describe の文字列がそのまま出る", () => {
    expect(makeRule().describe(MESSAGE_CONTEXT)).toBe(
      "Field is optional when condition is met"
    );
  });

  it("messageFactory には MessageContext と追加文脈が合流して渡る", () => {
    const rule = makeRule(
      (context) => `${context.path} condition=${String(context.condition)}`
    );
    expect(rule.describe(MESSAGE_CONTEXT)).toBe("email condition=false");
  });

  it("両側の allowance はそのまま持ち回られる", () => {
    const rule = makeRule();
    expect(rule.whenMet).toBe(PERMITS_ABSENCE);
    expect(rule.whenUnmet).toBe(REQUIRES_A_VALUE);
  });

  it("REQUIRES_A_VALUE は undefined / null / 空文字を不在とみなす", () => {
    expect(REQUIRES_A_VALUE).toEqual({
      allowUndefined: false,
      allowNull: false,
      emptyStringIsMissing: true,
    });
  });

  it("PERMITS_ABSENCE では空文字は「値がある」側に残る", () => {
    expect(PERMITS_ABSENCE).toEqual({
      allowUndefined: true,
      allowNull: true,
      emptyStringIsMissing: false,
    });
  });

  it("共有される allowance は凍結されている", () => {
    expect(Object.isFrozen(REQUIRES_A_VALUE)).toBe(true);
    expect(Object.isFrozen(PERMITS_ABSENCE)).toBe(true);
  });
});
