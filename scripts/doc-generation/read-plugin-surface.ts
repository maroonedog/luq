import * as fs from "fs";
import * as path from "path";
import { buildPluginCatalog } from "../catalog/build-plugin-catalog";
import type { PluginTier } from "../catalog/plugin-catalog.types";
import { SUBPATH_ALIASES } from "../catalog/plugin-source-roots";

/**
 * The three facts about one plugin that a user can see. All three are read
 * from the built module, never from a table written by hand.
 */
export interface PluginSurfaceEntry {
  readonly subpath: string;
  readonly symbol: string;
  readonly method: string;
  readonly slots: readonly string[];
  readonly tier: PluginTier;
  /** A subpath that exists only to keep an older name. Not a new plugin. */
  readonly isAlias: boolean;
}

export class PluginSurfaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginSurfaceError";
  }
}

/** The three of a plugin definition's members that appear in the documentation. */
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
      `${built} is missing. Run npm run build first.`
    );
  }
  // Reads what actually ships rather than the type declarations, so the method
  // and slots in the table are what the shipped artefact says they are.
  const loaded: unknown = require(built);
  if (loaded === null || typeof loaded !== "object") {
    throw new PluginSurfaceError(`${built} exports no object`);
  }
  return loaded as Record<string, unknown>;
}

/**
 * Walks the catalog, which is the directory structure, and reads the symbols
 * Read from the built modules. A compatibility alias's subpath is listed the same way.
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
          `${symbol} in ${entry.subpathName} is not shaped like a plugin`
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
