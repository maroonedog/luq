import { buildPluginCatalog } from "../catalog/build-plugin-catalog";
import { buildRepositoryExportMap } from "../catalog/build-repository-export-map";
import { readSubpathAliases } from "../catalog/read-subpath-aliases";
import type { PackageExportMap } from "../catalog/plugin-catalog.types";

export interface SubpathEntry {
  /** The package.json#/exports key, e.g. "./plugins/stringMin". */
  readonly exportKey: string;
  /** The dist path stem the key points at, e.g. "plugins/stringMin". */
  readonly distBase: string;
  /** The emitted module stem that answers it, e.g. "plugins/string-min/index". */
  readonly moduleBase: string;
}

/** Non-plugin keys and the source module each one publishes. */
const FIXED_KEY_ENTRY_FILE: Readonly<Record<string, string>> = {
  ".": "src/index.ts",
  "./result": "src/result/index.ts",
  "./plugin-kit": "src/plugin-kit/index.ts",
  "./field-rule": "src/field-rule/index.ts",
  "./async": "src/async/index.ts",
  "./standard-schema": "src/standard-schema/index.ts",
  "./presets": "src/presets/index.ts",
  "./plugins": "src/plugins/index.generated.ts",
};

/** "./dist/plugins/stringMin.js" -> "plugins/stringMin". */
export function toDistBase(requireTarget: string): string {
  return requireTarget.replace(/^\.\/dist\//, "").replace(/\.js$/, "");
}

/** "src/plugins/string-min/index.ts" -> "plugins/string-min/index". */
export function toModuleBase(entryFile: string): string {
  return entryFile.replace(/^src\//, "").replace(/\.ts$/, "");
}

/**
 * Every published subpath, paired with the emitted module that answers it.
 *
 * The export map is the input, not a second list: a key that the catalog
 * generates but this function cannot source is an error, so a subpath can
 * never be published with nothing behind it.
 */
export function readSubpathEntries(
  repositoryRoot: string,
  exportMap: PackageExportMap = buildRepositoryExportMap(repositoryRoot)
): readonly SubpathEntry[] {
  const entryFileByKey = readEntryFileByExportKey(repositoryRoot);
  return Object.entries(exportMap)
    .filter(([exportKey]) => exportKey !== "./package.json")
    .map(([exportKey, target]) => {
      const entryFile = entryFileByKey[exportKey];
      if (entryFile === undefined || typeof target === "string") {
        throw new Error(
          `the export key "${exportKey}" has no corresponding source entry.`
        );
      }
      return {
        exportKey,
        distBase: toDistBase(target.require),
        moduleBase: toModuleBase(entryFile),
      };
    });
}

function readEntryFileByExportKey(
  repositoryRoot: string
): Readonly<Record<string, string>> {
  const byKey: Record<string, string> = { ...FIXED_KEY_ENTRY_FILE };
  for (const entry of buildPluginCatalog(repositoryRoot).entries) {
    byKey[`./plugins/${entry.subpathName}`] = entry.entryFile;
  }
  for (const alias of readSubpathAliases(repositoryRoot)) {
    byKey[`./plugins/${alias.subpathName}`] =
      `src/subpath-aliases/${alias.moduleName}.ts`;
  }
  return byKey;
}
