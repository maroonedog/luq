import * as fs from "fs";
import * as path from "path";
import type { PluginSourceRoot, PluginTier } from "./plugin-catalog.types";
import { PLUGIN_SOURCE_ROOTS } from "./plugin-source-roots";

/** 閉じた領域集合。ここに無い import は存在しない。 */
export type ImportArea =
  | "own-directory"
  | "plugin-kit"
  | "types"
  | "path"
  | "json-schema"
  | "plugin-entry"
  | "plugin-internal"
  | "chain"
  | "compile"
  | "runtime"
  | "builder"
  | "result"
  | "async"
  | "other-source"
  | "external"
  | "unresolved";

/** 段ごとの許可集合。例外リストは持たない。 */
export const ALLOWED_AREAS_BY_TIER: Readonly<
  Record<PluginTier, readonly ImportArea[]>
> = {
  isolated: ["own-directory", "plugin-kit", "types", "path"],
  extension: [
    "own-directory",
    "plugin-kit",
    "types",
    "path",
    "json-schema",
    "plugin-entry",
  ],
};

export function isAllowedArea(tier: PluginTier, area: ImportArea): boolean {
  return ALLOWED_AREAS_BY_TIER[tier].includes(area);
}

export interface PluginImportSite {
  readonly repositoryRoot: string;
  /** import 元ファイルの posix 相対パス。 */
  readonly importingFile: string;
  /** そのファイルが属するプラグインディレクトリの posix 相対パス。 */
  readonly pluginDirectory: string;
  readonly specifier: string;
  readonly packageName: string;
  readonly roots?: readonly PluginSourceRoot[];
}

export function classifyPluginImport(site: PluginImportSite): ImportArea {
  const resolved = resolveSpecifier(site);
  if (resolved === "external") return "external";
  if (resolved === null) return "unresolved";
  return classifyResolvedModule(
    resolved,
    site.pluginDirectory,
    site.roots ?? PLUGIN_SOURCE_ROOTS
  );
}

/** 拡張子なしの posix 相対パス、"external"、または解決不能を表す null。 */
function resolveSpecifier(site: PluginImportSite): string | "external" | null {
  const { specifier, packageName } = site;
  if (specifier.startsWith(".")) {
    const joined = path.posix.join(
      path.posix.dirname(site.importingFile),
      specifier
    );
    if (joined.startsWith("..")) return null;
    const stripped = stripExtension(joined);
    return existsAsModule(site.repositoryRoot, stripped) ? stripped : null;
  }
  if (specifier === packageName) return "src/index";
  if (specifier.startsWith(`${packageName}/`)) {
    return `src/${specifier.slice(packageName.length + 1)}`;
  }
  return "external";
}

function stripExtension(modulePath: string): string {
  const withoutExtension = modulePath.replace(/\.(ts|tsx|js|mjs|cjs)$/, "");
  return withoutExtension.replace(/\/index$/, "");
}

function existsAsModule(repositoryRoot: string, modulePath: string): boolean {
  const absolute = path.join(repositoryRoot, modulePath);
  return (
    fs.existsSync(`${absolute}.ts`) ||
    fs.existsSync(path.join(absolute, "index.ts"))
  );
}

function classifyResolvedModule(
  resolved: string,
  pluginDirectory: string,
  roots: readonly PluginSourceRoot[]
): ImportArea {
  if (isWithin(resolved, pluginDirectory)) return "own-directory";
  const pluginArea = classifyAgainstRoots(resolved, roots);
  if (pluginArea !== null) return pluginArea;
  if (isWithin(resolved, "src/plugin-kit")) return "plugin-kit";
  if (isWithin(resolved, "src/types")) return "types";
  if (isWithin(resolved, "src/path")) return "path";
  if (isWithin(resolved, "src/json-schema")) return "json-schema";
  if (isWithin(resolved, "src/chain")) return "chain";
  if (isWithin(resolved, "src/compile")) return "compile";
  if (isWithin(resolved, "src/runtime")) return "runtime";
  if (isWithin(resolved, "src/builder")) return "builder";
  if (isWithin(resolved, "src/result")) return "result";
  if (isWithin(resolved, "src/async")) return "async";
  return "other-source";
}

/** 他プラグインのエントリか、その内部ファイルか。自分のディレクトリは判定済み。 */
function classifyAgainstRoots(
  resolved: string,
  roots: readonly PluginSourceRoot[]
): ImportArea | null {
  for (const root of roots) {
    if (!isWithin(resolved, root.directory)) continue;
    const rest = resolved.slice(root.directory.length + 1);
    if (rest.length === 0) return null;
    return rest.includes("/") ? "plugin-internal" : "plugin-entry";
  }
  return null;
}

function isWithin(modulePath: string, directory: string): boolean {
  return modulePath === directory || modulePath.startsWith(`${directory}/`);
}
