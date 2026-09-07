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
 * config/size-budget.json の予算に対して実測し、超えていたら落とす。
 *
 * 旧実装は「19-23KB gzipped, tree-shakeable」を README の散文としてだけ持ち、
 * その 17.4KB が使う前に払う中核の床だったことは誰も検査していなかった。
 * ここが「使わないぶんは入らない」を数値で言い切る唯一の場所である。
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
    throw new Error(`treeShaking が知らない予算 id "${id}" を指しています`);
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
          `${budget.id}: gzip ${String(gzipBytes)} B が天井 ` +
          `${String(budget.gzipCeilingBytes)} B を ` +
          `${String(gzipBytes - budget.gzipCeilingBytes)} B 超えています`,
      },
    ];
  });
}

/**
 * 「足したぶんだけ増える」を検査する。
 * 増分がプラグイン1個あたりの下限を割ったら、そのプラグインは既に中核から
 * 到達可能になっている (= プラグイン単位の tree-shaking が壊れている)。
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
        `treeShaking.orderedByPluginCount: ${previousId} → ${id} で` +
          `プラグイン数が増えていません`
      );
    }
    const grew = current.gzipBytes - previous.gzipBytes;
    const required = addedPlugins * floorPerPlugin;
    if (grew >= required) return [];
    return [
      {
        kind: "weak-increment" as const,
        detail:
          `${previousId} → ${id}: プラグインを ${String(addedPlugins)} 個` +
          `足したのに gzip は ${String(grew)} B しか増えていません ` +
          `(下限 ${String(required)} B)。そのプラグインは既に中核から` +
          `到達可能です。`,
      },
    ];
  });
}

/** 「使わないぶんは入らない」の逆側: 中核の床が全部入りに対して小さいこと。 */
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
        `中核だけで全部入りの ${share.toFixed(1)}% を占めています ` +
        `(上限 ${String(budget.treeShaking.maxCoreShareOfFullPercent)}%)。` +
        `プラグイン単位の tree-shaking が意味を失っています。`,
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
      : ` 旧実装 ${String(budget.legacyGzipBytes)} B (` +
        `${((measurement.gzipBytes / budget.legacyGzipBytes - 1) * 100).toFixed(
          1
        )}%)`;
  console.error(
    `  ${budget.id.padEnd(14)} raw ${String(measurement.rawBytes).padStart(6)} B` +
      ` / gzip ${String(measurement.gzipBytes).padStart(6)} B` +
      ` / 天井 ${String(budget.gzipCeilingBytes)} B${legacy}`
  );
}

if (require.main === module) {
  runCheckAndExit(() => {
    const budget = readSizeBudget(REPOSITORY_ROOT);
    const catalog = buildPluginCatalog(REPOSITORY_ROOT);
    const measurements = budget.budgets.map((one) =>
      measureBudget(REPOSITORY_ROOT, catalog, one)
    );
    console.error("バンドルサイズ実測 (esbuild + gzip, src から):");
    budget.budgets.forEach((one, index) => {
      const measurement = measurements[index];
      if (measurement !== undefined) reportMeasurement(one, measurement);
    });
    const violations = findSizeViolations(budget, measurements);
    if (violations.length === 0) {
      console.error("サイズ予算: 違反なし");
      return 0;
    }
    console.error(`サイズ予算違反 ${String(violations.length)} 件:`);
    for (const violation of violations) console.error(`  ${violation.detail}`);
    return 1;
  });
}
