// ===========================================================================
// Composite erasure.
//
// Two properties are load-bearing and neither is visible in the types:
//   1. `combine` is called ONCE, at build time, however often the check runs.
//      A combine on the hot path is exactly the legacy array-batch mistake.
//   2. what comes back is a PLAIN CompiledCheck. If a `kind` survived, L5
//      would have something left to classify, and the "no branch on the hot
//      path" design would be a claim rather than a fact.
//
// The five reductions are written out because ONE rule kind has to express all
// of them: allOf applies every branch, tupleBuilder applies branch i to element
// i, contains applies one branch to every element, patternProperties scatters
// over matching keys, and if/then/else routes. If the composite shape only fits
// "pick one branch", four of these five stop compiling.
// ===========================================================================
import { PASS, fail, isArray, isPlainObject } from "../../../../src/types";
import type { CheckOutcome, RuleContext } from "../../../../src/types";
import type {
  BranchRunner,
  CompositeBranch,
  CompositeCombine,
  CompositeRule,
} from "../../../../src/plugin-kit/compiled-rule";
import type { BranchExecutor } from "../../../../src/compile/branch-executor.port";
import type { CompiledCheck } from "../../../../src/compile/validation-plan.types";
import { compileComposite } from "../../../../src/compile/compile-composite";
import { compileSchema } from "../../../../src/compile/compile-schema";
import { makeCheck } from "../rule-fixtures";
import {
  ROOT_CONTEXT,
  branchOf,
  createRecordingExecutor,
  createRefusingExecutor,
} from "./plan-fixtures";
import type { ExecutorProbe } from "./plan-fixtures";

function compositeOf(
  code: string,
  branches: readonly CompositeBranch[],
  combine: CompositeCombine
): CompositeRule {
  return {
    kind: "composite",
    code,
    severity: "error",
    branches,
    combine,
    describe: (detail) => `${code} failed on ${String(detail.branch)}`,
  };
}

/** The production wiring: erasure reached the way compileSchema reaches it. */
function eraseThroughSchema(
  rule: CompositeRule,
  executor: BranchExecutor
): CompiledCheck {
  const plan = compileSchema([{ path: "subject", rules: [rule] }], executor);
  const check = plan.fields[0]?.checks[0];
  if (check === undefined) throw new Error("the composite was not erased");
  return check;
}

/** A branch that accepts only values equal to `accepted`. */
function acceptOnly(label: string, accepted: unknown): CompositeBranch {
  return branchOf(label, [
    makeCheck(label, (value) =>
      value === accepted ? PASS : fail({ expected: accepted, actual: value })
    ),
  ]);
}

describe("what compileComposite returns", () => {
  const probe = createRecordingExecutor();
  const check = eraseThroughSchema(
    compositeOf("oneOf", [acceptOnly("a", "a")], (runners) => {
      const only = runners[0];
      return (value, ruleContext) =>
        only === undefined ? PASS : only.run(value, ruleContext);
    }),
    probe.executor
  );

  it("is a plain CompiledCheck with no rule kind left on it", () => {
    expect("kind" in check).toBe(false);
    expect("branches" in check).toBe(false);
    expect("combine" in check).toBe(false);
    expect(Object.keys(check).sort()).toEqual([
      "code",
      "describe",
      "run",
      "severity",
    ]);
  });

  it("carries the composite's code and severity", () => {
    expect(check.code).toBe("oneOf");
    expect(check.severity).toBe("error");
  });

  it("still renders the composite's own message", () => {
    expect(
      check.describe(
        { branch: "a" },
        { path: "subject", value: 1, code: "oneOf" }
      )
    ).toBe("oneOf failed on a");
  });

  it("is frozen", () => {
    expect(Object.isFrozen(check)).toBe(true);
  });
});

describe("combine is called once, at build time", () => {
  function countCombineCalls(): {
    readonly check: CompiledCheck;
    count: () => number;
  } {
    let calls = 0;
    const probe = createRecordingExecutor();
    const check = eraseThroughSchema(
      compositeOf("allOf", [acceptOnly("a", "a")], (runners) => {
        calls += 1;
        const only = runners[0];
        return (value, ruleContext) =>
          only === undefined ? PASS : only.run(value, ruleContext);
      }),
      probe.executor
    );
    return { check, count: () => calls };
  }

  it("has already been called when compilation returns", () => {
    const { count } = countCombineCalls();
    expect(count()).toBe(1);
  });

  it("is not called again however often the check runs", () => {
    const { check, count } = countCombineCalls();
    for (let run = 0; run < 5; run += 1) check.run("a", ROOT_CONTEXT);
    expect(count()).toBe(1);
  });

  it("stores combine's result as the check's run BY IDENTITY", () => {
    const execute = (): CheckOutcome => PASS;
    const check = eraseThroughSchema(
      compositeOf("allOf", [acceptOnly("a", "a")], () => execute),
      createRefusingExecutor()
    );
    expect(check.run).toBe(execute);
  });
});

describe("branch compilation happens once and is reused", () => {
  it("compiles each branch plan exactly once, in branch order", () => {
    const compiled: string[] = [];
    const probe = createRecordingExecutor();
    const rule = compositeOf(
      "anyOf",
      [acceptOnly("a", "a"), acceptOnly("b", "b")],
      (runners) => (value, ruleContext) =>
        runners.some((runner) => runner.run(value, ruleContext).ok)
          ? PASS
          : fail({ actual: value })
    );
    const check = compileComposite(rule, {
      executor: probe.executor,
      compileBranchPlan: (branch) => {
        compiled.push(branch.label);
        return compileSchema([], probe.executor);
      },
    });
    expect(compiled).toEqual(["a", "b"]);
    check.run("a", ROOT_CONTEXT);
    check.run("a", ROOT_CONTEXT);
    expect(compiled).toEqual(["a", "b"]);
  });

  it("hands the executor the SAME plan object on every run", () => {
    const probe = createRecordingExecutor();
    const check = eraseThroughSchema(
      compositeOf(
        "anyOf",
        [acceptOnly("a", "a"), acceptOnly("b", "b")],
        (runners) => (value, ruleContext) =>
          runners.some((runner) => runner.run(value, ruleContext).ok)
            ? PASS
            : fail({ actual: value })
      ),
      probe.executor
    );
    check.run("b", ROOT_CONTEXT);
    check.run("b", ROOT_CONTEXT);
    expect(probe.plansSeen).toHaveLength(4);
    expect(new Set(probe.plansSeen).size).toBe(2);
  });

  it("executes no branch during compilation", () => {
    expect(() =>
      eraseThroughSchema(
        compositeOf("allOf", [acceptOnly("a", "a")], (runners) => {
          const only = runners[0];
          return (value, ruleContext) =>
            only === undefined ? PASS : only.run(value, ruleContext);
        }),
        createRefusingExecutor()
      )
    ).not.toThrow();
  });

  it("gives runners[i] the label of branches[i]", () => {
    let labels: readonly string[] = [];
    eraseThroughSchema(
      compositeOf(
        "tuple",
        [acceptOnly("first", 1), acceptOnly("second", 2)],
        (runners) => {
          labels = runners.map((runner) => runner.label);
          return () => PASS;
        }
      ),
      createRefusingExecutor()
    );
    expect(labels).toEqual(["first", "second"]);
  });
});

// ------------------------------------------------------------ the reductions

function runAll(runners: readonly BranchRunner[]) {
  return (value: unknown, ruleContext: RuleContext): CheckOutcome => {
    for (const runner of runners) {
      const outcome = runner.run(value, ruleContext);
      if (!outcome.ok) return fail({ branch: runner.label });
    }
    return PASS;
  };
}

function runPositional(runners: readonly BranchRunner[]) {
  return (value: unknown, ruleContext: RuleContext): CheckOutcome => {
    if (!isArray(value)) return fail({ expected: "array" });
    for (let index = 0; index < runners.length; index += 1) {
      const runner = runners[index];
      if (runner === undefined) continue;
      if (!runner.run(value[index], ruleContext).ok) {
        return fail({ branch: runner.label, index });
      }
    }
    return PASS;
  };
}

function runExistential(runners: readonly BranchRunner[], min: number) {
  return (value: unknown, ruleContext: RuleContext): CheckOutcome => {
    const matcher = runners[0];
    if (matcher === undefined || !isArray(value))
      return fail({ expected: min });
    let matched = 0;
    for (const element of value) {
      if (matcher.run(element, ruleContext).ok) matched += 1;
    }
    return matched >= min ? PASS : fail({ expected: min, actual: matched });
  };
}

function runScatter(runners: readonly BranchRunner[], pattern: RegExp) {
  return (value: unknown, ruleContext: RuleContext): CheckOutcome => {
    const matcher = runners[0];
    if (matcher === undefined || !isPlainObject(value)) return PASS;
    for (const [key, member] of Object.entries(value)) {
      if (!pattern.test(key)) continue;
      if (!matcher.run(member, ruleContext).ok) return fail({ branch: key });
    }
    return PASS;
  };
}

function runRouting(runners: readonly BranchRunner[]) {
  return (value: unknown, ruleContext: RuleContext): CheckOutcome => {
    const [condition, whenTrue, whenFalse] = runners;
    if (condition === undefined) return PASS;
    const taken = condition.run(value, ruleContext).ok ? whenTrue : whenFalse;
    if (taken === undefined) return PASS;
    return taken.run(value, ruleContext).ok
      ? PASS
      : fail({ branch: taken.label });
  };
}

describe("all five reductions compile from ONE rule kind", () => {
  function erase(
    code: string,
    branches: readonly CompositeBranch[],
    combine: CompositeCombine
  ): { readonly check: CompiledCheck; readonly probe: ExecutorProbe } {
    const probe = createRecordingExecutor();
    return {
      check: eraseThroughSchema(
        compositeOf(code, branches, combine),
        probe.executor
      ),
      probe,
    };
  }

  it("all-apply: every branch must pass", () => {
    const { check } = erase(
      "allOf",
      [acceptOnly("a", 1), acceptOnly("b", 1)],
      (runners) => runAll(runners)
    );
    expect(check.run(1, ROOT_CONTEXT).ok).toBe(true);
    expect(check.run(2, ROOT_CONTEXT)).toEqual({
      ok: false,
      detail: { branch: "a" },
    });
  });

  it("positional: branch i applies to element i", () => {
    const { check } = erase(
      "tuple",
      [acceptOnly("first", "x"), acceptOnly("second", "y")],
      (runners) => runPositional(runners)
    );
    expect(check.run(["x", "y"], ROOT_CONTEXT).ok).toBe(true);
    expect(check.run(["x", "z"], ROOT_CONTEXT)).toEqual({
      ok: false,
      detail: { branch: "second", index: 1 },
    });
  });

  it("existential: one branch applies to every element", () => {
    const { check } = erase("contains", [acceptOnly("hit", 7)], (runners) =>
      runExistential(runners, 2)
    );
    expect(check.run([7, 1, 7], ROOT_CONTEXT).ok).toBe(true);
    expect(check.run([7, 1, 1], ROOT_CONTEXT)).toEqual({
      ok: false,
      detail: { expected: 2, actual: 1 },
    });
  });

  it("scatter: one branch applies to every matching KEY", () => {
    const { check } = erase(
      "patternProperties",
      [acceptOnly("value", 1)],
      (runners) => runScatter(runners, /^n/)
    );
    expect(check.run({ n1: 1, n2: 1, other: 9 }, ROOT_CONTEXT).ok).toBe(true);
    expect(check.run({ n1: 1, n2: 9 }, ROOT_CONTEXT)).toEqual({
      ok: false,
      detail: { branch: "n2" },
    });
  });

  it("routing: the condition picks then or else", () => {
    const { check } = erase(
      "conditionalSchema",
      [
        acceptOnly("if", "go"),
        acceptOnly("then", "go"),
        acceptOnly("else", "stop"),
      ],
      (runners) => runRouting(runners)
    );
    expect(check.run("go", ROOT_CONTEXT).ok).toBe(true);
    expect(check.run("stop", ROOT_CONTEXT).ok).toBe(true);
    expect(check.run("other", ROOT_CONTEXT)).toEqual({
      ok: false,
      detail: { branch: "else" },
    });
  });
});

describe("a branch carries fields, wildcards included", () => {
  it("compiles branch fields into the branch plan", () => {
    const probe = createRecordingExecutor();
    const check = eraseThroughSchema(
      compositeOf(
        "properties",
        [
          branchOf(
            "shape",
            [],
            [
              {
                path: "name",
                rules: [
                  makeCheck("isName", (value) =>
                    value === "ada" ? PASS : fail({})
                  ),
                ],
              },
            ]
          ),
        ],
        (runners) => runAll(runners)
      ),
      probe.executor
    );
    expect(check.run({ name: "ada" }, ROOT_CONTEXT).ok).toBe(true);
    expect(check.run({ name: "eve" }, ROOT_CONTEXT).ok).toBe(false);
  });

  it("compiles a branch field whose path contains [*] into an array node", () => {
    const probe = createRecordingExecutor();
    const check = eraseThroughSchema(
      compositeOf(
        "properties",
        [
          branchOf(
            "shape",
            [],
            [
              {
                path: "tags[*].label",
                rules: [
                  makeCheck("isLabel", (value) =>
                    typeof value === "string" ? PASS : fail({})
                  ),
                ],
              },
            ]
          ),
        ],
        (runners) => runAll(runners)
      ),
      probe.executor
    );
    check.run({ tags: [{ label: "ok" }] }, ROOT_CONTEXT);
    const branchPlan = probe.plansSeen[0];
    expect(branchPlan?.fields).toHaveLength(0);
    expect(branchPlan?.arrays).toHaveLength(1);
    expect(check.run({ tags: [{ label: "ok" }] }, ROOT_CONTEXT).ok).toBe(true);
    expect(check.run({ tags: [{ label: 9 }] }, ROOT_CONTEXT).ok).toBe(false);
  });

  it("omits the subject entry when a branch declares no rules of its own", () => {
    const probe = createRecordingExecutor();
    const check = eraseThroughSchema(
      compositeOf(
        "properties",
        [
          branchOf(
            "shape",
            [],
            [{ path: "name", rules: [makeCheck("isName")] }]
          ),
        ],
        (runners) => runAll(runners)
      ),
      probe.executor
    );
    check.run({ name: "ada" }, ROOT_CONTEXT);
    expect(probe.plansSeen[0]?.fields).toHaveLength(1);
  });
});
