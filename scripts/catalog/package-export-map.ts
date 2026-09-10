import type {
  ExportConditions,
  PackageExportMap,
  PluginCatalog,
  SubpathAlias,
} from "./plugin-catalog.types";
import { FIXED_EXPORT_KEYS, SUBPATH_ALIASES } from "./plugin-source-roots";

const DIST_BASE_BY_FIXED_KEY: Readonly<Record<string, string>> = {
  ".": "index",
  "./result": "result",
  "./plugin-kit": "plugin-kit",
  "./field-rule": "field-rule",
  "./async": "async",
  "./standard-schema": "standard-schema",
  "./presets": "presets/index",
  "./plugins": "plugins/index",
};

export function toDistConditions(distBase: string): ExportConditions {
  return {
    types: `./dist/${distBase}.d.ts`,
    import: `./dist/${distBase}.mjs`,
    require: `./dist/${distBase}.js`,
  };
}

export function toPluginSubpath(subpathName: string): string {
  return `./plugins/${subpathName}`;
}

/**
 * The one generator of package.json#/exports: fixed keys, then plugins, then
 * compatibility aliases. With an empty catalog it still produces a correct map
 * holding just the fixed keys.
 */
export function buildPackageExportMap(
  catalog: PluginCatalog,
  aliases: readonly SubpathAlias[] = SUBPATH_ALIASES
): PackageExportMap {
  const exportMap: Record<string, ExportConditions | string> = {};
  for (const key of FIXED_EXPORT_KEYS) {
    if (key === "./package.json") {
      exportMap[key] = "./package.json";
      continue;
    }
    const distBase = DIST_BASE_BY_FIXED_KEY[key];
    if (distBase === undefined) {
      throw new Error(`the fixed export key "${key}" has no dist target.`);
    }
    exportMap[key] = toDistConditions(distBase);
  }
  for (const entry of catalog.entries) {
    exportMap[toPluginSubpath(entry.subpathName)] = toDistConditions(
      `plugins/${entry.subpathName}`
    );
  }
  for (const alias of [...aliases].sort((left, right) =>
    left.subpathName.localeCompare(right.subpathName)
  )) {
    exportMap[toPluginSubpath(alias.subpathName)] = toDistConditions(
      `plugins/${alias.subpathName}`
    );
  }
  return exportMap;
}
