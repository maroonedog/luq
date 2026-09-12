// ===========================================================================
// scripts/issue-codes/build-issue-code-catalog.ts — the vocabulary, derived.
//
// TWO SOURCES, and the split is the design.
//
// A PLUGIN's code is its own `name`, because src/chain/create-chain-node.ts
// resolves `ctx.code` as `isString(options.code) ? options.code : plugin.name`
// and every plugin in the catalogue hands `ctx.code` straight to its rule. So
// the plugin half is read from the plugin catalogue — the same catalogue the
// manifest, the barrel and the exports map come from — and a plugin whose
// build never reaches a code-bearing rule (`transform`) contributes nothing.
//
// A LIBRARY code is a literal written at a code-bearing position outside any
// plugin directory: the slot type guards, the missing-root rejection, the
// unresolved async context, and the JSON Schema keywords that report under
// their own keyword name rather than under the plugin they drive.
//
// OWNERSHIP is recorded, not just the string. Two owners for one code is a
// real and deliberate state — `required` is reported by the required plugin
// AND by the missing-root rejection, under the same spelling on purpose — and
// the lock has to be able to tell that apart from a collision nobody noticed.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import {
  collectTypeScriptFiles,
  toRepositoryRelativePosix,
} from "../catalog/collect-typescript-files";
import { buildPluginCatalog } from "../catalog/build-plugin-catalog";
import { readPluginSurfaces } from "../catalog/read-plugin-surface";
import type { PluginCatalogEntry } from "../catalog/plugin-catalog.types";
import type {
  CodeSite,
  IssueCodeCatalog,
  IssueCodeEntry,
} from "./issue-code.types";
import { UNREACHABLE_CODE_SITES } from "./issue-code.types";
import { readCodeSites } from "./read-code-sites";

/** A code and the owners gathered for it before either list is sorted. */
type OwnersByCode = Map<string, Set<string>>;

function addOwner(into: OwnersByCode, code: string, owner: string): void {
  const owners = into.get(code) ?? new Set<string>();
  owners.add(owner);
  into.set(code, owners);
}

function toEntries(owners: OwnersByCode): readonly IssueCodeEntry[] {
  return [...owners.entries()]
    .map(([code, set]) => ({ code, owners: [...set].sort() }))
    .sort((left, right) => left.code.localeCompare(right.code));
}

/** The plugin directory holding this file, or undefined for a library file. */
function findOwningPlugin(
  entries: readonly PluginCatalogEntry[],
  file: string
): PluginCatalogEntry | undefined {
  return entries.find((entry) => file.startsWith(`${entry.directory}/`));
}

function isUnreachable(site: CodeSite, code: string): boolean {
  return UNREACHABLE_CODE_SITES.some(
    (unreachable) => unreachable.file === site.file && unreachable.code === code
  );
}

interface Collected {
  readonly issues: OwnersByCode;
  readonly gates: OwnersByCode;
  readonly unresolved: string[];
}

function collectSite(
  collected: Collected,
  site: CodeSite,
  plugin: PluginCatalogEntry | undefined,
  pluginNames: readonly string[]
): void {
  const into = site.kind === "gate" ? collected.gates : collected.issues;
  const owner = plugin === undefined ? site.file : plugin.directory;
  if (site.resolution === "unresolved") {
    collected.unresolved.push(
      `${site.file}:${String(site.line)} — ${site.expression}`
    );
    return;
  }
  if (site.resolution === "forwarded") {
    // Outside a plugin the forwarded code was decided at another site, which
    // is read on its own. Inside one it is `ctx.code`, whose default is the
    // plugin's own name — the whole reason a plugin name IS a code.
    for (const name of pluginNames) addOwner(into, name, owner);
    return;
  }
  for (const code of site.codes) {
    if (!isUnreachable(site, code)) addOwner(into, code, owner);
  }
}

/**
 * The plugin names one catalogue entry publishes. Injectable for the same
 * reason the manifest generator's is: a seed tree holds plugin-shaped TEXT,
 * and importing it would need the whole library beside it.
 */
export type ReadPluginNames = (
  repositoryRoot: string,
  entry: PluginCatalogEntry
) => readonly string[];

export const readPluginNames: ReadPluginNames = (repositoryRoot, entry) =>
  readPluginSurfaces(repositoryRoot, entry).map((surface) => surface.name);

export function buildIssueCodeCatalog(
  repositoryRoot: string,
  readNames: ReadPluginNames = readPluginNames
): IssueCodeCatalog {
  const entries = buildPluginCatalog(repositoryRoot).entries;
  const collected: Collected = {
    issues: new Map(),
    gates: new Map(),
    unresolved: [],
  };
  for (const absoluteFile of collectTypeScriptFiles(
    path.join(repositoryRoot, "src")
  )) {
    const file = toRepositoryRelativePosix(repositoryRoot, absoluteFile);
    const plugin = findOwningPlugin(entries, file);
    const pluginNames =
      plugin === undefined ? [] : readNames(repositoryRoot, plugin);
    for (const site of readCodeSites(
      file,
      fs.readFileSync(absoluteFile, "utf8")
    )) {
      collectSite(collected, site, plugin, pluginNames);
    }
  }
  return {
    codes: toEntries(collected.issues),
    gateOnlyCodes: toEntries(collected.gates),
    unresolvedSites: [...collected.unresolved].sort(),
  };
}
