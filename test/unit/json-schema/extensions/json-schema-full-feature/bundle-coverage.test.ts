// ===========================================================================
// "The use() list is derived from the keyword map" — as a checked property.
//
// Every assertion here is paired with a MUTATION: the same function is run
// against a deliberately wrong bag or a deliberately wrong declaration list and
// must report the difference. Without that pair, "it returned an empty array"
// and "it can only ever return an empty array" are indistinguishable, which is
// exactly the failure mode this repository has already produced three times.
// ===========================================================================
import {
  UNBOUND_BUNDLED_PLUGIN_NAMES,
  findStaleUnboundDeclarations,
  findUnbundledBoundPlugins,
  findUnexplainedBundledPlugins,
  jsonSchemaBag,
  listBundledPluginNames,
} from "../../../../../src/json-schema/extensions/json-schema-full-feature";
import { listBoundPluginNames } from "../../../../../src/json-schema";
import type { JsonSchemaBag } from "../../../../../src/json-schema";
import { stringStartsWithPlugin } from "../../../../../src/plugins/string-starts-with";

/** A bag with one member replaced. Typed, so it stays a real JsonSchemaBag. */
function bagWithout(key: keyof JsonSchemaBag): JsonSchemaBag {
  return { ...jsonSchemaBag, [key]: stringStartsWithPlugin };
}

describe("the bundle covers every bound plugin", () => {
  it("leaves nothing a keyword or format binding names unbundled", () => {
    expect(findUnbundledBoundPlugins(jsonSchemaBag)).toEqual([]);
  });

  it("MUTATION: dropping a bound plugin from the bag is reported", () => {
    expect(findUnbundledBoundPlugins(bagWithout("stringMin"))).toEqual([
      "stringMin",
    ]);
  });

  it("MUTATION: dropping a bound FORMAT plugin is reported too", () => {
    expect(findUnbundledBoundPlugins(bagWithout("uuid"))).toEqual(["uuid"]);
  });
});

describe("the bundle carries nothing it cannot explain", () => {
  it("explains every bundled plugin as bound or converter-driven", () => {
    expect(findUnexplainedBundledPlugins(jsonSchemaBag)).toEqual([]);
  });

  it("MUTATION: an unbound, undeclared plugin in the bag is reported", () => {
    expect(findUnexplainedBundledPlugins(bagWithout("compareField"))).toEqual([
      "stringStartsWith",
    ]);
  });
});

describe("the declared exemptions stay honest", () => {
  it("declares no plugin that a binding already names", () => {
    expect(findStaleUnboundDeclarations()).toEqual([]);
  });

  it("MUTATION: declaring a plugin that IS bound is reported as stale", () => {
    expect(findStaleUnboundDeclarations(["stringMin", "arrayEach"])).toEqual([
      "stringMin",
    ]);
  });

  it("names fourteen plugins, and each one is really in the bag", () => {
    const bundled = new Set(listBundledPluginNames(jsonSchemaBag));
    expect(UNBOUND_BUNDLED_PLUGIN_NAMES).toHaveLength(14);
    expect(
      UNBOUND_BUNDLED_PLUGIN_NAMES.filter((name) => !bundled.has(name))
    ).toEqual([]);
  });
});

describe("the counted split", () => {
  it("is bound + declared-unbound = bundled, with no overlap", () => {
    const bound = listBoundPluginNames();
    const bundled = listBundledPluginNames(jsonSchemaBag);
    expect(bound.length + UNBOUND_BUNDLED_PLUGIN_NAMES.length).toBe(
      bundled.length
    );
    expect(
      bound.filter((name) => UNBOUND_BUNDLED_PLUGIN_NAMES.includes(name))
    ).toEqual([]);
  });

  it("reports the plugin names sorted, so a diff is readable", () => {
    const names = listBundledPluginNames(jsonSchemaBag);
    expect([...names].sort()).toEqual(names);
  });
});
