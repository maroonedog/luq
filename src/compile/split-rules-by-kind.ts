// ===========================================================================
// L4  src/compile/split-rules-by-kind.ts
// One pass over a field's rules, seven arrays out, declaration order preserved
// inside each one.
//
// This is the ONLY place the seven rule kinds are told apart. The runtime then
// walks arrays that are already homogeneous, so no `switch (rule.kind)` is
// left on the hot path. Adding an eighth kind to the Rule union makes the
// final branch's `rule` stop being `never` and breaks the build here, which is
// how a new kind is prevented from silently reaching L5 unhandled — the guard
// that caught conditionalPresence when it was added.
// ===========================================================================
import type {
  CheckRule,
  CompositeRule,
  ConditionalPresenceRule,
  GateRule,
  PresenceRule,
  RecursiveRule,
  Rule,
  TransformRule,
} from "../plugin-kit/compiled-rule";

export interface RulesByKind {
  readonly checks: readonly CheckRule[];
  readonly presences: readonly PresenceRule[];
  readonly conditionalPresences: readonly ConditionalPresenceRule[];
  readonly gates: readonly GateRule[];
  readonly transforms: readonly TransformRule[];
  readonly composites: readonly CompositeRule[];
  readonly recursions: readonly RecursiveRule[];
}

/** Thrown when a value shaped like a Rule carries a kind the union forbids. */
export class UnknownRuleKindError extends Error {
  constructor(readonly received: unknown) {
    super(
      `A rule of an unknown kind reached compilation: ${describeRule(received)}`
    );
    this.name = "UnknownRuleKindError";
  }
}

export function splitRulesByKind(rules: readonly Rule[]): RulesByKind {
  const checks: CheckRule[] = [];
  const presences: PresenceRule[] = [];
  const conditionalPresences: ConditionalPresenceRule[] = [];
  const gates: GateRule[] = [];
  const transforms: TransformRule[] = [];
  const composites: CompositeRule[] = [];
  const recursions: RecursiveRule[] = [];
  for (const rule of rules) {
    if (rule.kind === "check") checks.push(rule);
    else if (rule.kind === "presence") presences.push(rule);
    else if (rule.kind === "conditionalPresence")
      conditionalPresences.push(rule);
    else if (rule.kind === "gate") gates.push(rule);
    else if (rule.kind === "transform") transforms.push(rule);
    else if (rule.kind === "composite") composites.push(rule);
    else if (rule.kind === "recursive") recursions.push(rule);
    else rejectUnknownRuleKind(rule);
  }
  return Object.freeze({
    checks: Object.freeze(checks),
    presences: Object.freeze(presences),
    conditionalPresences: Object.freeze(conditionalPresences),
    gates: Object.freeze(gates),
    transforms: Object.freeze(transforms),
    composites: Object.freeze(composites),
    recursions: Object.freeze(recursions),
  });
}

/** The exhaustiveness proof: the parameter is `never`, so an eighth kind is a
 *  compile error at the call site and not a run-time surprise. */
function rejectUnknownRuleKind(rule: never): never {
  throw new UnknownRuleKindError(rule);
}

function describeRule(received: unknown): string {
  if (typeof received !== "object" || received === null) {
    return String(received);
  }
  const kind: unknown = Reflect.get(received, "kind");
  return typeof kind === "string" ? JSON.stringify(kind) : "(no kind)";
}
