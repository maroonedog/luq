import * as path from "path";
import { buildPluginCatalog } from "./catalog/build-plugin-catalog";
import type { PluginCatalogEntry } from "./catalog/plugin-catalog.types";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

/**
 * Confirms, from one place looking at the whole catalog, that no two plugins
 * share a name and no slot grows the same chain method twice.
 *
 * Plugins may not import one another, so no plugin can detect a collision with
 * a sibling. That is how the previous major ended up with three
 * implementations of one method, an unreachable export, and one rule defined
 * in two places. This is the only vantage point from which such a collision is
 * visible, and it brings it forward from the moment someone calls `.use()`.
 *
 * Read from the plugin objects themselves, not from the source text: slots may
 * be written as an identifier, whose value static analysis cannot know.
 */
export interface PluginIdentity {
  readonly symbol: string;
  readonly directory: string;
  readonly name: string;
  readonly method: string;
  readonly slots: readonly string[];
}

export interface UniquenessViolation {
  readonly kind: "duplicate-name" | "duplicate-slot-method";
  readonly detail: string;
}

interface PluginShape {
  readonly name: string;
  readonly method: string;
  readonly slots: readonly string[];
}

function isPluginShape(value: unknown): value is PluginShape {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["name"] === "string" &&
    typeof candidate["method"] === "string" &&
    Array.isArray(candidate["slots"]) &&
    candidate["slots"].every((slot) => typeof slot === "string")
  );
}

function readEntryModule(
  repositoryRoot: string,
  entry: PluginCatalogEntry
): Record<string, unknown> {
  const absoluteEntryFile = path.join(repositoryRoot, entry.entryFile);
  const loaded: unknown = require(absoluteEntryFile);
  if (typeof loaded !== "object" || loaded === null) {
    throw new Error(`${entry.entryFile}: the module could not be read`);
  }
  return loaded as Record<string, unknown>;
}

/** Collects (name, method, slots) as real values from every catalog entry. */
export function readPluginIdentities(
  repositoryRoot: string
): readonly PluginIdentity[] {
  return buildPluginCatalog(repositoryRoot).entries.flatMap((entry) => {
    const loaded = readEntryModule(repositoryRoot, entry);
    return entry.exportedSymbols.map((symbol) => {
      const exported = loaded[symbol];
      if (!isPluginShape(exported)) {
        throw new Error(
          `${entry.entryFile}: the export "${symbol}" is not a plugin object ` +
            `carrying name, method and slots.`
        );
      }
      return {
        symbol,
        directory: entry.directory,
        name: exported.name,
        method: exported.method,
        slots: [...exported.slots].sort(),
      };
    });
  });
}

function findDuplicateNames(
  identities: readonly PluginIdentity[]
): UniquenessViolation[] {
  const byName = new Map<string, PluginIdentity[]>();
  for (const identity of identities) {
    const found = byName.get(identity.name);
    if (found === undefined) byName.set(identity.name, [identity]);
    else found.push(identity);
  }
  return [...byName.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([name, group]) => ({
      kind: "duplicate-name" as const,
      detail:
        `the plugin name "${name}" appears in ${String(group.length)} places: ` +
        group.map((one) => `${one.directory} (${one.symbol})`).join(" / "),
    }));
}

function findDuplicateSlotMethods(
  identities: readonly PluginIdentity[]
): UniquenessViolation[] {
  const bySlotMethod = new Map<string, PluginIdentity[]>();
  for (const identity of identities) {
    for (const slot of identity.slots) {
      const key = `${slot}.${identity.method}`;
      const found = bySlotMethod.get(key);
      if (found === undefined) bySlotMethod.set(key, [identity]);
      else found.push(identity);
    }
  }
  return [...bySlotMethod.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      kind: "duplicate-slot-method" as const,
      detail:
        `the chain method ${key} is grown by ${String(group.length)} plugins: ` +
        `${group.map((one) => one.name).join(" / ")}`,
    }));
}

/** Pure: reads no real tree, so the check itself can be checked with seed data. */
export function findUniquenessViolations(
  identities: readonly PluginIdentity[]
): readonly UniquenessViolation[] {
  return [
    ...findDuplicateNames(identities),
    ...findDuplicateSlotMethods(identities),
  ];
}

if (require.main === module) {
  runCheckAndExit(() => {
    const identities = readPluginIdentities(REPOSITORY_ROOT);
    const violations = findUniquenessViolations(identities);
    if (violations.length === 0) {
      console.error(
        `Plugin uniqueness: no violations (${String(identities.length)} plugins)`
      );
      return 0;
    }
    console.error(
      `Plugin uniqueness: ${String(violations.length)} violations:`
    );
    for (const violation of violations) console.error(`  ${violation.detail}`);
    return 1;
  });
}
