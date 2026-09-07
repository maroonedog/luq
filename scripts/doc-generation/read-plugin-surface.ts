import * as fs from "fs";
import * as path from "path";
import { buildPluginCatalog } from "../catalog/build-plugin-catalog";
import type { PluginTier } from "../catalog/plugin-catalog.types";
import { SUBPATH_ALIASES } from "../catalog/plugin-source-roots";

/**
 * 1つのプラグインについて、利用者から見える3つの事実。
 * どれも手で書いた表からではなく、ビルド済みモジュールを読んで得る。
 */
export interface PluginSurfaceEntry {
  readonly subpath: string;
  readonly symbol: string;
  readonly method: string;
  readonly slots: readonly string[];
  readonly tier: PluginTier;
  /** 1.x の名前を残すためだけのサブパス。新しいプラグインではない。 */
  readonly isAlias: boolean;
}

export class PluginSurfaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginSurfaceError";
  }
}

/** definePlugin が返す4つのメンバーのうち、ドキュメントに出る3つ。 */
interface LoadedPlugin {
  readonly name: string;
  readonly method: string;
  readonly slots: readonly string[];
}

function isLoadedPlugin(candidate: unknown): candidate is LoadedPlugin {
  if (candidate === null || typeof candidate !== "object") return false;
  const shape = candidate as Record<string, unknown>;
  return (
    typeof shape.name === "string" &&
    typeof shape.method === "string" &&
    Array.isArray(shape.slots)
  );
}

function loadBuiltModule(
  repositoryRoot: string,
  subpathName: string
): Record<string, unknown> {
  const built = path.join(
    repositoryRoot,
    "dist",
    "plugins",
    `${subpathName}.js`
  );
  if (!fs.existsSync(built)) {
    throw new PluginSurfaceError(
      `${built} がありません。先に npm run build を実行してください。`
    );
  }
  // 型検査済みの d.ts ではなく、実際に配る CJS を読む。表に出る method / slots は
  // 「配ったものがそう言っている」ことにしたい。
  const loaded: unknown = require(built);
  if (loaded === null || typeof loaded !== "object") {
    throw new PluginSurfaceError(
      `${built} がオブジェクトを export していません`
    );
  }
  return loaded as Record<string, unknown>;
}

/**
 * カタログ (= ディレクトリ構造) を歩き、各エントリが export するシンボルを
 * ビルド済みモジュールから読み出す。互換エイリアスのサブパスも同じ扱いで並べる。
 */
export function readPluginSurface(
  repositoryRoot: string
): readonly PluginSurfaceEntry[] {
  const catalog = buildPluginCatalog(repositoryRoot);
  const fromDirectories = catalog.entries.flatMap((entry) => {
    const loadedModule = loadBuiltModule(repositoryRoot, entry.subpathName);
    return entry.exportedSymbols.map((symbol) => {
      const plugin = loadedModule[symbol];
      if (!isLoadedPlugin(plugin)) {
        throw new PluginSurfaceError(
          `${entry.subpathName} の ${symbol} がプラグインの形をしていません`
        );
      }
      return {
        subpath: `./plugins/${entry.subpathName}`,
        symbol,
        method: plugin.method,
        slots: plugin.slots,
        tier: entry.tier,
        isAlias: false,
      };
    });
  });
  const fromAliases = SUBPATH_ALIASES.flatMap((alias) => {
    const loadedModule = loadBuiltModule(repositoryRoot, alias.subpathName);
    return Object.keys(loadedModule)
      .sort()
      .flatMap((symbol) => {
        const plugin = loadedModule[symbol];
        return isLoadedPlugin(plugin)
          ? [
              {
                subpath: `./plugins/${alias.subpathName}`,
                symbol,
                method: plugin.method,
                slots: plugin.slots,
                tier: "isolated" as PluginTier,
                isAlias: true,
              },
            ]
          : [];
      });
  });
  return [...fromDirectories, ...fromAliases];
}
