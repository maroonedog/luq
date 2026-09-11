// ===========================================================================
// The manifest answers "which import gives me this method?".
//
// A reader who has `.min()` in mind — a person skimming node_modules, or a
// model that installed the package and never saw luq.dev — has to get from the
// method to the symbol and the subpath. The manifest is the only machine
// readable place in the shipped package where that mapping exists, so these
// assertions are about it being TRUE, not about it being present: each one
// compares the manifest against the plugin object itself.
// ===========================================================================
import * as path from "path";
import { PLUGIN_MANIFEST } from "../../src/plugins/manifest.generated";
import type { TypeName } from "../../src/types";

/**
 * Every slot, keyed so the compiler checks the list. A slot added to TypeName
 * and missed here is a missing key; a name that is not a slot is an excess
 * one. Neither compiles, so this cannot fall behind the type.
 */
const SLOT_NAMES: Readonly<Record<TypeName, true>> = {
  string: true,
  number: true,
  boolean: true,
  date: true,
  array: true,
  tuple: true,
  object: true,
  union: true,
  any: true,
};

const REPOSITORY_ROOT = path.resolve(__dirname, "..", "..");
const PACKAGE_NAME = "@maroonedog/luq";

/** The plugin as `definePlugin` leaves it. Narrowed, never asserted. */
function readPlugin(
  entryFile: string,
  symbol: string
): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const loaded: unknown = require(path.join(REPOSITORY_ROOT, entryFile));
  if (typeof loaded !== "object" || loaded === null) {
    throw new Error(`${entryFile} exports nothing`);
  }
  const value = (loaded as Record<string, unknown>)[symbol];
  if (typeof value !== "object" || value === null) {
    throw new Error(`${entryFile} does not export ${symbol}`);
  }
  return value as Record<string, unknown>;
}

describe("the shipped manifest describes the plugins it lists", () => {
  it("lists a surface for every exported symbol, in the same order", () => {
    for (const entry of PLUGIN_MANIFEST) {
      expect(entry.surfaces.map((surface) => surface.symbol)).toEqual([
        ...entry.exportedSymbols,
      ]);
    }
  });

  it("reports the method and slots the plugin really has", () => {
    // Read off the plugin object rather than the source text: a definition
    // assembled from a constant would still be described correctly, and a
    // manifest that drifted from the plugin would fail here rather than
    // quietly send a reader to the wrong import.
    for (const entry of PLUGIN_MANIFEST) {
      for (const surface of entry.surfaces) {
        const plugin = readPlugin(entry.entryFile, surface.symbol);
        expect(surface.method).toBe(plugin.method);
        expect(surface.slots).toEqual(plugin.slots);
      }
    }
  });

  it("names slots that exist", () => {
    for (const entry of PLUGIN_MANIFEST) {
      for (const surface of entry.surfaces) {
        expect(surface.slots.length).toBeGreaterThan(0);
        for (const slot of surface.slots) {
          expect(Object.prototype.hasOwnProperty.call(SLOT_NAMES, slot)).toBe(
            true
          );
        }
      }
    }
  });

  it("gives an entryPoint that is a published subpath, not a source path", () => {
    // `entryFile` is where the plugin lives in this repository and resolves
    // nowhere else; an installed package has no src directory. `entryPoint` is
    // the half a consumer can actually type.
    for (const entry of PLUGIN_MANIFEST) {
      expect(entry.entryPoint).toBe(
        `${PACKAGE_NAME}/plugins/${entry.subpathName}`
      );
      expect(entry.entryPoint.startsWith("src/")).toBe(false);
    }
  });

  it("has no two plugins claiming one method on one slot", () => {
    // The compile error for a missing plugin names ONE import. Two claimants
    // on a slot would make that name a guess.
    const claimed = new Map<string, string>();
    for (const entry of PLUGIN_MANIFEST) {
      for (const surface of entry.surfaces) {
        for (const slot of surface.slots) {
          const key = `${slot}.${surface.method}`;
          const already = claimed.get(key);
          expect(already).toBeUndefined();
          claimed.set(key, surface.symbol);
        }
      }
    }
  });
});
