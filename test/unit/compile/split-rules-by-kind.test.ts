import {
  splitRulesByKind,
  UnknownRuleKindError,
} from "../../../src/compile/split-rules-by-kind";
import type { Rule } from "../../../src/plugin-kit/compiled-rule";
import {
  makeCheck,
  makeComposite,
  makeConditionalPresence,
  makeGate,
  makeRecursive,
  makeTransform,
  nullableRule,
  requiredRule,
} from "./rule-fixtures";

describe("splitRulesByKind", () => {
  it("separates all seven kinds", () => {
    const split = splitRulesByKind([
      makeCheck("minLength"),
      requiredRule(),
      makeConditionalPresence("requiredIf", () => true),
      makeGate("validateIf"),
      makeTransform(),
      makeComposite("oneOf"),
      makeRecursive("recursively"),
    ]);
    expect(split.checks).toHaveLength(1);
    expect(split.presences).toHaveLength(1);
    expect(split.conditionalPresences).toHaveLength(1);
    expect(split.gates).toHaveLength(1);
    expect(split.transforms).toHaveLength(1);
    expect(split.composites).toHaveLength(1);
    expect(split.recursions).toHaveLength(1);
  });

  it("keeps conditional presence out of the static presence bucket", () => {
    const split = splitRulesByKind([
      requiredRule(),
      makeConditionalPresence("requiredIf", () => true),
    ]);
    expect(split.presences.map((rule) => rule.code)).toEqual(["required"]);
    expect(split.conditionalPresences.map((rule) => rule.code)).toEqual([
      "requiredIf",
    ]);
  });

  it("preserves declaration order within a kind", () => {
    const split = splitRulesByKind([
      makeCheck("first"),
      requiredRule(),
      makeCheck("second"),
      makeCheck("third"),
    ]);
    expect(split.checks.map((check) => check.code)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("keeps both presence rules for the merge to reconcile", () => {
    const split = splitRulesByKind([requiredRule(), nullableRule()]);
    expect(split.presences.map((rule) => rule.code)).toEqual([
      "required",
      "nullable",
    ]);
  });

  it("returns empty frozen arrays for absent kinds", () => {
    const split = splitRulesByKind([]);
    expect(split.checks).toEqual([]);
    expect(Object.isFrozen(split)).toBe(true);
    expect(Object.isFrozen(split.checks)).toBe(true);
    expect(() => {
      (split.checks as unknown as unknown[]).push(makeCheck("sneaked"));
    }).toThrow(TypeError);
  });

  it("throws UnknownRuleKindError on a kind the union forbids", () => {
    // The type system forbids this at every honest call site; the guard exists
    // because a plugin can be authored in untyped JavaScript.
    const smuggled = { kind: "teleport", code: "teleport" } as unknown as Rule;
    expect(() => splitRulesByKind([smuggled])).toThrow(UnknownRuleKindError);
    expect(() => splitRulesByKind([smuggled])).toThrow(/"teleport"/);
  });

  it("names an impostor that carries no kind at all", () => {
    const smuggled = { code: "nameless" } as unknown as Rule;
    expect(() => splitRulesByKind([smuggled])).toThrow(UnknownRuleKindError);
    expect(() => splitRulesByKind([smuggled])).toThrow(/no kind/);
  });
});
