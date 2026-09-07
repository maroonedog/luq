// ===========================================================================
// L8 (tier `extension`)
// src/json-schema/extensions/json-schema-full-feature/bundle-coverage.ts
//
// The run-time half of "the use() list is derived from the keyword map".
//
// WHY NOT A CODE GENERATOR (measured, and reported as a deviation): the design
// says the list is a GENERATED file. Generating it needs a new script and a new
// npm script, both outside step 26's produces list, and a generator can only
// ever restate what these two pure functions CHECK. So the property is enforced
// instead of emitted: the bag type makes the list exact at compile time, and
// these two functions make it agree with the keyword and format tables at run
// time. Both are asserted in the unit test, which runs inside `npm run verify`.
//
// WHY NOT AT MODULE LOAD: throwing from an import would make the subpath
// unloadable and give the bundler a side effect to preserve. The check belongs
// to the build, and the build runs the tests.
// ===========================================================================
import { listBoundPluginNames, type JsonSchemaBag } from "../../index";

/**
 * Plugins the bundle carries that NO keyword or format binding names.
 *
 * Every one is driven by the converter itself (a structural expansion calls
 * `plugin.build` directly) or is reachable only from a hand-written chain. The
 * list is the MEASURED complement of `listBoundPluginNames()`: 31 names are
 * bound, 45 are bundled, and these are the 14 that are left. It is written out
 * rather than derived so that a change on EITHER side — a new binding, or a
 * plugin leaving the bag — fails the test instead of quietly re-balancing.
 *
 * `required` is deliberately NOT here: keyword-map-object.ts binds it, even
 * though declare-presence.ts builds the child-property presence rule from
 * create-rule instead (see its header for why `.required()` is the wrong shape
 * for Draft-07 §6.5.3).
 */
export const UNBOUND_BUNDLED_PLUGIN_NAMES: readonly string[] = Object.freeze([
  // Driven by a structural expansion through `plugin.build`.
  "arrayContains",
  "arrayEach",
  "conditionalSchema",
  "numberInteger",
  "objectAdditionalPropertiesSchema",
  "objectDependentRequired",
  "objectDependentSchemas",
  "objectPatternProperties",
  "objectPropertyNames",
  "oneOf",
  // Reachable only from a hand-written chain; the converter never calls them.
  "compareField",
  "nullable",
  "optional",
  "tupleBuilder",
]);

/** The plugin NAMES the bag carries. Not its keys: bindings name `plugin.name`. */
export function listBundledPluginNames(bag: JsonSchemaBag): readonly string[] {
  return Object.values(bag)
    .map((plugin) => plugin.name)
    .sort();
}

/**
 * A keyword or format is bound to a plugin the bundle does not ship. Non-empty
 * means `fromJsonSchema` would reach for a missing member at build time.
 */
export function findUnbundledBoundPlugins(
  bag: JsonSchemaBag
): readonly string[] {
  const bundled = new Set(listBundledPluginNames(bag));
  return listBoundPluginNames().filter((name) => !bundled.has(name));
}

/**
 * The bundle ships a plugin that no binding names AND that is not declared
 * above as converter-driven. Non-empty means the bundle grew weight nothing
 * asked for, or that a declared exemption is now bound and should be deleted.
 */
export function findUnexplainedBundledPlugins(
  bag: JsonSchemaBag
): readonly string[] {
  const explained = new Set([
    ...listBoundPluginNames(),
    ...UNBOUND_BUNDLED_PLUGIN_NAMES,
  ]);
  return listBundledPluginNames(bag).filter((name) => !explained.has(name));
}

/**
 * A declared exemption that has since become bound. Stale; delete it.
 *
 * `declared` is a parameter so the check can be run against a list that is
 * deliberately wrong — otherwise "it returns nothing" and "it can never return
 * anything" look the same from a test.
 */
export function findStaleUnboundDeclarations(
  declared: readonly string[] = UNBOUND_BUNDLED_PLUGIN_NAMES
): readonly string[] {
  const bound = new Set(listBoundPluginNames());
  return declared.filter((name) => bound.has(name));
}
