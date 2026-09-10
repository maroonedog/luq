// ===========================================================================
// L3  src/chain/create-field-slots.ts — the runtime `b`.
//
// Nine entry points, one per TypeName, each a fresh empty chain on that slot.
// The slots are LAZY getters: a field callback touches one of the nine, and
// building the other eight (one closure per plugin serving them) would be
// eight ninths wasted at build time.
//
// This module owns the recursive knot: a node needs sub-chain arguments
// resolved, resolving them needs a fresh `b`, and a fresh `b` needs nodes. It
// is tied here, by handing the node a `resolveArguments` closure, so the three
// modules below it stay acyclic.
// ===========================================================================
import type { TypeName } from "../types";
import type { Rule } from "../plugin-kit/compiled-rule";
import { eraseChainSurface } from "../core/type-erasure";
import type { PluginBag } from "./plugin-bag.types";
import type { FieldSlots } from "./field-slots.types";
import {
  createChainNode,
  EMPTY_RULES,
  type ChainBuildContext,
  type ChainNodeWiring,
} from "./create-chain-node";
import { resolvePluginArguments } from "./collect-branch-rules";
import { slotTypeGuard } from "./slot-type-guard";

const SLOT_NAMES: readonly TypeName[] = Object.freeze([
  "string",
  "number",
  "boolean",
  "date",
  "array",
  "tuple",
  "object",
  "union",
  "any",
]);

/** The erased twin of FieldSlots: the same nine keys, no type parameters. */
export function buildSlotSurface(
  bag: PluginBag,
  context: ChainBuildContext
): Readonly<Record<string, unknown>> {
  const surface: Record<string, unknown> = {};
  const wiring: ChainNodeWiring = {
    bag,
    context,
    resolveArguments: (plugin, declared) =>
      resolvePluginArguments(bag, context, buildSlotSurface, plugin, declared),
  };
  for (const slot of SLOT_NAMES) {
    // The slot's own type check leads the chain, so it runs before any value
    // rule. Those rules pass a wrong-typed value through on purpose; this is
    // what reports it. See slot-type-guard.ts.
    const guard =
      context.typeDecidedElsewhere === true
        ? null
        : slotTypeGuard(slot, context.config.defaultSeverity);
    const seed: readonly Rule[] =
      guard === null ? EMPTY_RULES : Object.freeze([guard]);
    Object.defineProperty(surface, slot, {
      enumerable: true,
      get: () => createChainNode(wiring, slot, seed),
    });
  }
  return surface;
}

export function createFieldSlots<TRoot, B extends PluginBag, TField>(
  bag: B,
  context: ChainBuildContext
): FieldSlots<TRoot, B, TField> {
  return eraseChainSurface<FieldSlots<TRoot, B, TField>>(
    buildSlotSurface(bag, context)
  );
}
