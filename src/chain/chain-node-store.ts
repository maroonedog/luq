// ===========================================================================
// L3  src/chain/chain-node-store.ts — what a node knows, kept outside the node.
//
// A node's rules live in a WeakMap keyed by the node instead of on the node, so
// the node carries exactly the members its type declares. Reading the rules
// back then needs no assertion and no runtime shape check, and the rules cannot
// be reached by anyone holding only the node's public surface.
//
// Rules are the only thing kept here. Anything the runtime never reads belongs
// to whoever does read it, not to the chain.
// ===========================================================================
import type { Rule } from "../plugin-kit/compiled-rule";

const rulesByNode = new WeakMap<object, readonly Rule[]>();

/** Called only by whoever made the node, once, just before freezing it. */
export function rememberChainNode(node: object, rules: readonly Rule[]): void {
  rulesByNode.set(node, rules);
}

/** The one way back out of a chain: undefined for anything that is not a node. */
export function readChainNode(candidate: unknown): readonly Rule[] | undefined {
  if (typeof candidate !== "object" || candidate === null) return undefined;
  return rulesByNode.get(candidate);
}
