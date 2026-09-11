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
import type { ValidationPlan } from "../compile/validation-plan.types";
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
  const fields = plan.fields;
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    if (field === undefined) continue;
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
 * A nested plan does NOT come back to have its issue paths corrected. A branch
 * and a recursive re-entry each start their IndexStack at the entering rule's
 * path, so every issue is built at its full path and its message is rendered
 * from that same path. Rewriting the path afterwards used to leave the message
 * naming the field's short name, so one issue reported two different fields.
 */
