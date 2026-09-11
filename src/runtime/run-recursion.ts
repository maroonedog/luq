// ===========================================================================
// L5  src/runtime/run-recursion.ts
// `objectRecursively` executed: the SAME plan, re-entered against a nested
// value, with a depth counter and a cycle guard.
//
// Two terminations, and they are not the same event:
//   * a CYCLE ends the descent silently. The object is already being validated
//     further up this very path, so re-validating it can only repeat issues
//     that are already in the sink — and never terminate.
//   * MAX DEPTH is reported, under the recursive rule's own code and severity.
//     Legacy truncated at maxDepth as a SUCCESS, which meant a structure deeper
//     than the limit silently skipped every rule below it.
//
// The nested plan runs into its OWN sink, and its OWN index stack STARTED AT
// the entering field's path. That is what makes `node.child.name` come out
// right: the plan's fields are declared relative to the plan's subject and know
// nothing about where they were re-entered from, so the stack is what carries
// the descent. Giving it the path up front rather than rewriting the issues
// afterwards is also what makes a message agree with the path beside it — a
// message is rendered once, from that path, at the moment the issue is built.
//
// A re-entry never writes. RecursionRunner returns void by contract, so there
// is nowhere for a transformed subtree to go; recursion is validation, and
// `shouldApplyTransforms` is false for everything below it.
// ===========================================================================
import { isArray } from "../types";
import type { ValidationIssue } from "../types";
import type { RecursionPolicy } from "../compile/validation-plan.types";
import { createIssue } from "./create-issue";
import { IndexStack } from "./index-stack";
import { IssueSink } from "./issue-sink";
import type { AbortPolicy } from "./issue-sink";
import { runPlan } from "./run-plan";
import type { RecursionRunner } from "./run-field";

/**
 * Legacy contract, kept: fields do not abort each other inside a recursive
 * re-entry. A descent that stopped at its first issue would report one leaf of
 * a tree and hide the rest, and the caller's abortEarly still decides whether
 * the OUTER plan continues once these issues are merged back.
 */
export const RECURSION_ABORT_POLICY: AbortPolicy = Object.freeze({
  abortEarly: false,
  abortEarlyOnEachField: false,
});

/** Everything a re-entry needs that is not the policy or the value. */
export interface RecursionHost {
  readonly root: unknown;
  readonly sink: IssueSink;
  readonly external?: Readonly<Record<string, unknown>>;
}

/**
 * Depth and the cycle guard belong to the whole validate() call, not to one
 * level of it: a runner is re-bound at every descent so its issues land in
 * THAT level's sink, and all of them share this.
 */
interface RecursionProgress {
  depth: number;
  readonly visited: WeakSet<object>;
}

export function createRecursionRunner(host: RecursionHost): RecursionRunner {
  return bindRecursionRunner(host, {
    depth: 0,
    visited: new WeakSet<object>(),
  });
}

/**
 * Re-binding at each descent is what makes a recursion two levels down come
 * back as `child.child.name`. A single runner bound to the top sink would add
 * the inner issues straight to it, prefixed only by the inner path, and the
 * intermediate hop would vanish.
 */
function bindRecursionRunner(
  host: RecursionHost,
  progress: RecursionProgress
): RecursionRunner {
  const runRecursion: RecursionRunner = (policy, value, ruleContext) => {
    if (policy.target === "element") {
      enterElements(policy, value, ruleContext.path);
      return;
    }
    enterPlan(policy, value, ruleContext.path);
  };

  function enterElements(
    policy: RecursionPolicy,
    value: unknown,
    path: string
  ): void {
    if (!isArray(value)) return;
    for (let index = 0; index < value.length; index += 1) {
      enterPlan(policy, value[index], `${path}[${index}]`);
    }
  }

  function enterPlan(
    policy: RecursionPolicy,
    value: unknown,
    path: string
  ): void {
    if (progress.depth >= policy.maxDepth) {
      host.sink.add(describeDepthLimit(policy, value, path, progress.depth));
      return;
    }
    const tracked = isTrackableObject(value) ? value : null;
    if (tracked !== null && progress.visited.has(tracked)) return;
    if (tracked !== null) progress.visited.add(tracked);
    progress.depth += 1;
    collectInto(policy, value, path);
    progress.depth -= 1;
    if (tracked !== null) progress.visited.delete(tracked);
  }

  function collectInto(
    policy: RecursionPolicy,
    value: unknown,
    path: string
  ): void {
    const nested = new IssueSink(RECURSION_ABORT_POLICY);
    runPlan(policy.plan.resolve(), value, {
      root: host.root,
      sink: nested,
      indices: new IndexStack(path),
      shouldApplyTransforms: false,
      runRecursion: bindRecursionRunner({ ...host, sink: nested }, progress),
      external: host.external,
    });
    for (const issue of nested.issues) {
      host.sink.add(issue);
    }
  }

  return runRecursion;
}

/**
 * The depth issue carries the limit as `expected` and the depth actually
 * reached as `actual`, so a plugin's message can name both without the runtime
 * formatting anything itself.
 */
function describeDepthLimit(
  policy: RecursionPolicy,
  value: unknown,
  path: string,
  depth: number
): ValidationIssue {
  return createIssue({
    path,
    code: policy.code,
    severity: policy.severity,
    value,
    render: (messageContext) =>
      policy.describe(
        { expected: policy.maxDepth, actual: depth },
        messageContext
      ),
  });
}

/** A WeakSet holds objects only; a primitive cannot be part of a cycle. */
function isTrackableObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}
