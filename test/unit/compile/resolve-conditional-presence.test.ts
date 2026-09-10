// That conditional presence is finished at build time and only selected at
// validation time. The assertions are made against the plan, not the result.
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
  it("answers the shared frozen empty array when there is no conditional rule", () => {
    const overrides = resolveConditionalPresence([]);
    expect(overrides).toBe(NO_PRESENCE_OVERRIDES);
    expect(Object.isFrozen(overrides)).toBe(true);
    expect(() => {
      (overrides as unknown as unknown[]).push({});
    }).toThrow(TypeError);
  });

  it("keeps declaration order and makes one entry per rule", () => {
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

  it("has both sides as finished policies, assembled at no point later", () => {
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
      // Conditional presence is a builder feature and no document is
      // involved, so null stays absence here rather than becoming a value.
      nullIsValue: false,
      allowUndefined: true,
      allowNull: true,
      emptyStringIsMissing: false,
      describe: expect.any(Function),
    });
    expect(override?.whenUnmet).toEqual({
      code: "optionalIf",
      severity: "error",
      nullIsValue: false,
      allowUndefined: false,
      allowNull: false,
      emptyStringIsMissing: true,
      describe: expect.any(Function),
    });
  });

  it("leaves the side holding no opinion as null", () => {
    const [override] = resolveConditionalPresence([
      makeConditionalPresence("requiredIf", () => true),
    ]);
    expect(override?.whenMet).not.toBeNull();
    expect(override?.whenUnmet).toBeNull();
  });

  it("keeps the predicate by identity, wrapping it in nothing", () => {
    const when = (): boolean => true;
    const [override] = resolveConditionalPresence([
      makeConditionalPresence("requiredIf", when),
    ]);
    expect(override?.when).toBe(when);
  });

  it("never calls the predicate at build time", () => {
    const when = jest.fn(() => true);
    resolveConditionalPresence([makeConditionalPresence("requiredIf", when)]);
    expect(when).not.toHaveBeenCalled();
  });

  it("takes both sides' severity and code from the rule", () => {
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

  it("freezes both the entries and the policies", () => {
    const [override] = resolveConditionalPresence([
      makeConditionalPresence("requiredIf", () => true),
    ]);
    expect(Object.isFrozen(override)).toBe(true);
    expect(Object.isFrozen(override?.whenMet)).toBe(true);
  });

  it("delegates describe to the rule's own", () => {
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
