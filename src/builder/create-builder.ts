// ===========================================================================
// L6  src/builder/create-builder.ts — THE SINGLE PUBLIC ENTRY POINT, and the
// one place in src/ that calls eraseBuilderSurface.
//
// `use()` MUTATES and returns the receiver; that is the 1.x behaviour and it is
// what separates a builder from a FieldRule registry (step 14), whose use() is
// immutable. Duplicates are dropped FIRST-WINS: a bag is a name -> plugin map,
// and letting the second registration overwrite the first is how legacy made
// `.use(a).use(b)` depend on import order.
//
// `for<T>()` snapshots the bag. A use() after it therefore cannot reach back
// into a field builder that was already handed out.
// ===========================================================================
import { eraseBuilderSurface } from "../core/type-erasure";
import type { PluginBag } from "../chain/plugin-bag.types";
import type { AnyPlugin } from "../plugin-kit/plugin-definition";
import { isPlainObject, isString } from "../types";
import type { GlobalConfig } from "../types/global-config";
import type { BuilderSurface } from "./builder-surface.types";
import { createFieldBuilderSurface } from "./create-field-builder";
// A NAMESPACE type import, not a renaming one: `Builder` is a value here too
// (./field-builder.types.ts exports the const), so importing the bare name
// would collide with nothing and read as if the entry point lived in this file.
import type * as fieldBuilderTypes from "./field-builder.types";

/** `use()` given something that is not a plugin. Named, and thrown at once:
 *  legacy swallowed it and produced a validator that permitted everything. */
export class NamelessPluginError extends Error {
  constructor(readonly received: unknown) {
    super(
      `use() expects a plugin with a name and a build(); received ` +
        `${renderReceived(received)}. Pass the plugin itself, for example ` +
        `use(requiredPlugin).`
    );
    this.name = "NamelessPluginError";
  }
}

interface BuilderRegistration {
  readonly plugins: Map<string, AnyPlugin>;
  config: GlobalConfig | undefined;
}

/**
 * The implementation behind `Builder()`. The exported const lives in
 * ./field-builder.types.ts, beside the interface it merges with; this module
 * reaches that file for a TYPE only, so the emitted module graph has one edge
 * between the two and no cycle.
 */
export function createBuilder(): fieldBuilderTypes.Builder {
  return eraseBuilderSurface<fieldBuilderTypes.Builder>(createBuilderSurface());
}

export function createBuilderSurface(): BuilderSurface {
  const registration: BuilderRegistration = {
    plugins: new Map<string, AnyPlugin>(),
    config: undefined,
  };
  const surface: BuilderSurface = {
    use(plugin) {
      registerPlugin(registration.plugins, plugin);
      return surface;
    },
    useAll(plugins) {
      // 順序は Object.values の列挙順。first-wins なので、同じ名前が二度
      // 来ても最初のものが残る — プリセットが既に登録したものを黙って
      // 置き換えることはない。
      for (const plugin of Object.values(plugins)) {
        registerPlugin(registration.plugins, plugin);
      }
      return surface;
    },
    withConfig(config) {
      registration.config = Object.assign({}, registration.config, config);
      return surface;
    },
    for: () =>
      createFieldBuilderSurface(
        toPluginBag(registration.plugins),
        registration.config
      ),
  };
  return surface;
}

function registerPlugin(
  plugins: Map<string, AnyPlugin>,
  candidate: AnyPlugin
): void {
  if (!isNamedPlugin(candidate)) throw new NamelessPluginError(candidate);
  if (plugins.has(candidate.name)) return;
  plugins.set(candidate.name, candidate);
}

/**
 * A GUARD, not a shape assertion: `use()` is the boundary a JavaScript caller
 * crosses, so the declared parameter type proves nothing here.
 */
function isNamedPlugin(candidate: unknown): candidate is AnyPlugin {
  if (!isPlainObject(candidate)) return false;
  const name = candidate["name"];
  return (
    isString(name) &&
    name.length > 0 &&
    typeof candidate["build"] === "function"
  );
}

/**
 * defineProperty rather than assignment, because a plugin named `__proto__`
 * would otherwise be swallowed by the prototype setter instead of landing in
 * the bag — and attachSlotMethods walks the bag with Object.keys.
 */
function toPluginBag(plugins: ReadonlyMap<string, AnyPlugin>): PluginBag {
  const bag: Record<string, AnyPlugin> = {};
  for (const [name, plugin] of plugins) {
    Object.defineProperty(bag, name, { value: plugin, enumerable: true });
  }
  return Object.freeze(bag);
}

function renderReceived(received: unknown): string {
  if (received === null) return "null";
  if (isPlainObject(received)) return `an object with no name`;
  return typeof received;
}
