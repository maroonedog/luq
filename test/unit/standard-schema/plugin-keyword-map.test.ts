// ===========================================================================
// The keyword table holds plugin names as strings, so that emitting a schema
// does not drag every plugin into the bundle. The cost is that the compiler
// does not watch those spellings. This is what cross-checks them.
//
// Being a test, it can load every plugin in the catalog without caring about
// bytes. Rename one and this fails — the drift is stopped without paying for
// it in the shipped artefact.
// ===========================================================================
import catalog from "../../../config/plugin-catalog.lock.json";
import { PLUGIN_KEYWORDS } from "../../../src/standard-schema/plugin-keyword-map";

interface CatalogEntry {
  readonly directory: string;
}

function isNamedPlugin(value: unknown): value is { readonly name: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string" &&
    typeof (value as { build?: unknown }).build === "function"
  );
}

/** Every plugin's `name`, collected from the real catalog. */
function everyPluginName(): ReadonlySet<string> {
  const names = new Set<string>();
  for (const entry of catalog.plugins as readonly CatalogEntry[]) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module: unknown = require(`../../../${entry.directory}`);
    for (const exported of Object.values(module as Record<string, unknown>)) {
      if (isNamedPlugin(exported)) names.add(exported.name);
    }
  }
  return names;
}

describe("PLUGIN_KEYWORDS names real plugins", () => {
  it("reads a non-empty catalog, so an empty set cannot pass the next test", () => {
    expect(everyPluginName().size).toBeGreaterThan(60);
  });

  it("has no key that is not a plugin name", () => {
    const known = everyPluginName();
    const unknownKeys = Object.keys(PLUGIN_KEYWORDS).filter(
      (name) => !known.has(name)
    );
    expect(unknownKeys).toEqual([]);
  });
});

describe("the argument shapes each entry expects", () => {
  it("reads the exclusive flag of .min() / .max() the way the reader writes it", () => {
    // The reading direction maps exclusiveMinimum onto a flag. Get that
    // boundary wrong here and the emitted schema is off by one.
    expect(PLUGIN_KEYWORDS["numberMin"]?.([5])).toEqual({ minimum: 5 });
    expect(PLUGIN_KEYWORDS["numberMin"]?.([5, true])).toEqual({
      exclusiveMinimum: 5,
    });
    expect(PLUGIN_KEYWORDS["numberMax"]?.([5, true])).toEqual({
      exclusiveMaximum: 5,
    });
  });

  it("writes a pattern as its ECMA-262 source, not as a RegExp", () => {
    expect(PLUGIN_KEYWORDS["stringPattern"]?.([/^a.c$/])).toEqual({
      pattern: "^a.c$",
    });
  });

  it("returns null for the declarations the type and required side handles", () => {
    for (const name of ["required", "optional", "nullable", "numberInteger"]) {
      expect(PLUGIN_KEYWORDS[name]?.([])).toBeNull();
    }
  });
});
