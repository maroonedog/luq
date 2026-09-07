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
 * ロックと実ディレクトリを突き合わせる。
 * 受け入れ条件にプラグイン数を書かないための唯一の場所であり、
 * 数はここでロックファイルから読まれる (どこにもハードコードしない)。
 */
export function findCatalogLockMismatches(
  repositoryRoot: string
): readonly CatalogLockMismatch[] {
  const lockPath = path.join(repositoryRoot, PLUGIN_CATALOG_LOCK_OUTPUT);
  if (!fs.existsSync(lockPath)) {
    return [
      { kind: "absent", detail: `${PLUGIN_CATALOG_LOCK_OUTPUT} がありません` },
    ];
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  if (!isPluginCatalogLock(parsed)) {
    return [
      { kind: "absent", detail: `${PLUGIN_CATALOG_LOCK_OUTPUT} の形が不正です` },
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
      detail: `プラグイン数: ロック ${locked.pluginCount} / 実際 ${live.pluginCount}`,
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
      detail: `${kind} が一致しません。ロック ${lockedText} / 実際 ${liveText}`,
    },
  ];
}

if (require.main === module) {
  runCheckAndExit(() => {
    const mismatches = findCatalogLockMismatches(REPOSITORY_ROOT);
    if (mismatches.length === 0) {
      console.error("カタログロック: 一致");
      return 0;
    }
    console.error(`カタログロック不一致 ${mismatches.length} 件:`);
    for (const mismatch of mismatches) console.error(`  ${mismatch.detail}`);
    return 1;
  });
}
