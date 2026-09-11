import * as path from "path";
import type { PluginCatalogEntry } from "./plugin-catalog.types";

/**
 * The chain method a plugin adds, and the slots it adds it to.
 *
 * Read by IMPORTING the plugin and looking at the object it exports, not by
 * parsing the source for `method:` and `slots:`. A parser would answer what the
 * literal says; this answers what the plugin IS, so a definition assembled from
 * a constant or a helper cannot make the two disagree.
 *
 * This is a build script, not a layer. The generated file it feeds imports no
 * plugin — it holds literal strings — so nothing at run time gains an import
 * running outward from the plugin layer.
 */
export interface PluginSurface {
  /** The plugin's own name, e.g. "stringMin". */
  readonly name: string;
  /** The chain method it adds, e.g. "min". */
  readonly method: string;
  /** The slots it is offered on, e.g. ["string"]. */
  readonly slots: readonly string[];
}

export class PluginSurfaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginSurfaceError";
  }
}

/** A plugin as `definePlugin` leaves it. Narrowed here, never asserted. */
function readSurfaceFrom(value: unknown, where: string): PluginSurface {
  if (typeof value !== "object" || value === null) {
    throw new PluginSurfaceError(`${where} does not export a plugin object`);
  }
  const bag = value as Record<string, unknown>;
  const { name, method, slots } = bag;
  if (typeof name !== "string" || typeof method !== "string") {
    throw new PluginSurfaceError(`${where} has no name or no method`);
  }
  if (!Array.isArray(slots) || slots.some((s) => typeof s !== "string")) {
    throw new PluginSurfaceError(`${where} has no slot list`);
  }
  return { name, method, slots: slots as readonly string[] };
}

export function readPluginSurfaces(
  repositoryRoot: string,
  entry: PluginCatalogEntry
): readonly PluginSurface[] {
  const absolute = path.join(repositoryRoot, entry.entryFile);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module: unknown = require(absolute);
  if (typeof module !== "object" || module === null) {
    throw new PluginSurfaceError(`${entry.entryFile} exports nothing`);
  }
  const bag = module as Record<string, unknown>;
  return entry.exportedSymbols.map((symbol) =>
    readSurfaceFrom(bag[symbol], `${entry.entryFile} → ${symbol}`)
  );
}
