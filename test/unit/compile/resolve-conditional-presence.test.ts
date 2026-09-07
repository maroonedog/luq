// 条件付き presence が「build 時に完成し、実行時は選ぶだけ」であることの検証。
// 主張は結果ではなくプランに対して立てる。
import {
  NO_PRESENCE_OVERRIDES,
  resolveConditionalPresence,
} from "../../../src/compile/resolve-conditional-presence";
import {
  ALLOWS_ABSENCE,
  REJECTS_ABSENCE,
  makeConditionalPresence,
} from "./rule-fixtures";

describe("resolveConditionalPresence", () => {
  it("条件付きルールが無ければ共有された凍結済みの空配列を返す", () => {
    const overrides = resolveConditionalPresence([]);
    expect(overrides).toBe(NO_PRESENCE_OVERRIDES);
    expect(Object.isFrozen(overrides)).toBe(true);
    expect(() => {
      (overrides as unknown as unknown[]).push({});
    }).toThrow(TypeError);
  });

  it("宣言順を保ち、1ルールにつき1エントリを作る", () => {
    const overrides = resolveConditionalPresence([
      makeConditionalPresence("first", () => true),
      makeConditionalPresence("second", () => true),
    ]);
    expect(overrides).toHaveLength(2);
    expect(overrides.map((entry) => entry.whenMet?.code)).toEqual([
      "first",
      "second",
    ]);
  });

  it("両側とも完成した PresencePolicy になっている (実行時に組み立てない)", () => {
    const [override] = resolveConditionalPresence([
      makeConditionalPresence(
        "optionalIf",
        () => true,
        ALLOWS_ABSENCE,
        REJECTS_ABSENCE
      ),
    ]);
    expect(override?.whenMet).toEqual({
      code: "optionalIf",
      severity: "error",
      allowUndefined: true,
      allowNull: true,
      emptyStringIsMissing: false,
      describe: expect.any(Function),
    });
    expect(override?.whenUnmet).toEqual({
      code: "optionalIf",
      severity: "error",
      allowUndefined: false,
      allowNull: false,
      emptyStringIsMissing: true,
      describe: expect.any(Function),
    });
  });

  it("意見を持たない側は null のまま残る", () => {
    const [override] = resolveConditionalPresence([
      makeConditionalPresence("requiredIf", () => true),
    ]);
    expect(override?.whenMet).not.toBeNull();
    expect(override?.whenUnmet).toBeNull();
  });

  it("述語は同一性のまま保持され、再ラップされない", () => {
    const when = (): boolean => true;
    const [override] = resolveConditionalPresence([
      makeConditionalPresence("requiredIf", when),
    ]);
    expect(override?.when).toBe(when);
  });

  it("build 時に述語を一度も呼ばない", () => {
    const when = jest.fn(() => true);
    resolveConditionalPresence([makeConditionalPresence("requiredIf", when)]);
    expect(when).not.toHaveBeenCalled();
  });

  it("両側の severity と code はルールと同一", () => {
    const [override] = resolveConditionalPresence([
      makeConditionalPresence(
        "MY_CODE",
        () => true,
        REJECTS_ABSENCE,
        ALLOWS_ABSENCE,
        "warning"
      ),
    ]);
    expect(override?.whenMet?.severity).toBe("warning");
    expect(override?.whenUnmet?.code).toBe("MY_CODE");
  });

  it("エントリもポリシーも凍結されている", () => {
    const [override] = resolveConditionalPresence([
      makeConditionalPresence("requiredIf", () => true),
    ]);
    expect(Object.isFrozen(override)).toBe(true);
    expect(Object.isFrozen(override?.whenMet)).toBe(true);
  });

  it("describe はルールのものへ委譲する", () => {
    const [override] = resolveConditionalPresence([
      makeConditionalPresence("requiredIf", () => true),
    ]);
    expect(
      override?.whenMet?.describe({
        path: "a",
        value: undefined,
        code: "requiredIf",
      })
    ).toBe("requiredIf policy");
  });
});
