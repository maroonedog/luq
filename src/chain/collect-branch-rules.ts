// ===========================================================================
// L3  src/chain/collect-branch-rules.ts — where the EAGER-RESOLUTION invariant
// lives (verification.md, CONTRADICTION A-2).
//
// ElementChain / NarrowedChain / PropertyValueChain / PropertyKeyChain all
// resolve to `readonly Rule[]`, never to a thunk: the chain runs the sub-chain
// callback ONCE, here, and hands the plugin a frozen array. A plugin therefore
// cannot run a user callback zero times or twice.
//
// WHICH argument positions carry a sub-chain cannot be recovered from the
// plugin's TYPE at run time (`signature` is type-only, and a NarrowedChain and
// a RootPredicate are both plain functions once erased), so a plugin that takes
// one DECLARES the positions. The container is then read from the value:
// a function is one sub-chain, an array is a list of them (tupleBuilder), a
// plain object is a keyed set of them (patternProperties, dependentSchemas).
// ===========================================================================
import { isArray, isPlainObject } from "../types";
import type { Rule } from "../plugin-kit/compiled-rule";
import type { AnyPlugin } from "../plugin-kit/plugin-definition";
import type { PluginBag } from "./plugin-bag.types";
import { readChainRules, type ChainBuildContext } from "./create-chain-node";

const NO_SUB_CHAINS: readonly number[] = Object.freeze([]);

export type SubChainDefine = (slots: unknown) => unknown;
export type SlotSurfaceFactory = (
  bag: PluginBag,
  context: ChainBuildContext
) => Readonly<Record<string, unknown>>;

/** What a plugin adds to its definition to declare its sub-chain positions. */
export interface SubChainArgumentDeclaration {
  readonly subChainArguments: readonly number[];
}

export class SubChainResultError extends Error {
  constructor(readonly fieldPath: string) {
    super(
      `A sub-chain callback for "${fieldPath}" did not return a chain. ` +
        `End it on a slot method, for example \`(b) => b.string.required()\`.`
    );
    this.name = "SubChainResultError";
  }
}

function isSubChainDefine(value: unknown): value is SubChainDefine {
  return typeof value === "function";
}

function readSubChainArguments(plugin: AnyPlugin): readonly number[] {
  const declared = plugin.subChainArguments;
  return declared === undefined ? NO_SUB_CHAINS : declared;
}

/** Runs ONE sub-chain callback exactly once and freezes what it produced. */
export function collectBranchRules(
  bag: PluginBag,
  context: ChainBuildContext,
  define: SubChainDefine,
  createSlots: SlotSurfaceFactory
): readonly Rule[] {
  const rules = readChainRules(define(createSlots(bag, context)));
  if (rules === undefined) throw new SubChainResultError(context.fieldPath);
  return Object.freeze(rules.slice());
}

function resolveSubChainArgument(
  bag: PluginBag,
  context: ChainBuildContext,
  createSlots: SlotSurfaceFactory,
  value: unknown
): unknown {
  if (isSubChainDefine(value))
    return collectBranchRules(bag, context, value, createSlots);
  if (isArray(value)) {
    return Object.freeze(
      value.map((entry) =>
        resolveSubChainArgument(bag, context, createSlots, entry)
      )
    );
  }
  if (isPlainObject(value)) {
    const resolved: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      resolved[key] = resolveSubChainArgument(bag, context, createSlots, entry);
    }
    return Object.freeze(resolved);
  }
  return value;
}

/** Replaces every DECLARED sub-chain position with its collected rules. */
export function resolvePluginArguments(
  bag: PluginBag,
  context: ChainBuildContext,
  createSlots: SlotSurfaceFactory,
  plugin: AnyPlugin,
  declared: readonly unknown[]
): unknown[] {
  const positions = readSubChainArguments(plugin);
  if (positions.length === 0) return declared.slice();
  return declared.map((value, index) =>
    positions.includes(index)
      ? resolveSubChainArgument(bag, context, createSlots, value)
      : value
  );
}
