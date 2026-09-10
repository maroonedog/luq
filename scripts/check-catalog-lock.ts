import * as fs from "fs";
import * as path from "path";
import type { PluginCatalogLock } from "./catalog/plugin-catalog.types";
import {
  PLUGIN_CATALOG_LOCK_OUTPUT,
  REPOSITORY_ROOT,
} from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import { buildPluginCatalogLock } from "./generate-plugin-catalog";

export interface CatalogLockMismatch {
  readonly kind: "absent" | "count" | "plugins" | "export-keys";
  readonly detail: string;
}

function isPluginCatalogLock(value: unknown): value is PluginCatalogLock {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["pluginCount"] === "number" &&
    Array.isArray(candidate["plugins"]) &&
    Array.isArray(candidate["exportKeys"])
  );
}

/**
 * Compares the lock against the real directories.
 *
 * This is the one place that keeps a plugin count out of any acceptance
 * criterion: the number is read from the lock file and hard-coded nowhere.
 */
export function findCatalogLockMismatches(
  repositoryRoot: string
): readonly CatalogLockMismatch[] {
  const lockPath = path.join(repositoryRoot, PLUGIN_CATALOG_LOCK_OUTPUT);
  if (!fs.existsSync(lockPath)) {
    return [
      { kind: "absent", detail: `${PLUGIN_CATALOG_LOCK_OUTPUT} is missing` },
    ];
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  if (!isPluginCatalogLock(parsed)) {
    return [
      {
        kind: "absent",
        detail: `${PLUGIN_CATALOG_LOCK_OUTPUT} has an invalid shape`,
      },
    ];
  }
  const live = buildPluginCatalogLock(repositoryRoot);
  return [
    ...compareCount(parsed, live),
    ...compareList("plugins", parsed.plugins, live.plugins),
    ...compareList("export-keys", parsed.exportKeys, live.exportKeys),
  ];
}

function compareCount(
  locked: PluginCatalogLock,
  live: PluginCatalogLock
): CatalogLockMismatch[] {
  if (locked.pluginCount === live.pluginCount) return [];
  return [
    {
      kind: "count",
      detail: `plugin count: locked ${locked.pluginCount}, actual ${live.pluginCount}`,
    },
  ];
}

function compareList(
  kind: "plugins" | "export-keys",
  locked: readonly unknown[],
  live: readonly unknown[]
): CatalogLockMismatch[] {
  const lockedText = JSON.stringify(locked);
  const liveText = JSON.stringify(live);
  if (lockedText === liveText) return [];
  return [
    {
      kind,
      detail: `${kind} does not match: locked ${lockedText}, actual ${liveText}`,
    },
  ];
}

if (require.main === module) {
  runCheckAndExit(() => {
    const mismatches = findCatalogLockMismatches(REPOSITORY_ROOT);
    if (mismatches.length === 0) {
      console.error("Catalog lock: matches");
      return 0;
    }
    console.error(`Catalog lock: ${mismatches.length} mismatches:`);
    for (const mismatch of mismatches) console.error(`  ${mismatch.detail}`);
    return 1;
  });
}
