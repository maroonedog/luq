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
import type { AnyChain } from "../chain/field-chain.types";
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
   * Supply the input type first; the second call infers the returned chain.
   * Example: `registry.createFieldRule<string>()(b => b.string.transform(Number))`.
   */
  createFieldRule<TValue>(): <C extends AnyChain>(
    define: FieldRuleDefine<TValue, B, C>,
    options?: FieldRuleOptions<TValue>
  ) => FieldRule<TValue, B, C>;
  /** With an explicit input type alone, this overload keeps the legacy output type. */
  createFieldRule<TValue, C extends AnyChain = AnyChain>(
    define: FieldRuleDefine<TValue, B, C>,
    options?: FieldRuleOptions<TValue>
  ): FieldRule<TValue, B, C>;
  /** A FRESH builder each call, carrying the same plugins. */
  toBuilder(): Builder<B>;
  getPlugins(): Readonly<Record<string, AnyPlugin>>;
}
