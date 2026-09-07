// ===========================================================================
// `objectRecursively` executed. The plan is genuinely self-referential — the
// PlanRef compileSchema back-patched points at the plan under test — so a
// runner that failed to terminate would hang this suite rather than pass it.
// ===========================================================================
import { fail } from "../../../src/types";
import { runPlan } from "../../../src/runtime/run-plan";
import { RECURSION_ABORT_POLICY } from "../../../src/runtime/run-recursion";
import { makeRecursive, requiredRule } from "../compile/rule-fixtures";
import { makeDetailedCheck } from "./runtime-fixtures";
import { harnessFor, issueCodesOf, issuePathsOf } from "./plan/engine-fixtures";

const SELF_RECURSIVE = [
  { path: "name", rules: [requiredRule()] },
  { path: "child", rules: [makeRecursive("recursively", 10)] },
];

describe("re-entering the plan", () => {
  it("applies the plan to the nested value and reports under the full path", () => {
    const root = { name: "a", child: { name: undefined, child: undefined } };
    const harness = harnessFor(SELF_RECURSIVE, root, { abortEarly: false });
    runPlan(harness.plan, root, harness.context);
    expect(issuePathsOf(harness.sink)).toEqual(["child.name"]);
  });

  it("keeps prefixing at every level of the descent", () => {
    const root = {
      name: "a",
      child: { name: "b", child: { name: "c", child: { child: undefined } } },
    };
    const harness = harnessFor(SELF_RECURSIVE, root, { abortEarly: false });
    runPlan(harness.plan, root, harness.context);
    expect(issuePathsOf(harness.sink)).toEqual(["child.child.child.name"]);
  });

  it("does nothing at all when the nested value is absent", () => {
    const root = { name: "a" };
    const harness = harnessFor(SELF_RECURSIVE, root, { abortEarly: false });
    runPlan(harness.plan, root, harness.context);
    expect(harness.sink.issues).toHaveLength(0);
  });
});

describe("termination", () => {
  it("stops on a cycle WITHOUT reporting anything", () => {
    const cyclic: Record<string, unknown> = { name: "a" };
    cyclic.child = cyclic;
    const harness = harnessFor(SELF_RECURSIVE, cyclic, { abortEarly: false });
    runPlan(harness.plan, cyclic, harness.context);
    expect(harness.sink.issues).toHaveLength(0);
  });

  it("stops on a two-step cycle", () => {
    const first: Record<string, unknown> = { name: "a" };
    const second: Record<string, unknown> = { name: "b", child: first };
    first.child = second;
    const harness = harnessFor(SELF_RECURSIVE, first, { abortEarly: false });
    runPlan(harness.plan, first, harness.context);
    expect(harness.sink.issues).toHaveLength(0);
  });

  it("REPORTS at maxDepth under the recursive rule's own code", () => {
    const deep = (levels: number): Record<string, unknown> =>
      levels === 0 ? { name: "leaf" } : { name: "n", child: deep(levels - 1) };
    const root = deep(5);
    const harness = harnessFor(
      [
        { path: "name", rules: [requiredRule()] },
        { path: "child", rules: [makeRecursive("recursively", 2)] },
      ],
      root,
      { abortEarly: false }
    );
    runPlan(harness.plan, root, harness.context);
    expect(issueCodesOf(harness.sink)).toEqual(["recursively"]);
    expect(issuePathsOf(harness.sink)).toEqual(["child.child.child"]);
    expect(harness.sink.issues[0]?.severity).toBe("warning");
  });

  it("does not report when the structure is shallower than maxDepth", () => {
    const root = { name: "a", child: { name: "b" } };
    const harness = harnessFor(
      [
        { path: "name", rules: [requiredRule()] },
        { path: "child", rules: [makeRecursive("recursively", 2)] },
      ],
      root,
      { abortEarly: false }
    );
    runPlan(harness.plan, root, harness.context);
    expect(harness.sink.issues).toHaveLength(0);
  });

  it("lets a sibling subtree be revisited: the guard is the PATH, not history", () => {
    const shared: Record<string, unknown> = { name: undefined };
    const root = {
      name: "a",
      children: [{ child: shared }, { child: shared }],
    };
    const harness = harnessFor(
      [
        { path: "name", rules: [requiredRule()] },
        { path: "children[*].child", rules: [makeRecursive("recursively", 5)] },
      ],
      root,
      { abortEarly: false }
    );
    runPlan(harness.plan, root, harness.context);
    expect(issuePathsOf(harness.sink)).toEqual([
      "children[0].child.name",
      "children[1].child.name",
    ]);
  });
});

describe("target: element", () => {
  it("applies the plan to every element and indexes the path", () => {
    const root = {
      name: "a",
      children: [{ name: "b" }, { name: undefined }, { name: undefined }],
    };
    const harness = harnessFor(
      [
        { path: "name", rules: [requiredRule()] },
        {
          path: "children",
          rules: [makeRecursive("recursivelyEach", 5, "element")],
        },
      ],
      root,
      { abortEarly: false }
    );
    runPlan(harness.plan, root, harness.context);
    expect(issuePathsOf(harness.sink)).toEqual([
      "children[1].name",
      "children[2].name",
    ]);
  });

  it("is vacuous when the value is not an array", () => {
    const root = { name: "a", children: "nope" };
    const harness = harnessFor(
      [
        { path: "name", rules: [requiredRule()] },
        {
          path: "children",
          rules: [makeRecursive("recursivelyEach", 5, "element")],
        },
      ],
      root,
      { abortEarly: false }
    );
    runPlan(harness.plan, root, harness.context);
    expect(harness.sink.issues).toHaveLength(0);
  });
});

describe("what a re-entry may not do", () => {
  it("never aborts between the fields of the nested plan", () => {
    expect(RECURSION_ABORT_POLICY).toEqual({
      abortEarly: false,
      abortEarlyOnEachField: false,
    });
    const root = { child: { a: 1, b: 2 }, a: 1, b: 2 };
    const harness = harnessFor(
      [
        {
          path: "child",
          rules: [makeRecursive("recursively", 3)],
        },
        {
          path: "a",
          rules: [makeDetailedCheck({ code: "aFails", run: () => fail({}) })],
        },
        {
          path: "b",
          rules: [makeDetailedCheck({ code: "bFails", run: () => fail({}) })],
        },
      ],
      root,
      { abortEarly: false, abortEarlyOnEachField: true }
    );
    runPlan(harness.plan, root, harness.context);
    expect(issuePathsOf(harness.sink)).toEqual([
      "child.a",
      "child.b",
      "a",
      "b",
    ]);
  });
});
