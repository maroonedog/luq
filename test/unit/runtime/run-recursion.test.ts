// ===========================================================================
// `objectRecursively` executed. The plan is genuinely self-referential — the
// PlanRef compileSchema back-patched points at the plan under test — so a
// runner that failed to terminate would hang this suite rather than pass it.
// ===========================================================================
import { fail } from "../../../src/types";
import { recursive } from "../../../src/plugin-kit/create-rule";
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

/**
 * A recursive rule that says what the runtime handed it. The catalogue plugin
 * renders `detail.expected` only, so `actual` — the depth the descent had
 * already spent when this rule's limit was reached — has no other way of
 * being observed from outside the runtime.
 */
function budgetRule(code: string, maxDepth: number) {
  return recursive({
    code,
    severity: "warning",
    target: "self",
    maxDepth,
    describe: (detail) =>
      `expected=${String(detail.expected)} actual=${String(detail.actual)}`,
    buildMessageContext: () => ({}),
  });
}

describe("run-recursion: the depth budget", () => {
  it("hands the budget back as the descent unwinds, so each sibling gets it whole", () => {
    const branch = () => ({ name: "b", children: [{ name: "leaf" }] });
    const treeOfThree = () => ({
      name: "a",
      children: [branch(), branch(), branch()],
    });
    const declare = (maxDepth: number) => [
      { path: "name", rules: [requiredRule()] },
      {
        path: "children",
        rules: [makeRecursive("recursivelyEach", maxDepth, "element")],
      },
    ];

    // Three branches, each exactly two levels deep, against a budget of two:
    // the budget limits how FAR a descent goes, never how many nodes it sees,
    // so every branch is walked to its leaf and nothing is reported.
    const roomy = treeOfThree();
    const roomyHarness = harnessFor(declare(2), roomy, { abortEarly: false });
    runPlan(roomyHarness.plan, roomy, roomyHarness.context);
    expect(roomyHarness.sink.issues).toHaveLength(0);

    // The same three branches against a budget of one. This is what makes the
    // silence above load-bearing: the descent really does reach the second
    // level, and each branch is stopped there INDEPENDENTLY — one report per
    // branch, none of them starved by a sibling that went first.
    const tight = treeOfThree();
    const tightHarness = harnessFor(declare(1), tight, { abortEarly: false });
    runPlan(tightHarness.plan, tight, tightHarness.context);
    expect(issuePathsOf(tightHarness.sink)).toEqual([
      "children[0].children[0]",
      "children[1].children[0]",
      "children[2].children[0]",
    ]);
  });

  it("exhausts the budget before the cycle guard ever sees the repeat", () => {
    const cyclic: Record<string, unknown> = { name: "a" };
    cyclic.child = cyclic;
    const harness = harnessFor(
      [
        { path: "name", rules: [requiredRule()] },
        { path: "child", rules: [makeRecursive("recursively", 1)] },
      ],
      cyclic,
      { abortEarly: false }
    );
    runPlan(harness.plan, cyclic, harness.context);
    // The same cycle that a roomier budget silences is REPORTED here: depth
    // is tested first, and a budget of one is spent by the single hop that
    // would have put the repeated node into the visited set.
    expect(issueCodesOf(harness.sink)).toEqual(["recursively"]);
    expect(issuePathsOf(harness.sink)).toEqual(["child.child"]);
  });

  it("reports a ring the budget runs out on, and silences the same ring when the budget outlasts it", () => {
    const ring = (): Record<string, unknown> => {
      const first: Record<string, unknown> = { name: "a" };
      const second: Record<string, unknown> = { name: "b" };
      const third: Record<string, unknown> = { name: "c" };
      first.child = second;
      second.child = third;
      third.child = first;
      return first;
    };
    const declare = (maxDepth: number) => [
      { path: "name", rules: [requiredRule()] },
      { path: "child", rules: [makeRecursive("recursively", maxDepth)] },
    ];
    const tight = ring();
    const tightHarness = harnessFor(declare(2), tight, { abortEarly: false });
    runPlan(tightHarness.plan, tight, tightHarness.context);
    expect(issuePathsOf(tightHarness.sink)).toEqual(["child.child.child"]);

    const roomy = ring();
    const roomyHarness = harnessFor(declare(10), roomy, { abortEarly: false });
    runPlan(roomyHarness.plan, roomy, roomyHarness.context);
    expect(roomyHarness.sink.issues).toHaveLength(0);
  });

  it("reports the depth already spent, which a second budget can push past its own limit", () => {
    const root = {
      name: "a",
      deep: { name: "b", deep: { name: "c", shallow: { name: "d" } } },
    };
    const harness = harnessFor(
      [
        { path: "name", rules: [requiredRule()] },
        { path: "deep", rules: [budgetRule("deep", 5)] },
        { path: "shallow", rules: [budgetRule("shallow", 1)] },
      ],
      root,
      { abortEarly: false }
    );
    runPlan(harness.plan, root, harness.context);
    // Two recursive fields, two limits, ONE counter: the descent spent two
    // levels under the roomy budget before meeting the tight one, so the
    // depth reached is larger than the limit that reported it.
    expect(harness.sink.issues).toEqual([
      {
        path: "deep.deep.shallow",
        code: "shallow",
        message: "expected=1 actual=2",
        severity: "warning",
      },
    ]);
  });
});

describe("run-recursion: a value the cycle guard cannot hold", () => {
  it("descends into a value that is not an object at all", () => {
    // A string reaches the descent whenever the field's checks failed without
    // aborting. Nothing about it can be remembered — a WeakSet refuses a
    // primitive — and the plan simply runs against it, reading every field as
    // absent.
    const root = { name: "a", child: "not an object" };
    const harness = harnessFor(SELF_RECURSIVE, root, { abortEarly: false });
    runPlan(harness.plan, root, harness.context);
    expect(issuePathsOf(harness.sink)).toEqual(["child.name"]);
    expect(issueCodesOf(harness.sink)).toEqual(["required"]);
  });
});

// ===========================================================================
// An issue's message and its path describe the same failure, so they must name
// the same field.
//
// The plan is declared relative to its own subject: its field is `name`, and it
// knows nothing about having been re-entered from `child`. Re-basing the issue
// after the descent fixes `path` — but the message was rendered while the
// descent was still inside, against `name`. A plugin whose messageFactory
// interpolates the context path therefore named one field while the issue
// beside it reported another, for every level below the first.
// ===========================================================================
describe("run-recursion: what an issue says about where it happened", () => {
  const naming = makeDetailedCheck({
    code: "naming",
    run: () => fail({}),
    describe: (_detail, ctx) => `failed at ${ctx.path}`,
  });
  const NAMED_RECURSIVE = [
    { path: "name", rules: [naming] },
    { path: "child", rules: [makeRecursive("recursively", 10)] },
  ];

  it("renders the message against the full path, one level down", () => {
    const root = { name: "a", child: { name: "b" } };
    const harness = harnessFor(NAMED_RECURSIVE, root, { abortEarly: false });
    runPlan(harness.plan, root, harness.context);
    expect(issuePathsOf(harness.sink)).toEqual(["name", "child.name"]);
    expect(harness.sink.issues.map((issue) => issue.message)).toEqual([
      "failed at name",
      "failed at child.name",
    ]);
  });

  it("keeps doing it as the descent deepens", () => {
    const root = { name: "a", child: { name: "b", child: { name: "c" } } };
    const harness = harnessFor(NAMED_RECURSIVE, root, { abortEarly: false });
    runPlan(harness.plan, root, harness.context);
    expect(harness.sink.issues.map((issue) => issue.message)).toEqual([
      "failed at name",
      "failed at child.name",
      "failed at child.child.name",
    ]);
  });

  it("renders the depth-limit message against the full path too", () => {
    const cyclic: Record<string, unknown> = { name: "a" };
    cyclic.child = { name: "b", child: cyclic };
    const limited = [
      { path: "child", rules: [makeRecursive("recursively", 2)] },
    ];
    const harness = harnessFor(limited, cyclic, { abortEarly: false });
    runPlan(harness.plan, cyclic, harness.context);
    expect(issuePathsOf(harness.sink)).toEqual(["child.child.child"]);
    // `makeRecursive` describes without reading the context, so the wording
    // itself proves nothing here; the path is what this pins. The message is
    // asserted in the two tests above, where the factory names the path.
    expect(harness.sink.issues.map((issue) => issue.code)).toEqual([
      "recursively",
    ]);
  });
});
