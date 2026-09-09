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

/**
 * 空の束は一つを共有する。
 *
 * 七つの種のうち、どのフィールドもたいてい二つか三つしか使わない。残りは
 * 空配列だが、フィールドごとに新しく Object.freeze([]) を作っていたので、
 * 空であること自体は同じなのにマップの同一性だけが全部違っていた。実行時の
 * `field.gates.length` や `field.transforms` の読み出しは、フィールドを
 * またぐたびに別の受け手を見ることになる。
 *
 * この置き換えは src/compile/resolve-conditional-presence.ts の
 * NO_PRESENCE_OVERRIDES と src/runtime/output-writer.ts の NO_WRITE_TARGETS が
 * 既にやっていることを、残りの種にも広げただけである。
 */
const NO_RULES_OF_THIS_KIND: readonly never[] = Object.freeze([]);

/**
 * 空なら共有の一つを返す。中身があるならその配列を凍結して返す。
 *
 * `readonly never[]` はどの `readonly R[]` にも代入できるので、共有する
 * ためにアサーションを書く必要はない。型アサーションを書いてよいのは
 * src/core/type-erasure.ts だけである。
 */
function freezeRules<R>(rules: readonly R[]): readonly R[] {
  return rules.length === 0 ? NO_RULES_OF_THIS_KIND : Object.freeze(rules);
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
    checks: freezeRules(checks),
    presences: freezeRules(presences),
    conditionalPresences: freezeRules(conditionalPresences),
    gates: freezeRules(gates),
    transforms: freezeRules(transforms),
    composites: freezeRules(composites),
    recursions: freezeRules(recursions),
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
