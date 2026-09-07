// ===========================================================================
// The engine loop itself: order, the object-level abort, and the fact that a
// run which produces no output hands back the very object it was given.
// ===========================================================================
import { PASS, fail } from "../../../src/types";
import { prefixIssuePaths, runPlan } from "../../../src/runtime/run-plan";
import {
  NO_WRITE_TARGETS,
  createArrayWriteTargets,
} from "../../../src/runtime/output-writer";
import { makeTransform, requiredRule } from "../compile/rule-fixtures";
import { makeDetailedCheck } from "./runtime-fixtures";
import { harnessFor, issueCodesOf, planOf } from "./plan/engine-fixtures";

const failing = (code: string) =>
  makeDetailedCheck({ code, run: () => fail({}) });

describe("field order and the object-level abort", () => {
  it("runs the fields in declaration order", () => {
    const order: string[] = [];
    const root = { a: 1, b: 2, c: 3 };
    const record = (name: string) =>
      makeDetailedCheck({
        code: name,
        run: () => {
          order.push(name);
          return PASS;
        },
      });
    const harness = harnessFor(
      [
        { path: "b", rules: [record("b")] },
        { path: "a", rules: [record("a")] },
        { path: "c", rules: [record("c")] },
      ],
      root
    );
    runPlan(harness.plan, root, harness.context);
    expect(order).toEqual(["b", "a", "c"]);
  });

  it("stops after the first FAILING FIELD when abortEarly is on", () => {
    const root = { a: 1, b: 2 };
    const harness = harnessFor(
      [
        { path: "a", rules: [failing("first")] },
        { path: "b", rules: [failing("second")] },
      ],
      root,
      { abortEarly: true }
    );
    runPlan(harness.plan, root, harness.context);
    expect(issueCodesOf(harness.sink)).toEqual(["first"]);
  });

  it("collects every field when abortEarly is off", () => {
    const root = { a: 1, b: 2 };
    const harness = harnessFor(
      [
        { path: "a", rules: [failing("first")] },
        { path: "b", rules: [failing("second")] },
      ],
      root,
      { abortEarly: false }
    );
    runPlan(harness.plan, root, harness.context);
    expect(issueCodesOf(harness.sink)).toEqual(["first", "second"]);
  });

  it("does not reach the array nodes once the plan has stopped", () => {
    const root = { a: 1, items: [{ name: undefined }] };
    const harness = harnessFor(
      [
        { path: "a", rules: [failing("first")] },
        { path: "items[*].name", rules: [requiredRule()] },
      ],
      root,
      { abortEarly: true }
    );
    runPlan(harness.plan, root, harness.context);
    expect(issueCodesOf(harness.sink)).toEqual(["first"]);
  });
});

describe("what a run gives back", () => {
  it("returns the subject by identity when nothing writes", () => {
    const root = { a: 1 };
    const harness = harnessFor([{ path: "a", rules: [] }], root);
    expect(runPlan(harness.plan, root, harness.context)).toBe(root);
  });

  it("does NOT write a default when shouldApplyTransforms is false", () => {
    const root = { name: "ada" };
    const harness = harnessFor(
      [{ path: "role", rules: [], defaultOf: () => "guest" }],
      root,
      { shouldApplyTransforms: false }
    );
    expect(runPlan(harness.plan, root, harness.context)).toBe(root);
  });

  it("writes the default when the run produces output", () => {
    const root = { name: "ada" };
    const harness = harnessFor(
      [{ path: "role", rules: [], defaultOf: () => "guest" }],
      root,
      { shouldApplyTransforms: true }
    );
    const output = runPlan(harness.plan, root, harness.context);
    expect(output).toEqual({ name: "ada", role: "guest" });
    expect(root).toEqual({ name: "ada" });
  });

  it("lets a later field read what an earlier transform wrote", () => {
    const seen: unknown[] = [];
    const root = { a: { b: 1 } };
    const harness = harnessFor(
      [
        { path: "a", rules: [makeTransform(() => ({ b: 99 }))] },
        {
          path: "a.b",
          rules: [
            makeDetailedCheck({
              code: "observe",
              run: (value) => {
                seen.push(value);
                return PASS;
              },
            }),
          ],
        },
      ],
      root,
      { shouldApplyTransforms: true }
    );
    runPlan(harness.plan, root, harness.context);
    expect(seen).toEqual([99]);
  });

  it("keeps context.root at the ORIGINAL input for cross-field rules", () => {
    const seen: unknown[] = [];
    const root = { a: "before", b: 1 };
    const harness = harnessFor(
      [
        { path: "a", rules: [makeTransform(() => "after")] },
        {
          path: "b",
          rules: [
            makeDetailedCheck({
              code: "observe",
              run: (_value, ctx) => {
                seen.push(ctx.root);
                return PASS;
              },
            }),
          ],
        },
      ],
      root,
      { shouldApplyTransforms: true }
    );
    runPlan(harness.plan, root, harness.context);
    expect(seen).toEqual([root]);
  });

  it("threads the array write targets through to the nodes", () => {
    const root = { items: ["a"] };
    const harness = harnessFor(
      [{ path: "items[*]", rules: [makeTransform((v) => String(v) + "!")] }],
      root,
      { shouldApplyTransforms: true }
    );
    expect(
      runPlan(
        harness.plan,
        root,
        harness.context,
        createArrayWriteTargets(harness.plan.arrays)
      )
    ).toEqual({ items: ["a!"] });
    expect(runPlan(harness.plan, root, harness.context, NO_WRITE_TARGETS)).toBe(
      root
    );
  });
});

describe("prefixIssuePaths", () => {
  it("returns the very same list for the root prefix", () => {
    const issues = Object.freeze([
      { path: "name", code: "c", message: "m", severity: "error" as const },
    ]);
    expect(prefixIssuePaths("", issues)).toBe(issues);
  });

  it("joins with a dot and keeps an index attached", () => {
    const issues = [
      { path: "name", code: "c", message: "m", severity: "error" as const },
      { path: "tags[2]", code: "d", message: "m", severity: "error" as const },
      { path: "", code: "e", message: "m", severity: "error" as const },
    ];
    expect(prefixIssuePaths("user", issues).map((i) => i.path)).toEqual([
      "user.name",
      "user.tags[2]",
      "user",
    ]);
  });

  it("does not mutate the issues it was given", () => {
    const issue = {
      path: "name",
      code: "c",
      message: "m",
      severity: "error" as const,
    };
    prefixIssuePaths("user", [issue]);
    expect(issue.path).toBe("name");
  });
});

describe("a plan with nothing in it", () => {
  it("runs to completion and reports nothing", () => {
    const plan = planOf([]);
    const harness = harnessFor([], {});
    const root = {};
    expect(runPlan(plan, root, harness.context)).toBe(root);
    expect(harness.sink.issues).toHaveLength(0);
  });
});
