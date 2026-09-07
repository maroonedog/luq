// ===========================================================================
// L3  src/chain/attach-slot-methods.ts
//
// The VALUE-level twin of SlotPlugins: a plugin gets a method on a chain iff
// its `slots` contains that chain's slot, and the method is named by
// `plugin.method`. If two plugins claim the same method name on the same slot,
// legacy silently let the second overwrite the first; here it is a build-time
// error naming both plugins. The eight refine* names are claimed by the chain
// itself and are protected the same way.
// ===========================================================================
import type { TypeName } from "../types";
import type { AnyPlugin } from "../plugin-kit/plugin-definition";
import type { PluginBag } from "./plugin-bag.types";
import { REFINE_METHOD_SLOTS } from "./refine-methods.types";

/** The owner named for a clash with a method the chain itself provides. */
export const CHAIN_BUILT_IN_OWNER = "luq:chain (built-in refine method)";

export class PluginMethodCollisionError extends Error {
  constructor(
    readonly methodName: string,
    readonly slot: TypeName,
    readonly firstPluginName: string,
    readonly secondPluginName: string
  ) {
    super(
      `Method "${methodName}" on the "${slot}" slot is claimed by both ` +
        `"${firstPluginName}" and "${secondPluginName}". Rename one of them ` +
        `or register only one of the two plugins.`
    );
    this.name = "PluginMethodCollisionError";
  }
}

function isRefineMethodName(methodName: string): boolean {
  return Object.prototype.hasOwnProperty.call(REFINE_METHOD_SLOTS, methodName);
}

/**
 * Installs one method per plugin serving `slot` onto `target`. `createMethod`
 * is supplied by the node so this module never needs to know what a rule is.
 */
export function attachSlotMethods(
  target: Record<string, unknown>,
  bag: PluginBag,
  slot: TypeName,
  createMethod: (plugin: AnyPlugin) => (...args: readonly unknown[]) => unknown
): void {
  const claimedBy = new Map<string, string>();
  for (const key of Object.keys(bag)) {
    const plugin = bag[key];
    if (plugin === undefined) continue;
    if (!plugin.slots.includes(slot)) continue;
    const methodName = plugin.method;
    if (isRefineMethodName(methodName)) {
      throw new PluginMethodCollisionError(
        methodName,
        slot,
        CHAIN_BUILT_IN_OWNER,
        plugin.name
      );
    }
    const claimant = claimedBy.get(methodName);
    if (claimant !== undefined) {
      throw new PluginMethodCollisionError(
        methodName,
        slot,
        claimant,
        plugin.name
      );
    }
    claimedBy.set(methodName, plugin.name);
    target[methodName] = createMethod(plugin);
  }
}
