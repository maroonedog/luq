// ===========================================================================
// src/field-rule/use-field.ts — splicing a reusable rule into a builder.
//
// It is a FREE FUNCTION, not a method on FieldBuilder. Legacy had
// `builder.useField(path, rule)`, which put a second way to declare a field on
// the one entry point and let the registry grow into a parallel world
// (docs/legacy-spec/anti-patterns.md:128). Here there is one declaration
// mechanism — `.v()` — and useField is a caller of it, which is exactly why the
// rules it produces cannot differ from the ones a hand-written `.v()` produces.
//
// The load-bearing gate is that the builder must carry at least the plugins the
// rule was minted from, and it is STATED: `keyof BRule extends keyof B`.
// Without it the rule's callback would run against a bag that has no `.min()`
// on it and die with a TypeError at build() instead of at the keystroke.
//
// It used to be a consequence rather than a statement. The rule's bag was
// written as the builder's own, so the two slot objects were compared and a
// richer one was assignable to a leaner one because it had more members. That
// stopped being true once a slot began carrying a member for every method it
// does NOT have: where the rule's bag says PluginNotImported the builder's may
// have the real method, and those do not compare. Saying the subset relation
// outright also says what was always meant, and it is why the callback reaches
// `.v()` through the one sanctioned erasure — the relation holds between two
// type parameters, which the value side cannot carry.
//
// The chain is rebuilt from the BUILDER's bag, not the registry's copy, so a
// plugin registered under the same name in both is taken from the builder. That
// is deliberate: the builder owns the object being validated, and one field may
// not run a different implementation of `required` from its neighbours.
// ===========================================================================
import type { FieldBuilder } from "../builder/field-builder.types";
import { eraseRuleDefineToBuilderSlots } from "../core/type-erasure";
import type { PluginBag } from "../chain/plugin-bag.types";
import type { FieldRuleNeedsPlugins } from "../chain/plugin-not-imported.types";
import type { FieldPath } from "../path/field-path.types";
import type { ValueAtPath } from "../path/value-at-path.types";
import type { FieldRule } from "./field-rule.types";

export function useField<
  T extends object,
  B extends PluginBag,
  BRule extends PluginBag,
  TDeclared extends string,
  K extends FieldPath<T> & string,
>(
  // The gate rides on the BUILDER rather than on the rule, so a builder that
  // is missing plugins fails at the argument that is actually short of them.
  // When it carries what the rule needs the intersection is `& unknown` and
  // changes nothing; when it does not, the builder is asked to be a type no
  // builder is, and the error names the plugins it lacks.
  builder: FieldBuilder<T, B, TDeclared> &
    (keyof BRule extends keyof B
      ? unknown
      : FieldRuleNeedsPlugins<Exclude<keyof BRule, keyof B>>),
  path: K,
  rule: FieldRule<ValueAtPath<T, K>, BRule>
): FieldBuilder<T, B, TDeclared | K> {
  return builder.v(
    path,
    eraseRuleDefineToBuilderSlots(rule.define),
    rule.fieldOptions
  );
}
