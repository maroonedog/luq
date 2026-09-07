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
// The rule's bag parameter is written as the BUILDER's bag, and that one line
// is the load-bearing gate. FieldRuleDefine mentions the bag in a parameter
// position, so a rule minted from plugins the builder does not carry is
// rejected at the call, while a builder carrying MORE than the rule needs is
// accepted. Without it the rule's callback would run against a bag that has no
// `.min()` on it and die with a TypeError at build() instead of at the
// keystroke.
//
// The chain is rebuilt from the BUILDER's bag, not the registry's copy, so a
// plugin registered under the same name in both is taken from the builder. That
// is deliberate: the builder owns the object being validated, and one field may
// not run a different implementation of `required` from its neighbours.
// ===========================================================================
import type { FieldBuilder } from "../builder/field-builder.types";
import type { PluginBag } from "../chain/plugin-bag.types";
import type { FieldPath } from "../path/field-path.types";
import type { ValueAtPath } from "../path/value-at-path.types";
import type { FieldRule } from "./field-rule.types";

export function useField<
  T extends object,
  B extends PluginBag,
  TDeclared extends string,
  K extends FieldPath<T> & string,
>(
  builder: FieldBuilder<T, B, TDeclared>,
  path: K,
  rule: FieldRule<ValueAtPath<T, K>, B>
): FieldBuilder<T, B, TDeclared | K> {
  return builder.v(path, rule.define, rule.fieldOptions);
}
