import type {
  PluginCatalog,
  PluginCatalogEntry,
} from "../catalog/plugin-catalog.types";
import { PLUGIN_BARREL_OUTPUT } from "../catalog/plugin-source-roots";
import type { PluginSelection } from "./size-budget.types";

/**
 * Builds the synthetic entry module that gets measured.
 *
 * The entry re-exports exactly the named symbols and nothing else, so what
 * survives bundling is only the code reachable from those names — which makes
 * the measurement equal to what a user who wrote those imports would pay.
 * Writing an app and measuring that says far less about what was measured.
 */
const CORE_ENTRY_MODULE = "./src/index";

const BARREL_MODULE = `./${PLUGIN_BARREL_OUTPUT.replace(/\.ts$/, "")}`;

/** The floor paid by a user with no plugins: whatever Builder reaches. */
export function createCoreEntrySource(): string {
  return `export { Builder } from "${CORE_ENTRY_MODULE}";\n`;
}

export function selectCatalogEntries(
  catalog: PluginCatalog,
  selection: PluginSelection
): readonly PluginCatalogEntry[] {
  if (selection === "all") return catalog.entries;
  return selection.map((subpathName) => {
    const found = catalog.entries.find(
      (entry) => entry.subpathName === subpathName
    );
    if (found === undefined) {
      throw new Error(
        `the plugin "${subpathName}" is not in the catalog; ` +
          `check the spelling in config/size-budget.json`
      );
    }
    return found;
  });
}

/** Imported individually from the deep subpaths. */
export function createSubpathEntrySource(
  catalog: PluginCatalog,
  selection: PluginSelection
): string {
  const lines = selectCatalogEntries(catalog, selection).map(
    (entry) =>
      `export { ${entry.exportedSymbols.join(", ")} } from ` +
      `"./${entry.entryFile.replace(/\.ts$/, "")}";`
  );
  return [createCoreEntrySource(), ...lines, ""].join("\n");
}

/** Imported by name from the barrel. */
export function createBarrelEntrySource(
  catalog: PluginCatalog,
  selection: PluginSelection
): string {
  const symbols = selectCatalogEntries(catalog, selection).flatMap(
    (entry) => entry.exportedSymbols
  );
  return (
    createCoreEntrySource() +
    `export { ${symbols.join(", ")} } from "${BARREL_MODULE}";\n`
  );
}
