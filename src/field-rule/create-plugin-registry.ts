// ===========================================================================
// src/field-rule/create-plugin-registry.ts — the IMMUTABLE plugin bag.
//
// A registry holds a THUNK that replays `use()` onto a fresh Builder, never a
// Builder it hands out. Builder.use() mutates its receiver, so a stored builder
// would make `base.use(a)` and `base.use(b)` land in the same object and every
// branch of a shared base would see every other branch's plugins. Replaying is
// O(n) per branch at BUILD time only, and it is the whole of the immutability
// guarantee (docs/legacy-spec/plugin-contract.md:114).
//
// The thunk also carries the type: `makeBuilder().use(plugin)` is already
// `Builder<B & BagEntry<P>>`, so the growing bag type is produced by the
// builder's own signature and this file holds no assertion.
// ===========================================================================
import { Builder } from "../builder/field-builder.types";
import type { BagEntry, PluginBag } from "../chain/plugin-bag.types";
import type { AnyPlugin } from "../plugin-kit/plugin-definition";
import { createFieldRule } from "./create-field-rule";
import type { PluginRegistry } from "./plugin-registry.types";

/** First-wins by name, the rule Builder.use() already follows. */
function appendPlugin(
  plugins: readonly AnyPlugin[],
  plugin: AnyPlugin
): readonly AnyPlugin[] {
  if (plugins.some((registered) => registered.name === plugin.name)) {
    return plugins;
  }
  return Object.freeze([...plugins, plugin]);
}

/**
 * defineProperty rather than assignment, for the same reason toPluginBag uses
 * it: a plugin named `__proto__` must land in the record instead of reaching
 * the prototype setter.
 */
function indexPluginsByName(
  plugins: readonly AnyPlugin[]
): Readonly<Record<string, AnyPlugin>> {
  const indexed: Record<string, AnyPlugin> = {};
  for (const plugin of plugins) {
    Object.defineProperty(indexed, plugin.name, {
      value: plugin,
      enumerable: true,
    });
  }
  return Object.freeze(indexed);
}

function createRegistry<B extends PluginBag>(
  makeBuilder: () => Builder<B>,
  plugins: readonly AnyPlugin[]
): PluginRegistry<B> {
  const registry: PluginRegistry<B> = {
    use<P extends AnyPlugin>(plugin: P): PluginRegistry<B & BagEntry<P>> {
      const grow = (): Builder<B & BagEntry<P>> => makeBuilder().use(plugin);
      // Eagerly, so a nameless value throws NamelessPluginError HERE and not
      // at the far-away call that first needed a builder.
      grow();
      return createRegistry(grow, appendPlugin(plugins, plugin));
    },
    createFieldRule: (define, options) =>
      createFieldRule(makeBuilder(), define, options),
    toBuilder: () => makeBuilder(),
    getPlugins: () => indexPluginsByName(plugins),
  };
  return Object.freeze(registry);
}

const NO_PLUGINS: readonly AnyPlugin[] = Object.freeze([]);

export function createPluginRegistry(): PluginRegistry<Record<never, never>> {
  return createRegistry(() => Builder(), NO_PLUGINS);
}
