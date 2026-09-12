import {
  OPEN_PRESENCE,
  OPEN_PRESENCE_CODE,
  resolvePresence,
} from "../../../src/compile/resolve-presence";
import type { PresencePolicy } from "../../../src/compile/validation-plan.types";
import {
  makePresence,
  nullableRule,
  optionalRule,
  requiredRule,
} from "./rule-fixtures";

function flagsOf(policy: PresencePolicy) {
  return {
    code: policy.code,
    severity: policy.severity,
    allowUndefined: policy.allowUndefined,
    allowNull: policy.allowNull,
    emptyStringIsMissing: policy.emptyStringIsMissing,
  };
}

describe("resolvePresence with no rule", () => {
  it("forbids nothing, so a missing field is never an implicit error", () => {
    const policy = resolvePresence([]);
    expect(policy).toBe(OPEN_PRESENCE);
    expect(policy.code).toBe(OPEN_PRESENCE_CODE);
    expect(policy.allowUndefined).toBe(true);
    expect(policy.allowNull).toBe(true);
    expect(policy.emptyStringIsMissing).toBe(false);
  });

  it("freezes the shared open policy", () => {
    expect(Object.isFrozen(OPEN_PRESENCE)).toBe(true);
  });
});

describe("resolvePresence with one rule", () => {
  it("carries required verbatim", () => {
    expect(flagsOf(resolvePresence([requiredRule()]))).toEqual({
      code: "required",
      severity: "error",
      allowUndefined: false,
      allowNull: false,
      emptyStringIsMissing: true,
    });
  });

  it("carries optional verbatim", () => {
    expect(flagsOf(resolvePresence([optionalRule()]))).toEqual({
      code: "optional",
      severity: "error",
      allowUndefined: true,
      allowNull: false,
      emptyStringIsMissing: false,
    });
  });

  it("keeps the rule's own severity", () => {
    const policy = resolvePresence([
      makePresence("required", false, false, true, "warning"),
    ]);
    expect(policy.severity).toBe("warning");
  });

  it("delegates the message to the rule that was chosen", () => {
    const policy = resolvePresence([requiredRule()]);
    expect(
      policy.describe({ path: "name", value: undefined, code: "required" })
    ).toBe("required policy");
  });
});

describe("resolvePresence merges ORDER-INDEPENDENTLY", () => {
  it("optional().nullable() equals nullable().optional()", () => {
    const forward = resolvePresence([optionalRule(), nullableRule()]);
    const backward = resolvePresence([nullableRule(), optionalRule()]);
    expect(flagsOf(forward)).toEqual(flagsOf(backward));
    expect(forward.allowUndefined).toBe(true);
    expect(forward.allowNull).toBe(true);
  });

  it("required().optional() equals optional().required()", () => {
    const forward = resolvePresence([requiredRule(), optionalRule()]);
    const backward = resolvePresence([optionalRule(), requiredRule()]);
    expect(flagsOf(forward)).toEqual(flagsOf(backward));
    expect(forward.code).toBe("required");
    expect(forward.allowUndefined).toBe(true);
    expect(forward.allowNull).toBe(false);
  });

  it("required().nullable() keeps undefined forbidden and null allowed", () => {
    const policy = resolvePresence([requiredRule(), nullableRule()]);
    expect(flagsOf(policy)).toEqual(
      flagsOf(resolvePresence([nullableRule(), requiredRule()]))
    );
    expect(policy.allowUndefined).toBe(false);
    expect(policy.allowNull).toBe(true);
    expect(policy.code).toBe("required");
  });

  it("reports under the code of the rule that forbids the most", () => {
    const policy = resolvePresence([
      nullableRule(),
      requiredRule(),
      optionalRule(),
    ]);
    expect(policy.code).toBe("required");
  });

  it("breaks a tie on WHAT is forbidden, not on declaration order", () => {
    const forbidsNull = makePresence("alpha", true, false, false);
    const forbidsUndefined = makePresence("zebra", false, true, false);
    expect(resolvePresence([forbidsNull, forbidsUndefined]).code).toBe(
      resolvePresence([forbidsUndefined, forbidsNull]).code
    );
    expect(resolvePresence([forbidsNull, forbidsUndefined]).code).toBe("zebra");
  });

  /**
   * The identity a merged policy reports must survive renaming a code. The
   * vocabulary in config/issue-code.lock.json is a contract, and a contract
   * that cannot be re-spelled without silently moving behaviour elsewhere is
   * not one — so nothing in the merge may compare two code strings.
   */
  it("picks the same rule whatever the two codes are spelled", () => {
    const forbidsNull = (code: string) =>
      makePresence(code, true, false, false);
    const forbidsUndefined = (code: string) =>
      makePresence(code, false, true, false);
    expect(
      resolvePresence([forbidsNull("aaa"), forbidsUndefined("zzz")]).code
    ).toBe("zzz");
    expect(
      resolvePresence([forbidsNull("zzz"), forbidsUndefined("aaa")]).code
    ).toBe("aaa");
  });

  it("prefers forbidding null over treating the empty string as missing", () => {
    const forbidsNull = makePresence("zebra", true, false, false);
    const emptyIsMissing = makePresence("alpha", true, true, true);
    expect(resolvePresence([forbidsNull, emptyIsMissing]).code).toBe("zebra");
    expect(resolvePresence([emptyIsMissing, forbidsNull]).code).toBe("zebra");
  });

  /**
   * Two rules that forbid exactly the same things are indistinguishable to
   * every reader of the policy, so the one written first is reported. This is
   * the ONLY case where the order the methods were typed in is observable.
   */
  it("reports the first of two rules that forbid the same things", () => {
    const first = makePresence("first", true, false, false);
    const second = makePresence("second", true, false, false);
    expect(resolvePresence([first, second]).code).toBe("first");
    expect(resolvePresence([second, first]).code).toBe("second");
  });

  it("freezes the merged policy", () => {
    const policy = resolvePresence([requiredRule(), nullableRule()]);
    expect(Object.isFrozen(policy)).toBe(true);
  });
});
