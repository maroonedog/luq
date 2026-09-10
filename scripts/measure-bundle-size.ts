import { buildPluginCatalog } from "./catalog/build-plugin-catalog";
import type { PluginCatalog } from "./catalog/plugin-catalog.types";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import {
  createSubpathEntrySource,
  selectCatalogEntries,
} from "./bundle-size/create-entry-source";
import { measureGzippedBundle } from "./bundle-size/measure-gzipped-bundle";
import { readSizeBudget } from "./bundle-size/read-size-budget";
import type {
  BundleBudget,
  BundleMeasurement,
  SizeBudget,
} from "./bundle-size/size-budget.types";

/**
 * Measures against the budget and fails when a ceiling is exceeded.
 *
 * The previous major carried "19-23KB gzipped, tree-shakeable" as prose in its
 * README, and nobody ever checked that most of it was the core floor paid
 * before using anything. This is the one place where "you only ship what you
 * used" is stated as a number.
 */
export interface SizeViolation {
  readonly kind: "over-budget" | "weak-increment" | "core-share";
  readonly detail: string;
}

function measureBudget(
  repositoryRoot: string,
  catalog: PluginCatalog,
  budget: BundleBudget
): BundleMeasurement {
  const source = createSubpathEntrySource(catalog, budget.plugins);
  const size = measureGzippedBundle(repositoryRoot, source);
  return {
    id: budget.id,
    pluginCount: selectCatalogEntries(catalog, budget.plugins).length,
    rawBytes: size.rawBytes,
    gzipBytes: size.gzipBytes,
  };
}

function findMeasurement(
  measurements: readonly BundleMeasurement[],
  id: string
): BundleMeasurement {
  const found = measurements.find((one) => one.id === id);
  if (found === undefined) {
    throw new Error(`treeShaking names an unknown budget id "${id}"`);
  }
  return found;
}

function findGzipBytes(
  measurements: readonly BundleMeasurement[],
  id: string
): number {
  return findMeasurement(measurements, id).gzipBytes;
}

function findOverBudget(
  budgets: readonly BundleBudget[],
  measurements: readonly BundleMeasurement[]
): SizeViolation[] {
  return budgets.flatMap((budget) => {
    const gzipBytes = findGzipBytes(measurements, budget.id);
    if (gzipBytes <= budget.gzipCeilingBytes) return [];
    return [
      {
        kind: "over-budget" as const,
        detail:
          `${budget.id}: gzip ${String(gzipBytes)} B is ` +
          `${String(gzipBytes - budget.gzipCeilingBytes)} B over the ` +
          `${String(budget.gzipCeilingBytes)} B ceiling`,
      },
    ];
  });
}

/**
 * Checks that adding a plugin actually adds its weight.
 *
 * An increase below the per-plugin floor means that plugin was already
 * reachable from the core, which is per-plugin tree-shaking being broken.
 */
function findWeakIncrements(
  budget: SizeBudget,
  measurements: readonly BundleMeasurement[]
): SizeViolation[] {
  const ordered = budget.treeShaking.orderedByPluginCount;
  const floorPerPlugin = budget.treeShaking.minGzipBytesPerAddedPlugin;
  return ordered.flatMap((id, index) => {
    const previousId = index === 0 ? undefined : ordered[index - 1];
    if (previousId === undefined) return [];
    const previous = findMeasurement(measurements, previousId);
    const current = findMeasurement(measurements, id);
    const addedPlugins = current.pluginCount - previous.pluginCount;
    if (addedPlugins <= 0) {
      throw new Error(
        `treeShaking.orderedByPluginCount: ${previousId} → ${id} does not ` +
          `increase the plugin count`
      );
    }
    const grew = current.gzipBytes - previous.gzipBytes;
    const required = addedPlugins * floorPerPlugin;
    if (grew >= required) return [];
    return [
      {
        kind: "weak-increment" as const,
        detail:
          `${previousId} → ${id}: ${String(addedPlugins)} plugins added but ` +
          `gzip grew only ${String(grew)} B (floor ${String(required)} B). ` +
          `They are already reachable from the core.`,
      },
    ];
  });
}

/** The other side of "ship only what you used": the core floor stays small
 *  relative to the everything build. */
function findCoreShareViolation(
  budget: SizeBudget,
  measurements: readonly BundleMeasurement[]
): SizeViolation[] {
  const ordered = budget.treeShaking.orderedByPluginCount;
  const smallestId = ordered[0];
  const largestId = ordered[ordered.length - 1];
  if (smallestId === undefined || largestId === undefined) return [];
  const share =
    (findGzipBytes(measurements, smallestId) /
      findGzipBytes(measurements, largestId)) *
    100;
  if (share <= budget.treeShaking.maxCoreShareOfFullPercent) return [];
  return [
    {
      kind: "core-share" as const,
      detail:
        `the core alone is ${share.toFixed(1)}% of the everything build ` +
        `(limit ${String(budget.treeShaking.maxCoreShareOfFullPercent)}%), ` +
        `so per-plugin tree-shaking has stopped meaning anything.`,
    },
  ];
}

export function findSizeViolations(
  budget: SizeBudget,
  measurements: readonly BundleMeasurement[]
): readonly SizeViolation[] {
  return [
    ...findOverBudget(budget.budgets, measurements),
    ...findWeakIncrements(budget, measurements),
    ...findCoreShareViolation(budget, measurements),
  ];
}

function reportMeasurement(
  budget: BundleBudget,
  measurement: BundleMeasurement
): void {
  const legacy =
    budget.legacyGzipBytes === undefined
      ? ""
      : ` legacy ${String(budget.legacyGzipBytes)} B (` +
        `${((measurement.gzipBytes / budget.legacyGzipBytes - 1) * 100).toFixed(
          1
        )}%)`;
  console.error(
    `  ${budget.id.padEnd(14)} raw ${String(measurement.rawBytes).padStart(6)} B` +
      ` / gzip ${String(measurement.gzipBytes).padStart(6)} B` +
      ` / ceiling ${String(budget.gzipCeilingBytes)} B${legacy}`
  );
}

if (require.main === module) {
  runCheckAndExit(() => {
    const budget = readSizeBudget(REPOSITORY_ROOT);
    const catalog = buildPluginCatalog(REPOSITORY_ROOT);
    const measurements = budget.budgets.map((one) =>
      measureBudget(REPOSITORY_ROOT, catalog, one)
    );
    console.error("Bundle sizes measured (esbuild + gzip, from src):");
    budget.budgets.forEach((one, index) => {
      const measurement = measurements[index];
      if (measurement !== undefined) reportMeasurement(one, measurement);
    });
    const violations = findSizeViolations(budget, measurements);
    if (violations.length === 0) {
      console.error("Size budget: no violations");
      return 0;
    }
    console.error(`Size budget: ${String(violations.length)} violations:`);
    for (const violation of violations) console.error(`  ${violation.detail}`);
    return 1;
  });
}
