import * as path from "path";
import type { PluginSourceRoot, SubpathAlias } from "./plugin-catalog.types";

/** Two levels up from here is the repository root. */
export const REPOSITORY_ROOT = path.resolve(__dirname, "..", "..");

/**
 * Where plugin directories are looked for. Anything outside these is not a
 * plugin.
 *
 * Within the JSON Schema layer, only the extensions directory holds plugins;
 * everything else there is a module of that layer. Limiting the scan root to
 * the extensions directory guarantees that structurally rather than by
 * convention. Settled design.
 */
export const PLUGIN_SOURCE_ROOTS: readonly PluginSourceRoot[] = [
  { tier: "isolated", directory: "src/plugins" },
  { tier: "extension", directory: "src/json-schema/extensions" },
];

/** A compatibility subpath with no directory, keeping a name an earlier release published. */
export const SUBPATH_ALIASES: readonly SubpathAlias[] = [
  { subpathName: "readOnlyWriteOnly", moduleName: "read-only-write-only" },
];

/**
 * The fixed export keys that are not plugins. Their order is the order they
 * appear in package.json.
 *
 * `./field-rule` was added after the fact: the code was implemented, tested
 * and shipped in dist, yet no export key pointed at it, so a user could not
 * reach it. Faced with shipping something unimportable or deleting it,
 * publishing it was the choice.
 */
export const FIXED_EXPORT_KEYS: readonly string[] = [
  ".",
  "./package.json",
  "./result",
  "./plugin-kit",
  "./field-rule",
  "./async",
  "./standard-schema",
  "./presets",
  "./plugins",
  "./schema-tooling",
];

export const PLUGIN_MANIFEST_OUTPUT = "src/plugins/manifest.generated.ts";
export const PLUGIN_BARREL_OUTPUT = "src/plugins/index.generated.ts";
/** The published name, so a generated artefact can state what to import. */
export const PACKAGE_NAME = "@maroonedog/luq";
export const SLOT_CATALOG_OUTPUT = "src/chain/slot-catalog.generated.ts";
export const PLUGIN_CATALOG_LOCK_OUTPUT = "config/plugin-catalog.lock.json";
