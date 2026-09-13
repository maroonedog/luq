// ===========================================================================
// L5  src/runtime/run-field.ts
// One CompiledField against one subject: default, presence, gates, checks,
// transforms, then recursion. In that order, for every field, with no rule
// kind ever re-decided — compileField already sorted the rules into arrays,
// so this file reads arrays and calls what it finds. The subject is what the
// field READS from (the root, or one array element); `context.root` stays the
// real root, because cross-field rules are written against the root.
//
// Two things. **Loops here are indexed**: for-of over a frozen array does not
// get its iterator elided, and that alone was about half the garbage on array
// shapes. **This file is not split**: moving the default and normalize helpers
// into a module measured 27% slower, calls across modules not being inlined.
// ===========================================================================
import type { ArrayItemContext, IssueDetail, RuleContext } from "../types";
import type {
  CompiledField,
  RecursionPolicy,
} from "../compile/validation-plan.types";
import { createIssue } from "./create-issue";
import { FieldRuleContext } from "./field-rule-context";
import { decidePresence } from "./decide-presence";
import { applyDefault, applyNormalize, openGates } from "./field-stages";
import type { IndexStack } from "./index-stack";
import type { IssueSink } from "./issue-sink";

/** Re-enters a plan; run-recursion's job. Bound to the sink and the stack. */
export type RecursionRunner = (
  policy: RecursionPolicy,
  value: unknown,
  ctx: RuleContext
) => void;

export interface FieldRunContext {
  readonly root: unknown;
  readonly sink: IssueSink;
  readonly indices: IndexStack;
  /** False for validate(), true for parse(). validate skips transforms whole. */
  readonly shouldApplyTransforms: boolean;
  readonly runRecursion: RecursionRunner;
  readonly item?: ArrayItemContext;
  readonly external?: Readonly<Record<string, unknown>>;
}

/** Discriminated so a written `undefined` stays distinguishable from "no
 *  write at all", which a bare `unknown` return could not express. */
export type FieldRunOutcome =
  | { readonly hasWriteBack: false }
  | { readonly hasWriteBack: true; readonly value: unknown };

/** Shared, frozen, never re-assigned: the common answer allocates nothing. */
export const FIELD_VALUE_UNCHANGED: FieldRunOutcome = Object.freeze({
  hasWriteBack: false,
});

/**
 * A field that declared nothing but presence and checks.
 *
 * Which is most of them, and the route below used to reach them through five
 * stages that had nothing to do: applyDefault to be told there is no default,
 * applyNormalize to be told there is no normalize, an empty gate loop, a
 * transform stage that validate() never runs anyway, and a recursion stage
 * holding null. The plan knows all five at compile time, so the question is
 * asked once, there, and answered here by which function runs.
 *
 * Kept small on purpose: replacing `issues.some(cb)` with a plain loop in
 * create-validator.ts cost 34x the per-call allocation, because what V8 had
 * been eliding came back the moment the enclosing function stopped being
 * inlined. Nothing here is worth that.
 */
function runPlainField(
  field: CompiledField,
  subject: unknown,
  context: FieldRunContext
): FieldRunOutcome {
  const ruleContext: RuleContext = new FieldRuleContext(
    context.root,
    context.indices,
    field.renderedPath,
    context.item,
    context.external
  );
  const value = field.read(subject);
  if (!decidePresence(field, value, ruleContext, context.sink)) {
    return FIELD_VALUE_UNCHANGED;
  }
  runChecks(field, value, ruleContext, context, context.sink.count);
  return FIELD_VALUE_UNCHANGED;
}

export function runField(
  field: CompiledField,
  subject: unknown,
  context: FieldRunContext
): FieldRunOutcome {
  if (field.isPlain) return runPlainField(field, subject, context);
  return runDeclaredStages(field, subject, context);
}

function runDeclaredStages(
  field: CompiledField,
  subject: unknown,
  context: FieldRunContext
): FieldRunOutcome {
  const ruleContext: RuleContext = new FieldRuleContext(
    context.root,
    context.indices,
    field.renderedPath,
    context.item,
    context.external
  );
  const read = field.read(subject);
  const value = applyNormalize(field, applyDefault(field, read, context.root));
  if (!decidePresence(field, value, ruleContext, context.sink)) {
    return FIELD_VALUE_UNCHANGED;
  }
  if (!openGates(field, value, ruleContext)) return FIELD_VALUE_UNCHANGED;
  const mark = context.sink.count;
  runChecks(field, value, ruleContext, context, mark);
  const written = runTransforms(field, value, ruleContext, context, mark);
  reenterPlan(field, written, ruleContext, context, mark);
  if (written === read) return FIELD_VALUE_UNCHANGED;
  return { hasWriteBack: true, value: written };
}

/**
 * The side taken only on failure. Lifted out of the loop body because most of
 * that body was issue construction an accepted value never runs, and its size
 * was what pushed the check loop past the inlining budget. Stopping is not
 * decided here: add the issue, then ask — that order is what abortEarly means.
 */
function reportCheckFailure(
  check: CompiledField["checks"][number],
  detail: IssueDetail,
  value: unknown,
  ruleContext: RuleContext,
  context: FieldRunContext
): void {
  context.sink.add(
    createIssue({
      path: ruleContext.path,
      code: check.code,
      severity: check.severity,
      value,
      render: (ctx) => check.describe(detail, ctx),
      causes: detail.causes,
    })
  );
}

function runChecks(
  field: CompiledField,
  value: unknown,
  ruleContext: RuleContext,
  context: FieldRunContext,
  mark: number
): void {
  const checks = field.checks;
  for (let i = 0; i < checks.length; i += 1) {
    const check = checks[i];
    if (check === undefined) continue;
    const outcome = check.run(value, ruleContext);
    if (outcome.ok) continue;
    reportCheckFailure(check, outcome.detail, value, ruleContext, context);
    if (context.sink.shouldStopField(mark)) return;
  }
}

/** validate() never reaches a transform, and neither does a failed field. */
function runTransforms(
  field: CompiledField,
  value: unknown,
  ruleContext: RuleContext,
  context: FieldRunContext,
  mark: number
): unknown {
  if (!context.shouldApplyTransforms || context.sink.count !== mark) {
    return value;
  }
  let current = value;
  const transforms = field.transforms;
  for (let i = 0; i < transforms.length; i += 1) {
    const transform = transforms[i];
    if (transform === undefined) continue;
    current = transform.apply(current, ruleContext);
  }
  return current;
}

/** Recursion is the field's last rule, so the field-level abort covers it. */
function reenterPlan(
  field: CompiledField,
  value: unknown,
  ruleContext: RuleContext,
  context: FieldRunContext,
  mark: number
): void {
  if (field.recursion === null || context.sink.shouldStopField(mark)) return;
  context.runRecursion(field.recursion, value, ruleContext);
}
