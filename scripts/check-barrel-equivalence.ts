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
 * `@maroonedog/luq/plugins` から取ったものと
 * `@maroonedog/luq/plugins/<name>` から取ったものが同じであることを検査する。
 *
 * 旧実装ではこの2つが乖離していた (バレルが名指す symbol とサブパスとして
 * 公開されている名前の集合が一致せず、README が案内する import が
 * ERR_PACKAGE_PATH_NOT_EXPORTED で落ちた)。乖離は3つの形で起きるので3つ見る:
 *   1. 名前の集合がずれる (バレルにしか無い / サブパスにしか無い)
 *   2. 名前は同じだが別物を指す (再 export 先の付け替え)
 *   3. 同じ物を指すが、バレル経由だと捨てられずサイズが膨らむ
 * 3 は「バレルは tree-shaking を壊すので使うな」という旧実装の但し書きを
 * 不要にするための検査であり、公開している以上これが本体である。
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
    throw new Error(`${relativePath}: モジュールを読めませんでした`);
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
      detail: `${symbol} はサブパスにあるのにバレルにありません`,
    }));
  const extra = barrelNames
    .filter((name) => !catalogSymbols.includes(name))
    .map((name) => ({
      kind: "extra-in-barrel" as const,
      detail: `${name} はバレルにあるのに対応する公開サブパスがありません`,
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
            `${symbol}: バレルとサブパス ${entry.entryFile} が同一の値を` +
            `指していません`,
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
    `  ${plugins.join(", ")}: サブパス ${String(viaSubpath.gzipBytes)} B / ` +
      `バレル ${String(viaBarrel.gzipBytes)} B (差 ${percent.toFixed(2)}%)`
  );
  if (percent <= maxDivergencePercent) return [];
  return [
    {
      kind: "size" as const,
      detail:
        `バレル経由 ${String(viaBarrel.gzipBytes)} B とサブパス経由 ` +
        `${String(viaSubpath.gzipBytes)} B の差が ${percent.toFixed(2)}% で、` +
        `許容 ${String(maxDivergencePercent)}% を超えています`,
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
    console.error("バレル等価性:");
    const divergences = findBarrelDivergences(REPOSITORY_ROOT);
    if (divergences.length === 0) {
      console.error("バレル等価性: 乖離なし");
      return 0;
    }
    console.error(`バレル等価性の乖離 ${String(divergences.length)} 件:`);
    for (const one of divergences) console.error(`  ${one.detail}`);
    return 1;
  });
}
