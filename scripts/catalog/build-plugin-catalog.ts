import * as fs from "fs";
import * as path from "path";
import type {
  PluginCatalog,
  PluginCatalogEntry,
  PluginSourceRoot,
} from "./plugin-catalog.types";
import { PLUGIN_SOURCE_ROOTS } from "./plugin-source-roots";
import { readExportedPluginSymbols } from "./read-exported-plugin-symbols";
import { toSubpathName } from "./subpath-name";

export class PluginCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginCatalogError";
  }
}

/**
 * 走査根の直下ディレクトリだけをプラグインとして認める。
 * 走査根が存在しない場合は空のカタログを返す (プラグイン0件でも全生成物が成立する)。
 */
export function buildPluginCatalog(
  repositoryRoot: string,
  roots: readonly PluginSourceRoot[] = PLUGIN_SOURCE_ROOTS
): PluginCatalog {
  const entries = roots.flatMap((root) =>
    readEntriesUnderRoot(repositoryRoot, root)
  );
  rejectDuplicateSubpaths(entries);
  return {
    entries: [...entries].sort((left, right) =>
      left.subpathName.localeCompare(right.subpathName)
    ),
  };
}

function readEntriesUnderRoot(
  repositoryRoot: string,
  root: PluginSourceRoot
): PluginCatalogEntry[] {
  const absoluteRoot = path.join(repositoryRoot, root.directory);
  if (!fs.existsSync(absoluteRoot)) return [];
  return fs
    .readdirSync(absoluteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((directoryName) => readEntry(root, directoryName, absoluteRoot));
}

function readEntry(
  root: PluginSourceRoot,
  directoryName: string,
  absoluteRoot: string
): PluginCatalogEntry {
  const directory = `${root.directory}/${directoryName}`;
  const absoluteEntryFile = path.join(absoluteRoot, directoryName, "index.ts");
  if (!fs.existsSync(absoluteEntryFile)) {
    throw new PluginCatalogError(
      `${directory}: index.ts がありません。プラグインディレクトリはエントリを1つ持たなければなりません。`
    );
  }
  const sourceText = fs.readFileSync(absoluteEntryFile, "utf8");
  const exportedSymbols = readExportedPluginSymbols(sourceText);
  if (exportedSymbols.length === 0) {
    throw new PluginCatalogError(
      `${directory}/index.ts: 末尾が "Plugin" の export がありません。`
    );
  }
  return {
    directoryName,
    subpathName: toSubpathName(directoryName, root.tier),
    tier: root.tier,
    directory,
    entryFile: `${directory}/index.ts`,
    exportedSymbols,
  };
}

function rejectDuplicateSubpaths(entries: readonly PluginCatalogEntry[]): void {
  const seen = new Map<string, string>();
  for (const entry of entries) {
    const previous = seen.get(entry.subpathName);
    if (previous !== undefined) {
      throw new PluginCatalogError(
        `公開サブパス "${entry.subpathName}" が ${previous} と ${entry.directory} で重複しています。`
      );
    }
    seen.set(entry.subpathName, entry.directory);
  }
}
