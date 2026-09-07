// ===========================================================================
// The L4 -> L5 inversion port.
//
// The port is a type, so what can be checked here is what the type PERMITS: an
// implementation that takes (plan, value, ctx) and answers a CheckOutcome, and
// that receives the RuleContext — external included — unchanged. L5's
// run-branch is the only implementation, and step 12 asserts that it calls
// runPlan; this suite guards the shape those two agree on.
// ===========================================================================
import { PASS, fail } from "../../../src/types";
import type { RuleContext } from "../../../src/types";
import type { BranchExecutor } from "../../../src/compile/branch-executor.port";
import type { ValidationPlan } from "../../../src/compile/validation-plan.types";
import { compileFieldDeclaration } from "../../../src/compile/compile-field";
import {
  EMPTY_PLAN,
  makeCheck,
  refuseComposite,
  unresolvablePlanRef,
} from "./rule-fixtures";

interface RecordedCall {
  readonly plan: ValidationPlan;
  readonly value: unknown;
  readonly ctx: RuleContext;
}

function recordingExecutor(into: RecordedCall[]): BranchExecutor {
  return {
    runBranch: (plan, value, ctx) => {
      into.push({ plan, value, ctx });
      return value === undefined ? fail({ actual: value }) : PASS;
    },
  };
}

describe("BranchExecutor", () => {
  it("accepts an implementation and answers a CheckOutcome", () => {
    const calls: RecordedCall[] = [];
    const executor = recordingExecutor(calls);
    expect(
      executor.runBranch(EMPTY_PLAN, "ada", { root: {}, path: "" })
    ).toEqual(PASS);
    const rejected = executor.runBranch(EMPTY_PLAN, undefined, {
      root: {},
      path: "",
    });
    expect(rejected.ok).toBe(false);
  });

  it("receives the plan, the value and the RuleContext verbatim", () => {
    const calls: RecordedCall[] = [];
    const externalContext = Object.freeze({ token: "resolved-by-async" });
    const ctx: RuleContext = {
      root: { name: "ada" },
      path: "name",
      external: externalContext,
    };
    recordingExecutor(calls).runBranch(EMPTY_PLAN, "ada", ctx);
    expect(calls[0]?.plan).toBe(EMPTY_PLAN);
    expect(calls[0]?.value).toBe("ada");
    expect(calls[0]?.ctx).toBe(ctx);
    expect(calls[0]?.ctx.external).toBe(externalContext);
  });

  it("is NOT reachable from compile-field: L4 part 1 executes nothing", () => {
    const calls: RecordedCall[] = [];
    recordingExecutor(calls);
    compileFieldDeclaration(
      { path: "name", rules: [makeCheck("minLength")] },
      unresolvablePlanRef(),
      refuseComposite()
    );
    expect(calls).toEqual([]);
  });
});
