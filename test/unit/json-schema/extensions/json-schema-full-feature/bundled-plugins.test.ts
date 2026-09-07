// ===========================================================================
// The bundled bag: it holds exactly the plugins the bag TYPE declares, every
// member is a real plugin object, and nothing can be swapped into it later.
// ===========================================================================
import { jsonSchemaBag } from "../../../../../src/json-schema/extensions/json-schema-full-feature";
import { PLUGIN_MANIFEST } from "../../../../../src/plugins/manifest.generated";

const members = Object.entries(jsonSchemaBag);

describe("the bundled bag", () => {
  it("bundles forty-nine plugins", () => {
    expect(members).toHaveLength(49);
  });

  it("is frozen, so a caller cannot swap a plugin after the fact", () => {
    expect(Object.isFrozen(jsonSchemaBag)).toBe(true);
  });

  it("holds a real plugin object under every key", () => {
    const malformed = members.filter(
      ([, plugin]) =>
        typeof plugin.name !== "string" ||
        typeof plugin.method !== "string" ||
        !Array.isArray(plugin.slots) ||
        typeof plugin.build !== "function"
    );
    expect(malformed.map(([key]) => key)).toEqual([]);
  });

  it("holds no plugin twice", () => {
    const names = members.map(([, plugin]) => plugin.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("bundles only plugins the catalogue actually ships", () => {
    const shipped = new Set(
      PLUGIN_MANIFEST.flatMap((entry) => entry.exportedSymbols)
    );
    // The manifest names SYMBOLS; the bag holds the objects those symbols
    // export, so the check is that each bag member's symbol name is one the
    // catalogue publishes. `uuidPlugin` is the reason this is not a check on
    // `plugin.name`: its name is "stringUuid" while its symbol is "uuidPlugin".
    const expectedSymbols = members.map(([key]) => `${key}Plugin`);
    const unknown = expectedSymbols.filter((symbol) => !shipped.has(symbol));
    expect(unknown).toEqual([]);
  });

  it("does not bundle itself, and does not bundle the other bundle", () => {
    const names = members.map(([, plugin]) => plugin.name);
    expect(names).not.toContain("jsonSchema");
    expect(names).not.toContain("jsonSchemaFullFeature");
  });
});
