import * as path from "path";
import { buildPluginCatalog } from "./catalog/build-plugin-catalog";
import type { PluginCatalog } from "./catalog/plugin-catalog.types";
import {
  PLUGIN_BARREL_OUTPUT,
  REPOSITORY_ROOT,
} from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import {
  createBarrelEntrySource,
  createSubpathEntrySource,
} from "./bundle-size/create-entry-source";
import { measureGzippedBundle } from "./bundle-size/measure-gzipped-bundle";
import { readSizeBudget } from "./bundle-size/read-size-budget";

/**
 * Checks that taking a plugin from the barrel and taking it from its own
 * subpath give the same thing.
 *
 * In the previous major the two had drifted apart: the symbols the barrel
 * named and the names published as subpaths were different sets, and an import
 * the README recommended failed to resolve. Drift takes three forms, so three
 * are checked:
 *   1. the name sets differ (in one and not the other)
 *   2. the same name points at different things (a re-export was repointed)
 *   3. they point at the same thing, but going through the barrel keeps code
 *      that the subpath drops
 * The third is what makes "do not use the barrel, it breaks tree-shaking"
 * unnecessary as a caveat — and since the barrel is published, that is the
 * point of this check.
 */
export interface BarrelDivergence {
  readonly kind:
    | "missing-in-barrel"
    | "extra-in-barrel"
    | "not-identical"
    | "size";
  readonly detail: string;
}

interface LoadedModule {
  readonly specifier: string;
  readonly exports: Record<string, unknown>;
}

function loadModule(
  repositoryRoot: string,
  relativePath: string
): LoadedModule {
  const absolutePath = path.join(repositoryRoot, relativePath);
  const loaded: unknown = require(absolutePath);
  if (typeof loaded !== "object" || loaded === null) {
    throw new Error(`${relativePath}: the module could not be read`);
  }
  return {
    specifier: relativePath,
    exports: loaded as Record<string, unknown>,
  };
}

function readExportedNames(loaded: LoadedModule): readonly string[] {
  return Object.keys(loaded.exports).filter((name) => name !== "__esModule");
}

function findNameSetDivergences(
  barrel: LoadedModule,
  catalog: PluginCatalog
): BarrelDivergence[] {
  const catalogSymbols = catalog.entries.flatMap(
    (entry) => entry.exportedSymbols
  );
  const barrelNames = readExportedNames(barrel);
  const missing = catalogSymbols
    .filter((symbol) => !barrelNames.includes(symbol))
    .map((symbol) => ({
      kind: "missing-in-barrel" as const,
      detail: `${symbol} is published as a subpath but missing from the barrel`,
    }));
  const extra = barrelNames
    .filter((name) => !catalogSymbols.includes(name))
    .map((name) => ({
      kind: "extra-in-barrel" as const,
      detail: `${name} is in the barrel but has no published subpath`,
    }));
  return [...missing, ...extra];
}

function findIdentityDivergences(
  repositoryRoot: string,
  barrel: LoadedModule,
  catalog: PluginCatalog
): BarrelDivergence[] {
  return catalog.entries.flatMap((entry) => {
    const subpath = loadModule(repositoryRoot, entry.entryFile);
    return entry.exportedSymbols.flatMap((symbol) => {
      const fromBarrel = barrel.exports[symbol];
      const fromSubpath = subpath.exports[symbol];
      if (fromBarrel !== undefined && fromBarrel === fromSubpath) return [];
      return [
        {
          kind: "not-identical" as const,
          detail:
            `${symbol}: the barrel and the subpath ${entry.entryFile} do not ` +
            `point at the same value`,
        },
      ];
    });
  });
}

function findSizeDivergence(
  repositoryRoot: string,
  catalog: PluginCatalog,
  plugins: readonly string[],
  maxDivergencePercent: number
): BarrelDivergence[] {
  const viaSubpath = measureGzippedBundle(
    repositoryRoot,
    createSubpathEntrySource(catalog, plugins)
  );
  const viaBarrel = measureGzippedBundle(
    repositoryRoot,
    createBarrelEntrySource(catalog, plugins)
  );
  const divergence =
    Math.abs(viaBarrel.gzipBytes - viaSubpath.gzipBytes) / viaSubpath.gzipBytes;
  const percent = divergence * 100;
  console.error(
    `  ${plugins.join(", ")}: subpath ${String(viaSubpath.gzipBytes)} B / ` +
      `barrel ${String(viaBarrel.gzipBytes)} B (${percent.toFixed(2)}% apart)`
  );
  if (percent <= maxDivergencePercent) return [];
  return [
    {
      kind: "size" as const,
      detail:
        `via the barrel ${String(viaBarrel.gzipBytes)} B against ` +
        `${String(viaSubpath.gzipBytes)} B via the subpath, ${percent.toFixed(2)}% ` +
        `apart, over the ${String(maxDivergencePercent)}% allowed`,
    },
  ];
}

export function findBarrelDivergences(
  repositoryRoot: string
): readonly BarrelDivergence[] {
  const catalog = buildPluginCatalog(repositoryRoot);
  const barrel = loadModule(repositoryRoot, PLUGIN_BARREL_OUTPUT);
  const budget = readSizeBudget(repositoryRoot);
  return [
    ...findNameSetDivergences(barrel, catalog),
    ...findIdentityDivergences(repositoryRoot, barrel, catalog),
    ...findSizeDivergence(
      repositoryRoot,
      catalog,
      budget.barrelEquivalence.plugins,
      budget.barrelEquivalence.maxDivergencePercent
    ),
  ];
}

if (require.main === module) {
  runCheckAndExit(() => {
    console.error("Barrel equivalence:");
    const divergences = findBarrelDivergences(REPOSITORY_ROOT);
    if (divergences.length === 0) {
      console.error("Barrel equivalence: no divergence");
      return 0;
    }
    console.error(
      `Barrel equivalence: ${String(divergences.length)} divergences:`
    );
    for (const one of divergences) console.error(`  ${one.detail}`);
    return 1;
  });
}
