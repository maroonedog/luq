import {
  ConflictingRecursionError,
  resolveRecursion,
} from "../../../src/compile/resolve-recursion";
import {
  EMPTY_PLAN,
  makeRecursive,
  planRefTo,
  unresolvablePlanRef,
} from "./rule-fixtures";

describe("resolveRecursion", () => {
  it("returns null when no recursive rule was declared", () => {
    expect(resolveRecursion([], unresolvablePlanRef(), "name")).toBeNull();
  });

  it("copies the rule's target, depth, code and severity", () => {
    const policy = resolveRecursion(
      [makeRecursive("recursively", 5, "element")],
      planRefTo(EMPTY_PLAN),
      "node"
    );
    expect(policy?.code).toBe("recursively");
    expect(policy?.severity).toBe("warning");
    expect(policy?.target).toBe("element");
    expect(policy?.maxDepth).toBe(5);
  });

  it("keeps the plan reference LATE-bound", () => {
    let resolved = 0;
    const policy = resolveRecursion(
      [makeRecursive("recursively")],
      {
        resolve: () => {
          resolved += 1;
          return EMPTY_PLAN;
        },
      },
      "node"
    );
    expect(resolved).toBe(0);
    expect(policy?.plan.resolve()).toBe(EMPTY_PLAN);
    expect(resolved).toBe(1);
  });

  it("delegates the message to the rule", () => {
    const policy = resolveRecursion(
      [makeRecursive("recursively")],
      planRefTo(EMPTY_PLAN),
      "node"
    );
    expect(
      policy?.describe({}, { path: "node", value: null, code: "recursively" })
    ).toBe("recursively exceeded");
  });

  it("refuses two recursive rules and names the field and both codes", () => {
    const rules = [makeRecursive("first"), makeRecursive("second")];
    expect(() =>
      resolveRecursion(rules, unresolvablePlanRef(), "tree.node")
    ).toThrow(ConflictingRecursionError);
    expect(() =>
      resolveRecursion(rules, unresolvablePlanRef(), "tree.node")
    ).toThrow(/tree\.node.*first, second/);
  });

  it("freezes the policy", () => {
    const policy = resolveRecursion(
      [makeRecursive("recursively")],
      planRefTo(EMPTY_PLAN),
      "node"
    );
    expect(Object.isFrozen(policy)).toBe(true);
  });
});
