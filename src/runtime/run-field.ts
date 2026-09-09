// ===========================================================================
// L5  src/runtime/run-field.ts
// One CompiledField against one subject: default, presence, gates, checks,
// transforms, then recursion. In that order, for every field, with no rule
// kind ever re-decided — compileField already sorted the rules into arrays,
// so this file reads arrays and calls what it finds. The subject is what the
// field READS from (the root, or one array element); `context.root` stays the
// real root, because cross-field rules are written against the root.
// ===========================================================================
import type { ArrayItemContext, RuleContext } from "../types";
import type {
  CompiledField,
  RecursionPolicy,
} from "../compile/validation-plan.types";
import { createIssue } from "./create-issue";
import { decidePresence } from "./decide-presence";
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

export function runField(
  field: CompiledField,
  subject: unknown,
  context: FieldRunContext
): FieldRunOutcome {
  const path = context.indices.renderFieldPath(field.renderedPath);
  const ruleContext: RuleContext = {
    root: context.root,
    path,
    item: context.item,
    external: context.external,
  };
  const read = field.read(subject);
  const value = applyDefault(field, read, context.root);
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
 * The default is substituted BEFORE anything else looks at the value, so
 * validate() and parse() judge the same value. Only parse writes it back,
 * which is the caller's decision and not this one's.
 */
function applyDefault(
  field: CompiledField,
  value: unknown,
  root: unknown
): unknown {
  if (field.defaultOf === null) return value;
  if (value === undefined) return field.defaultOf(root);
  if (value === null && field.applyDefaultToNull) return field.defaultOf(root);
  return value;
}

/** A closed gate ends the field successfully: no check, no transform. */
function openGates(
  field: CompiledField,
  value: unknown,
  ruleContext: RuleContext
): boolean {
  for (const gate of field.gates) {
    if (!gate.shouldRun(value, ruleContext)) return false;
  }
  return true;
}

function runChecks(
  field: CompiledField,
  value: unknown,
  ruleContext: RuleContext,
  context: FieldRunContext,
  mark: number
): void {
  for (const check of field.checks) {
    const outcome = check.run(value, ruleContext);
    if (outcome.ok) continue;
    context.sink.add(
      createIssue({
        path: ruleContext.path,
        code: check.code,
        severity: check.severity,
        value,
        render: (ctx) => check.describe(outcome.detail, ctx),
      })
    );
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
  for (const transform of field.transforms) {
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
