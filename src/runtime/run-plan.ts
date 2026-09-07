// ===========================================================================
// L5  src/runtime/run-plan.ts — THE ONE ENGINE LOOP.
//
// Fields first, in declaration order, then the array nodes. That is the whole
// of it: every decision about what a rule is, which reader to call, whether
// there is a writer, and which array a declaration belongs to was taken by L4.
// Nothing in this file inspects a Rule, and nothing here can reach a plugin.
//
// It is the ONLY traversal in the library. A branch runs through it
// (run-branch, the single BranchExecutor), a recursive re-entry runs through it
// (run-recursion), and the public validate/parse pair runs through it
// (create-validator). The legacy tree had three traversals — the fast path, the
// slow path and the nested-array processor — which is how a rule could apply
// down one and not another.
//
// `subject` in, subject out. The return value is the possibly-rebuilt subject:
// copy-on-write means a run that writes cannot report through its argument, and
// a run that writes nothing returns the very object it was handed.
// ===========================================================================
import type { ValidationIssue } from "../types";
import type { ValidationPlan } from "../compile/validation-plan.types";
import { joinIssuePath } from "./index-stack";
import { runArrayNodes } from "./run-array-node";
import { runField } from "./run-field";
import type { FieldRunContext } from "./run-field";
import { NO_WRITE_TARGETS, writeFieldValue } from "./output-writer";
import type { ArrayWriteTarget } from "./output-writer";

/**
 * `targets` mirrors `plan.arrays` by position and defaults to empty, which is
 * the honest description of every run that produces no output: a validate(),
 * a branch, a recursive re-entry.
 *
 * Each field reads from `current`, the subject as earlier fields in this plan
 * left it, so a rule on `a.b` sees a transform that rewrote `a`. `context.root`
 * is NOT advanced: cross-field rules are written against the input the caller
 * passed, and moving the root under them would make their answer depend on
 * declaration order.
 */
export function runPlan(
  plan: ValidationPlan,
  subject: unknown,
  context: FieldRunContext,
  targets: readonly ArrayWriteTarget[] = NO_WRITE_TARGETS
): unknown {
  let current = subject;
  for (const field of plan.fields) {
    const outcome = runField(field, current, context);
    current = writeFieldValue(
      field,
      current,
      outcome,
      context.shouldApplyTransforms
    );
    if (context.sink.shouldStopPlan()) return current;
  }
  return runArrayNodes(plan.arrays, current, context, targets);
}

/**
 * Re-bases the issues of a NESTED plan onto the path of the rule that entered
 * it. A branch's fields and a recursive re-entry's fields are both declared
 * relative to their own subject, so their issues come back as `name`; the
 * enclosing rule knows the subject sits at `user`, and the consumer must read
 * `user.name`.
 *
 * It lives here because both callers already depend on this module and neither
 * may depend on the other — run-branch creates a recursion runner, so
 * run-recursion could not own it without a cycle.
 */
export function prefixIssuePaths(
  prefix: string,
  issues: readonly ValidationIssue[]
): readonly ValidationIssue[] {
  if (prefix === "") return issues;
  return issues.map((issue) =>
    Object.freeze({
      path: joinIssuePath(prefix, issue.path),
      code: issue.code,
      message: issue.message,
      severity: issue.severity,
    })
  );
}
