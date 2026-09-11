// ===========================================================================
// The ONE BranchExecutor. What matters is that a branch is a real plan run on
// the real engine — the same presence policies, the same array grouping, the
// same index stack — and that a composite sees only `ok` plus `causes`.
// ===========================================================================
import { PASS, fail } from "../../../src/types";
import type { CheckOutcome, RuleContext } from "../../../src/types";
import { createBranchExecutor } from "../../../src/runtime/run-branch";
import { runPlan } from "../../../src/runtime/run-plan";
import { makeTransform, requiredRule } from "../compile/rule-fixtures";
import { makeDetailedCheck } from "./runtime-fixtures";
import {
  branchOf,
  compositeOf,
  harnessFor,
  issueCodesOf,
  issuePathsOf,
  planOf,
} from "./plan/engine-fixtures";

const ROOT_CONTEXT: RuleContext = { root: {}, path: "" };
const failing = (code: string) =>
  makeDetailedCheck({ code, run: () => fail({}) });

describe("a branch is a plan run on the engine", () => {
  it("passes when the branch plan reports nothing", () => {
    const plan = planOf([{ path: "name", rules: [requiredRule()] }]);
    expect(
      createBranchExecutor().runBranch(plan, { name: "ada" }, ROOT_CONTEXT)
    ).toEqual(PASS);
  });

  it("fails with the branch issues as causes", () => {
    const plan = planOf([{ path: "name", rules: [requiredRule()] }]);
    const outcome = createBranchExecutor().runBranch(plan, {}, ROOT_CONTEXT);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.detail.causes?.map((issue) => issue.path)).toEqual(["name"]);
    expect(outcome.detail.causes?.map((issue) => issue.code)).toEqual([
      "required",
    ]);
  });

  it("re-bases the causes onto the path the composite is declared at", () => {
    const plan = planOf([{ path: "name", rules: [requiredRule()] }]);
    const outcome = createBranchExecutor().runBranch(
      plan,
      {},
      {
        root: {},
        path: "user",
      }
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.detail.causes?.map((issue) => issue.path)).toEqual([
      "user.name",
    ]);
  });

  it("runs a branch whose fields contain a wildcard", () => {
    const plan = planOf([{ path: "tags[*].id", rules: [requiredRule()] }]);
    const outcome = createBranchExecutor().runBranch(
      plan,
      { tags: [{ id: "a" }, {}] },
      ROOT_CONTEXT
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.detail.causes?.map((issue) => issue.path)).toEqual([
      "tags[1].id",
    ]);
  });

  it("never puts the branch's issues in the caller's sink", () => {
    const branchPlan = planOf([{ path: "name", rules: [requiredRule()] }]);
    const harness = harnessFor([], {});
    createBranchExecutor().runBranch(branchPlan, {}, ROOT_CONTEXT);
    expect(harness.sink.issues).toHaveLength(0);
  });

  it("never writes: a transform in a branch leaves the value alone", () => {
    let applied = 0;
    const plan = planOf([
      {
        path: "name",
        rules: [
          makeTransform((value) => {
            applied += 1;
            return value;
          }),
        ],
      },
    ]);
    const value = { name: "ada" };
    createBranchExecutor().runBranch(plan, value, ROOT_CONTEXT);
    expect(applied).toBe(0);
    expect(value).toEqual({ name: "ada" });
  });
});

describe("a composite reaches the engine through the executor", () => {
  function reduceAnyOf(): (value: unknown, ctx: RuleContext) => CheckOutcome {
    return () => PASS;
  }

  it("runs each branch as its own plan and reports which matched", () => {
    const composite = compositeOf(
      "oneOfSchema",
      [
        branchOf("#0", [], [{ path: "kind", rules: [requiredRule()] }]),
        branchOf("#1", [], [{ path: "other", rules: [requiredRule()] }]),
      ],
      (runners) => (value, ctx) => {
        const matched = runners.filter((r) => r.run(value, ctx).ok).length;
        return matched === 1 ? PASS : fail({ expected: 1, actual: matched });
      }
    );
    const root = { payload: { kind: "a" } };
    const harness = harnessFor(
      [{ path: "payload", rules: [composite] }],
      root,
      { abortEarly: false }
    );
    runPlan(harness.plan, root, harness.context);
    expect(harness.sink.issues).toHaveLength(0);
  });

  it("reports the composite's own code when no branch matched", () => {
    const composite = compositeOf(
      "oneOfSchema",
      [branchOf("#0", [], [{ path: "kind", rules: [requiredRule()] }])],
      (runners) => (value, ctx) => {
        const matched = runners.filter((r) => r.run(value, ctx).ok).length;
        return matched === 1 ? PASS : fail({ expected: 1, actual: matched });
      }
    );
    const root = { payload: {} };
    const harness = harnessFor([{ path: "payload", rules: [composite] }], root);
    runPlan(harness.plan, root, harness.context);
    expect(issueCodesOf(harness.sink)).toEqual(["oneOfSchema"]);
    expect(issuePathsOf(harness.sink)).toEqual(["payload"]);
  });

  it("accepts branches: [] — the boolean form of additionalProperties", () => {
    const composite = compositeOf("additionalProperties", [], (runners) => {
      expect(runners).toHaveLength(0);
      return reduceAnyOf();
    });
    const root = { extra: 1 };
    const harness = harnessFor([{ path: "extra", rules: [composite] }], root);
    expect(() => runPlan(harness.plan, root, harness.context)).not.toThrow();
    expect(harness.sink.issues).toHaveLength(0);
  });

  it("calls combine exactly once, at build time, not once per validation", () => {
    let combined = 0;
    const composite = compositeOf(
      "counted",
      [branchOf("#0", [failing("inner")])],
      () => {
        combined += 1;
        return () => PASS;
      }
    );
    const root = { a: 1 };
    const harness = harnessFor([{ path: "a", rules: [composite] }], root);
    expect(combined).toBe(1);
    runPlan(harness.plan, root, harness.context);
    runPlan(harness.plan, root, harness.context);
    expect(combined).toBe(1);
  });
});

// ===========================================================================
// A cause's message and its path describe the same failure, so they must name
// the same field.
//
// The branch plan runs against its own subject, so its fields are declared as
// `name` and know nothing about the composite sitting at `user`. Re-basing the
// issue afterwards fixes `path` — but the message was already rendered, and a
// plugin that interpolates the context path had rendered `name`. The consumer
// then read `path: "user.name"` beside `message: "... at name ..."`.
// ===========================================================================
describe("run-branch: what a cause says about where it happened", () => {
  it("renders the message against the same path the cause reports", () => {
    const named = makeDetailedCheck({
      code: "named",
      run: () => fail({}),
      describe: (_detail, ctx) => `failed at ${ctx.path}`,
    });
    const plan = planOf([{ path: "name", rules: [named] }]);
    const outcome = createBranchExecutor().runBranch(
      plan,
      { name: "ada" },
      {
        root: {},
        path: "user",
      }
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    const cause = outcome.detail.causes?.[0];
    expect(cause?.path).toBe("user.name");
    expect(cause?.message).toBe("failed at user.name");
  });
});
