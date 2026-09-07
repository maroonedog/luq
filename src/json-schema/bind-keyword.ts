// ===========================================================================
// L8  src/json-schema/bind-keyword.ts — the ONLY way to build a KeywordBinding.
//
// Four independent compile-time gates, each proved by a mutation in
// l8-keyword-binding.type-test.ts:
//   1. `M extends BoundMethod<S>`  — the method must exist on slot S's chain.
//      ("minItemz", and "minItems" itself, are rejected here.)
//   2. `M extends TMethod` — the plugin passed must be the one that actually
//      declares method M, so the literal cannot drift from the plugin.
//   3. `S extends TSlots[number]`  — the plugin must accept that slot.
//   4. `MarkerFreeArgs<TSig["args"]>` — a plugin whose arguments carry a marker
//      (an element chain, a field reference) resolves to `never`, so no
//      `toArguments` can satisfy it. A JSON document cannot supply a chain.
// ===========================================================================
import type { TypeName } from "../types";
import type {
  PluginDefinition,
  PluginSignature,
} from "../plugin-kit/plugin-definition";
import type { BoundMethod, MarkerFreeArgs } from "./json-schema-bag.types";
import type {
  KeywordBinding,
  StructuralKeyword,
  UnsupportedKeyword,
} from "./keyword-binding.types";

export function bindKeyword<
  S extends TypeName & TSlots[number],
  // `& TMethod` is load-bearing: without it the method literal and the plugin's
  // own method infer to a UNION and a mismatched pair type-checks. Measured.
  M extends BoundMethod<S> & TMethod,
  TName extends string,
  TMethod extends string,
  TSlots extends readonly TypeName[],
  TSig extends PluginSignature,
  V,
>(
  slot: S,
  method: M,
  plugin: PluginDefinition<TName, TMethod, TSlots, TSig>,
  toArguments: (keywordValue: V) => MarkerFreeArgs<TSig["args"]>
): KeywordBinding<S, M, TName, MarkerFreeArgs<TSig["args"]>, V> {
  // No registry lookup, no `plugin.method`: every field is already a literal.
  return {
    handling: "bind",
    slot,
    method,
    pluginName: plugin.name,
    toArguments,
  };
}

export function structural(note: string): StructuralKeyword {
  return { handling: "structural", note };
}

export function unsupported(reason: string): UnsupportedKeyword {
  return { handling: "unsupported", reason };
}
