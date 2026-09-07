// ===========================================================================
// The output side of a field run: what gets written back, and when a field
// re-enters a plan.
//
// validate() and parse() differ by exactly one flag here. The legacy tree had
// two engines instead, and only one of them checked skipForNull, so a
// transform ran on null down one path and not the other.
// ===========================================================================
import { PASS, fail } from "../../../../src/types";
import type { RuleContext } from "../../../../src/types";
import type { RecursionPolicy } from "../../../../src/compile/validation-plan.types";
import { runField } from "../../../../src/runtime/run-field";
import {
  makeGate,
  makeRecursive,
  makeTransform,
  optionalRule,
} from "../../compile/rule-fixtures";
import {
  compileFieldAt,
  createRunContext,
  createSink,
  makeDetailedCheck,
} from "../runtime-fixtures";

describe("transforms belong to parse() alone", () => {
  it("does not run one when shouldApplyTransforms is false", () => {
    let applied = 0;
    const outcome = runField(
      compileFieldAt({
        path: "name",
        rules: [
          makeTransform((value) => {
            applied += 1;
            return `${String(value)}!`;
          }),
        ],
      }),
      { name: "ada" },
      createRunContext({ shouldApplyTransforms: false })
    );
    expect(applied).toBe(0);
    expect(outcome).toEqual({ hasWriteBack: false });
  });

  it("applies them in declaration order and reports the final value", () => {
    const order: string[] = [];
    const outcome = runField(
      compileFieldAt({
        path: "name",
        rules: [
          makeTransform((value) => {
            order.push("trim");
            return String(value).trim();
          }),
          makeTransform((value) => {
            order.push("upper");
            return String(value).toUpperCase();
          }),
        ],
      }),
      { name: "  ada  " },
      createRunContext({ shouldApplyTransforms: true })
    );
    expect(order).toEqual(["trim", "upper"]);
    expect(outcome).toEqual({ hasWriteBack: true, value: "ADA" });
  });

  it("sees the value a default produced", () => {
    const outcome = runField(
      compileFieldAt({
        path: "role",
        rules: [makeTransform((value) => `${String(value)}-user`)],
        defaultOf: () => "guest",
      }),
      {},
      createRunContext({ shouldApplyTransforms: true })
    );
    expect(outcome).toEqual({ hasWriteBack: true, value: "guest-user" });
  });

  it("never runs on a field whose check failed", () => {
    let applied = 0;
    const sink = createSink({ abortEarlyOnEachField: false });
    const outcome = runField(
      compileFieldAt({
        path: "name",
        rules: [
          makeDetailedCheck({ code: "minLength", run: () => fail({}) }),
          makeTransform(() => {
            applied += 1;
            return "transformed";
          }),
        ],
      }),
      { name: "a" },
      createRunContext({ sink, shouldApplyTransforms: true })
    );
    expect(applied).toBe(0);
    expect(outcome).toEqual({ hasWriteBack: false });
  });

  it("never runs on a permitted absence", () => {
    let applied = 0;
    const outcome = runField(
      compileFieldAt({
        path: "nickname",
        rules: [
          optionalRule(),
          makeTransform(() => {
            applied += 1;
            return "transformed";
          }),
        ],
      }),
      {},
      createRunContext({ shouldApplyTransforms: true })
    );
    expect(applied).toBe(0);
    expect(outcome).toEqual({ hasWriteBack: false });
  });

  it("reports no write-back when the transform returned the value unchanged", () => {
    const outcome = runField(
      compileFieldAt({
        path: "name",
        rules: [makeTransform((value) => value)],
      }),
      { name: "ada" },
      createRunContext({ shouldApplyTransforms: true })
    );
    expect(outcome).toEqual({ hasWriteBack: false });
  });

  it("reports a write-back of undefined distinguishably", () => {
    const outcome = runField(
      compileFieldAt({
        path: "name",
        rules: [makeTransform(() => undefined)],
      }),
      { name: "ada" },
      createRunContext({ shouldApplyTransforms: true })
    );
    expect(outcome).toEqual({ hasWriteBack: true, value: undefined });
  });
});

describe("recursion is the field's last rule", () => {
  it("is never invoked for a field that declared none", () => {
    let calls = 0;
    runField(
      compileFieldAt({ path: "name", rules: [] }),
      { name: "ada" },
      createRunContext({
        runRecursion: () => {
          calls += 1;
        },
      })
    );
    expect(calls).toBe(0);
  });

  it("hands over the policy, the transformed value and the rule context", () => {
    const seen: [RecursionPolicy, unknown, RuleContext][] = [];
    runField(
      compileFieldAt({
        path: "node",
        rules: [
          makeRecursive("recursively", 7),
          makeTransform((value) => ({ marked: value })),
        ],
      }),
      { node: { child: null } },
      createRunContext({
        shouldApplyTransforms: true,
        runRecursion: (policy, value, ctx) => {
          seen.push([policy, value, ctx]);
        },
      })
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]?.[0].code).toBe("recursively");
    expect(seen[0]?.[0].maxDepth).toBe(7);
    expect(seen[0]?.[1]).toEqual({ marked: { child: null } });
    expect(seen[0]?.[2].path).toBe("node");
  });

  it("is skipped when the field already failed and the field abort is on", () => {
    let calls = 0;
    const runRecursion = () => {
      calls += 1;
    };
    runField(
      compileFieldAt({
        path: "node",
        rules: [
          makeDetailedCheck({ code: "object", run: () => fail({}) }),
          makeRecursive("recursively"),
        ],
      }),
      { node: {} },
      createRunContext({ sink: createSink(), runRecursion })
    );
    expect(calls).toBe(0);

    runField(
      compileFieldAt({
        path: "node",
        rules: [
          makeDetailedCheck({ code: "object", run: () => fail({}) }),
          makeRecursive("recursively"),
        ],
      }),
      { node: {} },
      createRunContext({
        sink: createSink({ abortEarlyOnEachField: false }),
        runRecursion,
      })
    );
    expect(calls).toBe(1);
  });

  it("is skipped by a closed gate and by a permitted absence", () => {
    let calls = 0;
    const runRecursion = () => {
      calls += 1;
    };
    runField(
      compileFieldAt({
        path: "node",
        rules: [
          makeGate("validateIf", () => false),
          makeRecursive("recursively"),
        ],
      }),
      { node: {} },
      createRunContext({ runRecursion })
    );
    runField(
      compileFieldAt({
        path: "node",
        rules: [optionalRule(), makeRecursive("recursively")],
      }),
      {},
      createRunContext({ runRecursion })
    );
    expect(calls).toBe(0);
  });

  it("still runs after a check that passed", () => {
    let calls = 0;
    runField(
      compileFieldAt({
        path: "node",
        rules: [
          makeDetailedCheck({ code: "object", run: () => PASS }),
          makeRecursive("recursively"),
        ],
      }),
      { node: {} },
      createRunContext({
        runRecursion: () => {
          calls += 1;
        },
      })
    );
    expect(calls).toBe(1);
  });
});
