// ===========================================================================
// src/field-rule/plugin-registry.types.ts
// A plugin bag that exists independently of any one Builder, whose only purpose
// is to mint reusable single-field rules
// (docs/legacy-spec/plugin-contract.md:114).
//
// THE DIFFERENCE FROM Builder: `use()` here is IMMUTABLE. Builder.use() mutates
// and returns the receiver, which is 1.x behaviour and is why two branches off
// one builder share plugins. A registry is meant to be a shared base that
// different teams branch, so its use() must return a NEW registry and leave the
// receiver alone.
// ===========================================================================
import type { Builder } from "../builder/field-builder.types";
import type { BagEntry, PluginBag } from "../chain/plugin-bag.types";
import type { AnyPlugin } from "../plugin-kit/plugin-definition";
import type {
  FieldRule,
  FieldRuleDefine,
  FieldRuleOptions,
} from "./field-rule.types";

export interface PluginRegistry<B extends PluginBag> {
  /** IMMUTABLE, unlike Builder.use(): the receiver is never touched. */
  use<P extends AnyPlugin>(plugin: P): PluginRegistry<B & BagEntry<P>>;
  /**
   * TValue is written, not inferred — it names the type the rule is FOR, and
   * `define`'s only mention of it is a callback parameter, which no inference
   * can read. `registry.createFieldRule<string>((b) => b.string.required())`.
   */
  createFieldRule<TValue>(
    define: FieldRuleDefine<TValue, B>,
    options?: FieldRuleOptions<TValue>
  ): FieldRule<TValue, B>;
  /** A FRESH builder each call, carrying the same plugins. */
  toBuilder(): Builder<B>;
  getPlugins(): Readonly<Record<string, AnyPlugin>>;
}
